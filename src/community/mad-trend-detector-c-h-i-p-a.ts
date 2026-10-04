/**
 * MAD Trend Detector
 *
 * Bands around a moving average (EMA or SMA of the source) with the mean absolute deviation from the median:
 * med = median(src, MAD length), mad = sma(|src - med|, MAD length) * multiplier; upper = ma + mad * upper strength,
 * lower = ma - mad * lower strength. A close above the upper band sets the trend up (blue candles), a close below the
 * lower band sets it down (red candles); no colour before the first signal. The candles are drawn in the indicator
 * pane and on the price pane.
 *
 * Reference: "MAD Trend Detector ~ C H I P A" by C_H_I_P_A
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';

export interface MadTrendDetectorInputs {
  src: SourceType;
  /** MA length */
  maLength: number;
  /** Length of the median and of the mean absolute deviation */
  madLength: number;
  madMultiplier: number;
  /** Upper Band Strength */
  upperDeviation: number;
  /** Lower Band Strength */
  lowerDeviation: number;
  maType: 'EMA' | 'SMA';
}

export const defaultInputs: MadTrendDetectorInputs = {
  src: 'close',
  maLength: 8,
  madLength: 20,
  madMultiplier: 0.9,
  upperDeviation: 1.0,
  lowerDeviation: 1.0,
  maType: 'EMA',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'maLength', type: 'int', title: 'MA Length', defval: 8, min: 1 },
  { id: 'madLength', type: 'int', title: 'MAD Length', defval: 20, min: 1 },
  { id: 'madMultiplier', type: 'float', title: 'MAD Multiplier', defval: 0.9, min: 0.1, step: 0.1 },
  { id: 'upperDeviation', type: 'float', title: 'Upper Band Strength', defval: 1.0, min: 0.1, max: 10, step: 0.02 },
  { id: 'lowerDeviation', type: 'float', title: 'Lower Band Strength', defval: 1.0, min: 0.1, max: 10, step: 0.02 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA', options: ['EMA', 'SMA'] },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Band', color: color.gray, lineWidth: 1 },
  { id: 'plot1', title: 'Lower Band', color: color.gray, lineWidth: 1 },
];

export const metadata = {
  title: 'MAD Trend Detector ~ C H I P A',
  shortTitle: 'MAD Trend Detector ~ C H I P A',
  overlay: false,
};

/** Pine a > b: a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;

export function calculate(
  bars: Bar[],
  inputs: Partial<MadTrendDetectorInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  const srcS = getSourceSeries(bars, cfg.src);
  const src = A(srcS);
  // ma = ma_type == "EMA" ? ta.ema(src, ma_length) : ta.sma(src, ma_length) (the input is constant: one branch on
  // every bar)
  const ma = A(cfg.maType === 'EMA' ? ta.ema(srcS, cfg.maLength) : ta.sma(srcS, cfg.maLength));
  const med = A(ta.median(srcS, cfg.madLength));
  const absDev = Series.fromArray(bars, src.map((v, i) => Math.abs(v - med[i])));
  const mad = A(ta.sma(absDev, cfg.madLength));

  const up = String(color.rgb(0, 180, 255));
  const down = String(color.rgb(255, 80, 60));
  const pane: PlotCandleData[] = [];
  const overlay: PlotCandleData[] = [];
  const plot0: { time: number; value: number }[] = [];
  const plot1: { time: number; value: number }[] = [];
  let signal = 0; // var int signal = 0
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const madScaled = mad[i] * cfg.madMultiplier;
    const upper = ma[i] + madScaled * cfg.upperDeviation;
    const lower = ma[i] - madScaled * cfg.lowerDeviation;
    if (gt(b.close, upper)) signal = 1;
    if (gt(lower, b.close)) signal = -1;
    plot0.push({ time: b.time as number, value: upper });
    plot1.push({ time: b.time as number, value: lower });
    // coloring = signal == 1 ? rgb(0, 180, 255) : signal == -1 ? rgb(255, 80, 60) : na
    const c = signal === 1 ? up : signal === -1 ? down : 'transparent';
    const candle = { time: b.time as number, open: b.open, high: b.high, low: b.low, close: b.close, color: c, wickColor: c, borderColor: c };
    pane.push(candle);
    // the second plotcandle has force_overlay = true
    overlay.push({ ...candle, forceOverlay: true });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1 },
    markers: [],
    plotCandles: { barColoring: pane, barColoringOverlay: overlay },
  };
}

export const MadTrendDetector = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
