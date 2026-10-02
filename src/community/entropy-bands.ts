/**
 * Entropy Bands (TechnoBlooms)
 *
 * A moving average (SMA, EMA or WMA) of the close is the midline. The "entropy" is the SMA of the bar range divided
 * by the close; the band width is multiplier * (entropy + ATR). The bands are the midline +/- the width, with a fill.
 * Candles with a body larger than a minimum percent of the close are coloured green above the upper band, magenta
 * below the lower band and gray between the bands.
 *
 * Reference: "Entropy Bands (TechnoBlooms)" by TechnoBlooms
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © TechnoBlooms
 */

import { taCore, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';

export type EntropyBandsMAType = 'SMA' | 'EMA' | 'WMA';

export interface EntropyBandsInputs {
  /** Length of the midline average and of the entropy SMA */
  entropyLength: number;
  atrLength: number;
  bandMultiplier: number;
  maType: EntropyBandsMAType;
  /** Show the midline and the bands */
  showBands: boolean;
  /** Pine input that the script does not use */
  showBackground: boolean;
  /** Pine input that the script does not use */
  entropyThreshold: number;
  /** Colour the candles */
  showCandleColoring: boolean;
  /** Minimum candle body (% of the close) to colour a candle */
  minBodyPercent: number;
}

export const defaultInputs: EntropyBandsInputs = {
  entropyLength: 20,
  atrLength: 14,
  bandMultiplier: 1.5,
  maType: 'SMA',
  showBands: true,
  showBackground: true,
  entropyThreshold: 2.0,
  showCandleColoring: true,
  minBodyPercent: 0.03,
};

export const inputConfig: InputConfig[] = [
  { id: 'entropyLength', type: 'int', title: 'Entropy Length', defval: 20 },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14 },
  { id: 'bandMultiplier', type: 'float', title: 'Band Multiplier', defval: 1.5, step: 0.1 },
  { id: 'maType', type: 'string', title: 'Moving Average Type', defval: 'SMA', options: ['SMA', 'EMA', 'WMA'] },
  { id: 'showBands', type: 'bool', title: 'Show Bands', defval: true },
  { id: 'showBackground', type: 'bool', title: 'Color Background by Entropy', defval: true },
  { id: 'entropyThreshold', type: 'float', title: 'Entropy Threshold for Dynamic Background', defval: 2.0 },
  { id: 'showCandleColoring', type: 'bool', title: 'Color Candles Based on Entropy Bands', defval: true },
  { id: 'minBodyPercent', type: 'float', title: 'Minimum Candle Body Size (%) to Confirm Breakout', defval: 0.03 },
];

const BAND_COLOR = String(color.rgb(47, 192, 187));
const FILL_COLOR = String(color.rgb(146, 146, 148, 94));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Midline', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'Upper Band', color: BAND_COLOR, lineWidth: 1 },
  { id: 'plot2', title: 'Lower Band', color: BAND_COLOR, lineWidth: 1 },
  { id: 'plot3', title: 'Upper Fill Edge', color: 'transparent', lineWidth: 1 },
  { id: 'plot4', title: 'Lower Fill Edge', color: 'transparent', lineWidth: 1 },
];

export const metadata = {
  title: 'Entropy Bands (TechnoBlooms)',
  shortTitle: 'Entropy Bands (TechnoBlooms)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<EntropyBandsInputs> = {},
): IndicatorResult & { barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  const close = bars.map((b) => b.close);

  // basis = ma(close, entropy_length): the switch runs only the branch of the (constant) type
  const basis = cfg.maType === 'EMA' ? taCore.ema(close, cfg.entropyLength)
    : cfg.maType === 'WMA' ? taCore.wma(close, cfg.entropyLength)
      : taCore.sma(close, cfg.entropyLength);
  // entropy = ta.sma((high - low) / close, entropy_length)
  const entropy = taCore.sma(bars.map((b) => (b.high - b.low) / b.close), cfg.entropyLength);
  const atr = taCore.atr(cfg.atrLength, high, low, close);

  const upper: number[] = new Array(n);
  const lower: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const width = cfg.bandMultiplier * (entropy[i] + atr[i]);
    upper[i] = basis[i] + width;
    lower[i] = basis[i] - width;
  }

  const t = (i: number) => bars[i].time;
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const plots = {
    plot0: bars.map((_b, i) => ({ time: t(i), value: cfg.showBands ? fin(basis[i]) : NaN, color: color.blue })),
    plot1: bars.map((_b, i) => ({ time: t(i), value: cfg.showBands ? fin(upper[i]) : NaN, color: BAND_COLOR })),
    plot2: bars.map((_b, i) => ({ time: t(i), value: cfg.showBands ? fin(lower[i]) : NaN, color: BAND_COLOR })),
    // fill(plot(upper_band, color = na), plot(lower_band, color = na), color.rgb(146, 146, 148, 94))
    plot3: bars.map((_b, i) => ({ time: t(i), value: fin(upper[i]) })),
    plot4: bars.map((_b, i) => ({ time: t(i), value: fin(lower[i]) })),
  };

  // barcolor(show_candle_coloring and body_percent > min_body_percent ? (close > upper_band ? #06f093 :
  //   close < lower_band ? #ff03ea : #6e6b6f) : na)
  const barColors: BarColorData[] = [];
  if (cfg.showCandleColoring) {
    for (let i = 0; i < n; i++) {
      const bodyPercent = (Math.abs(close[i] - bars[i].open) / close[i]) * 100;
      if (!gt(bodyPercent, cfg.minBodyPercent)) continue;
      const c = gt(close[i], upper[i]) ? '#06f093' : lt(close[i], lower[i]) ? '#ff03ea' : '#6e6b6f';
      barColors.push({ time: t(i), color: c });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills: [{ plot1: 'plot3', plot2: 'plot4', options: { color: FILL_COLOR }, colors: new Array<string>(n).fill(FILL_COLOR) }],
    barColors,
  };
}

export const EntropyBands = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
