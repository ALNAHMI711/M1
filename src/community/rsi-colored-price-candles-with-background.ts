/**
 * RSI-Colored Price Candles with Background
 *
 * Draws the price candles in lime when the RSI (RMA of the gains and losses of the source) is at or above 50, else
 * in red (also while the RSI is na). An optional background is green above 70 and red below 30.
 *
 * Reference: "Stryder's DikFat RSI Candle Bull/Bear Detector" by Midgar-
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { PlotCandleData, BgColorData } from '../types';

export interface RSIColoredPriceCandlesInputs {
  /** RSI length */
  rsiLength: number;
  /** RSI source */
  src: SourceType;
  /** Show the overbought / oversold background */
  showBackground: boolean;
}

export const defaultInputs: RSIColoredPriceCandlesInputs = {
  rsiLength: 14,
  src: 'close',
  showBackground: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'src', type: 'source', title: 'RSI Source', defval: 'close' },
  { id: 'showBackground', type: 'bool', title: 'Show Overbought/Oversold Background', defval: false },
];

// No plot(): the outputs are the candles and the background
export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [
  { id: 'candles', title: 'RSI-Colored Price Candles' },
];

export const metadata = {
  title: "Stryder's DikFat RSI Candle Bull/Bear Detector",
  shortTitle: 'DFAT RSI Candles',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<RSIColoredPriceCandlesInputs> = {},
): Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]>; bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const src = A(getSourceSeries(bars, cfg.src));
  const n = bars.length;

  // change = ta.change(src); math.max / math.min with na give na
  const change = src.map((v, i) => (i > 0 ? v - src[i - 1] : NaN));
  const up = A(ta.rma(Series.fromArray(bars, change.map((c) => (isNaN(c) ? NaN : Math.max(c, 0)))), cfg.rsiLength));
  const down = A(ta.rma(Series.fromArray(bars, change.map((c) => (isNaN(c) ? NaN : -Math.min(c, 0)))), cfg.rsiLength));

  const bull = String(color.new(color.lime, 0));
  const bear = String(color.new(color.red, 0));
  const obCol = String(color.new(color.green, 90));
  const osCol = String(color.new(color.red, 90));

  const candles: PlotCandleData[] = [];
  const bgColors: BgColorData[] = [];
  for (let i = 0; i < n; i++) {
    // rsi = down == 0 ? 100 : up == 0 ? 0 : 100 - (100 / (1 + up / down))
    const rsi = eq(down[i], 0) ? 100 : eq(up[i], 0) ? 0 : 100 - 100 / (1 + up[i] / down[i]);
    // rsiColor = rsi >= 50 ? lime : red (na RSI: red)
    const col = ge(rsi, 50) ? bull : bear;
    const b = bars[i];
    candles.push({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, color: col, wickColor: col, borderColor: col });
    if (cfg.showBackground) {
      if (gt(rsi, 70)) bgColors.push({ time: b.time, color: obCol });
      else if (lt(rsi, 30)) bgColors.push({ time: b.time, color: osCol });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    plotCandles: { candles },
    bgColors,
  };
}

export const RSIColoredPriceCandles = { calculate, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig };
