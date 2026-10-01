/**
 * STH Unrealized Profit/Loss Ratio (STH-NUPL)
 *
 * A price-only proxy of the short-term-holder NUPL: the realized value is the SMA of the close over the lookback,
 * the raw ratio is (close - realized value) / close and STH-NUPL is its EMA over the smoothing period. A moving
 * average of STH-NUPL (SMA / EMA / HMA / WMA / RMA / VWMA) is yellow when it is above its value 2 bars ago, else red.
 * A zero line and a thick trend line (yellow above zero, red below) follow STH-NUPL; the background takes the colour
 * of STH-NUPL against zero or of the moving average.
 *
 * Reference: "STH Unrealized Profit/Loss Ratio (STH-NUPL) | [DeV]" by DeVrizii
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: ©DeVrizii
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';

export interface STHUnrealizedProfitLossRatioInputs {
  /** Realized value lookback length (SMA of the close) */
  lookbackPeriod: number;
  /** EMA smoothing period of the raw ratio */
  smoothingPeriod: number;
  /** Moving average length */
  maLength: number;
  maType: 'SMA' | 'EMA' | 'HMA' | 'WMA' | 'RMA' | 'VWMA';
  showMA: boolean;
  showBackground: boolean;
  backgroundSource: 'STH-NUPL' | 'MA';
}

export const defaultInputs: STHUnrealizedProfitLossRatioInputs = {
  lookbackPeriod: 150,
  smoothingPeriod: 5,
  maLength: 90,
  maType: 'EMA',
  showMA: true,
  showBackground: true,
  backgroundSource: 'STH-NUPL',
};

export const inputConfig: InputConfig[] = [
  { id: 'lookbackPeriod', type: 'int', title: 'Realized Value Lookback Length', defval: 150, min: 1 },
  { id: 'smoothingPeriod', type: 'int', title: 'Smoothing Period', defval: 5, min: 1 },
  { id: 'maLength', type: 'int', title: 'MA Lookback Length', defval: 90 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA', options: ['SMA', 'EMA', 'HMA', 'WMA', 'RMA', 'VWMA'] },
  { id: 'showMA', type: 'bool', title: 'Show Moving Average?', defval: true },
  { id: 'showBackground', type: 'bool', title: 'Show Background Colors?', defval: true },
  { id: 'backgroundSource', type: 'string', title: 'Background Color Source', defval: 'STH-NUPL', options: ['STH-NUPL', 'MA'] },
];

const COLOR_BULLISH = '#aaa11a';
const COLOR_BEARISH = '#991717';
const COLOR_NUPL = color.gray;
const MA_BULL = String(color.new(COLOR_BULLISH, 40));
const MA_BEAR = String(color.new(COLOR_BEARISH, 40));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'STH-NUPL', color: COLOR_NUPL, lineWidth: 1 },
  // display = showMA ? display.all : display.none
  { id: 'plot1', title: 'STH-NUPL MA', color: MA_BULL, lineWidth: 1, visible: 'showMA' },
  { id: 'plot2', title: 'Midline', color: COLOR_BULLISH, lineWidth: 1 },
  { id: 'plot3', title: 'STH-NUPL Trend', color: COLOR_BULLISH, lineWidth: 3, style: 'linebr' },
];

export const metadata = {
  title: 'STH Unrealized Profit/Loss Ratio (STH-NUPL) | [DeV]',
  shortTitle: 'STH-NUPL | [DeV]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<STHUnrealizedProfitLossRatioInputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  // realizedValue = ta.sma(close, lookbackPeriod); rawSthNupl = (close - realizedValue) / close
  const close = bars.map((b) => b.close);
  const realized = A(ta.sma(S(close), cfg.lookbackPeriod));
  const raw = close.map((c, i) => (c - realized[i]) / c);
  // sthNupl = ta.ema(rawSthNupl, smoothingPeriod)
  const sthNupl = A(ta.ema(S(raw), cfg.smoothingPeriod));

  // maNupl = calculateMA(sthNupl, maLength, maType)
  const src = S(sthNupl);
  let maSeries: Series;
  switch (cfg.maType) {
    case 'SMA': maSeries = ta.sma(src, cfg.maLength); break;
    case 'EMA': maSeries = ta.ema(src, cfg.maLength); break;
    case 'HMA': maSeries = ta.hma(src, cfg.maLength); break;
    case 'WMA': maSeries = ta.wma(src, cfg.maLength); break;
    case 'RMA': maSeries = ta.rma(src, cfg.maLength); break;
    case 'VWMA': maSeries = ta.vwma(src, cfg.maLength, S(bars.map((b) => b.volume ?? NaN))); break;
    default: throw new Error(`Unknown MA type ${String(cfg.maType)}`);
  }
  const maNupl = A(maSeries);

  // colorMA = maNupl > maNupl[2] ? color.new(colorBullish, 40) : color.new(colorBearish, 40)
  const colorMA = (i: number) => (gt(maNupl[i], i >= 2 ? maNupl[i - 2] : NaN) ? MA_BULL : MA_BEAR);
  // colorMidline = sthNupl > 0 ? colorBullish : colorBearish
  const colorMidline = (i: number) => (gt(sthNupl[i], 0) ? COLOR_BULLISH : COLOR_BEARISH);

  // bgcolor(showBackground ? color.new(backgroundColor, 90) : color.new(color.white, 100))
  const bgColors: BgColorData[] = [];
  for (let i = 0; i < n; i++) {
    const bg = cfg.backgroundSource === 'STH-NUPL' ? colorMidline(i) : colorMA(i);
    bgColors.push({
      time: bars[i].time,
      color: cfg.showBackground ? String(color.new(bg, 90)) : String(color.new(color.white, 100)),
    });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      // plot(sthNupl, color = color.gray, title = "STH-NUPL")
      plot0: bars.map((b, i) => ({ time: b.time, value: sthNupl[i], color: COLOR_NUPL })),
      // plot(maNupl, color = colorMA, title = "STH-NUPL MA", display = showMA ? display.all : display.none)
      plot1: bars.map((b, i) => ({ time: b.time, value: maNupl[i], color: colorMA(i) })),
      // plot(0, color = colorMidline, title = "Midline")
      plot2: bars.map((b, i) => ({ time: b.time, value: 0, color: colorMidline(i) })),
      // plot(sthNupl, title = "STH-NUPL Trend", style = plot.style_linebr, linewidth = 3, color = sthNupl > 0 ? ...)
      plot3: bars.map((b, i) => ({ time: b.time, value: sthNupl[i], color: colorMidline(i) })),
    },
    bgColors,
  };
}

export const STHUnrealizedProfitLossRatio = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
