/**
 * Trend Heatmap
 *
 * Two volume-weighted RSI-like lines: trendline = 100 - 100 / (1 + up / down), where up / down are the 8-bar sums of
 * volume * ohlc4 on bars where ohlc4 rose / fell; trendline2 is the same with close over 20 bars. The bar strength is
 * (2 * close - low - high) / (high - low) * volume / volume (0 on a flat bar). The plotted line is
 * trendline + strength / trendline2 + strength, coloured by a green to red gradient between 30 and 80, with
 * horizontal lines at 100, 50 and 0.
 *
 * Reference: "Trend Heatmap" by autocrp
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { math, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';

export interface TrendHeatmapInputs {}

export const defaultInputs: TrendHeatmapInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trend', color: color.green, lineWidth: 3 },
];

/** hline(100 / 50 / 0, color = color.gray, linestyle = hline.style_dotted) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_max', price: 100, title: 'Max', color: color.gray, linestyle: 'dotted' },
  { id: 'hline_mid', price: 50, title: 'Mid', color: color.gray, linestyle: 'dotted' },
  { id: 'hline_min', price: 0, title: 'Min', color: color.gray, linestyle: 'dotted' },
];

export const metadata = {
  title: 'Trend Heatmap',
  shortTitle: 'Trend Heatmap',
  overlay: false,
};

/** Pine float comparisons: a == b within 1e-10, a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

export function calculate(bars: Bar[], _inputs: Partial<TrendHeatmapInputs> = {}): IndicatorResult {
  const n = bars.length;
  const A = (s: Series | number[]) => (s instanceof Series ? s.toArray() : s).map((v) => v ?? NaN);
  const volume = bars.map((b) => b.volume ?? NaN);
  const close = bars.map((b) => b.close);
  const ohlc4 = bars.map((b) => (b.open + b.high + b.low + b.close) / 4);

  // calculations = close == high and close == low or high == low ? 0 : (2 * close - low - high) / (high - low) * volume
  const calc = bars.map((b, i) => ((eq(b.close, b.high) && eq(b.close, b.low)) || eq(b.high, b.low)
    ? 0 : ((2 * b.close - b.low - b.high) / (b.high - b.low)) * volume[i]));
  // trendstrength = math.sum(calculations, 1) / math.sum(volume, 1) (trendstrength2 is the same)
  const sumCalc = A(math.sum(calc, 1));
  const sumVol = A(math.sum(volume, 1));
  const strength = sumCalc.map((v, i) => v / sumVol[i]);

  // ta.change(x) <= 0 ? 0 : x (na on bar 0 compares false: the bar counts on both sides)
  const sides = (x: number[], len: number) => {
    const up = x.map((v, i) => volume[i] * (le(i > 0 ? v - x[i - 1] : NaN, 0) ? 0 : v));
    const down = x.map((v, i) => volume[i] * (ge(i > 0 ? v - x[i - 1] : NaN, 0) ? 0 : v));
    const top = A(math.sum(up, len));
    const low = A(math.sum(down, len));
    // paramaters(): the two `if` blocks have no effect; 100.0 - 100.0 / (1.0 + top / low)
    return top.map((t, i) => 100.0 - 100.0 / (1.0 + t / low[i]));
  };
  const trendline = sides(ohlc4, 8);
  const trendline2 = sides(close, 20);

  const plot0 = new Array(n);
  for (let i = 0; i < n; i++) {
    // combinedTrend = trendline + trendstrength / trendline2 + trendstrength2 (plain division: x / 0 is infinite)
    const combined = trendline[i] + strength[i] / trendline2[i] + strength[i];
    // color.new(color.from_gradient(combinedTrend, 30, 80, color.green, color.red), 0)
    const c = String(color.new(color.from_gradient(combined, 30, 80, color.green, color.red), 0));
    plot0[i] = { time: bars[i].time, value: Number.isFinite(combined) ? combined : NaN, color: c };
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
    hlines: hlineConfig.map((h) => ({ value: h.price, options: { title: h.title, color: h.color, linestyle: h.linestyle } })),
  };
}

export const TrendHeatmap = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
