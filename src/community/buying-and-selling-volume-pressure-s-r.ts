/**
 * Cumulative Buying and Selling Volume Pressure with Dynamic S/R
 *
 * Buying volume = volume * (close - low) / (high - low), selling volume = volume * (high - close) / (high - low)
 * (0 on a bar with high = low), summed over `lookback` bars (cum(x) - cum(x)[lookback], 0 while not available).
 * A cross of the buying sum above the selling sum starts a bullish trend and resets the support line to the low; a
 * cross below starts a bearish trend and resets the resistance line to the high. While the trend lasts, the support
 * follows the lowest low (bullish) and the resistance the highest high (bearish); otherwise they are kept. The mid
 * line is the SMA of the support / resistance midpoint, with standard deviation bands. Buy / Sell arrows when the
 * close crosses the mid line.
 *
 * Reference: "Cumulative Buying and Selling Volume Pressure with Dynamic S/R" by DinoTradez
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © DinoTradez
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface BuyingAndSellingVolumePressureSRInputs {
  /** SMA / standard deviation length of the mid line */
  length: number;
  /** Band width in standard deviations */
  devMultiplier: number;
  /** Number of bars of the buying / selling volume sums */
  lookback: number;
}

export const defaultInputs: BuyingAndSellingVolumePressureSRInputs = {
  length: 20,
  devMultiplier: 2.0,
  lookback: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Mid Line Length', defval: 20, min: 1 },
  { id: 'devMultiplier', type: 'float', title: 'Deviation Multiplier', defval: 2.0 },
  { id: 'lookback', type: 'int', title: 'Cumulative Lookback', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Support', color: color.green, lineWidth: 2 },
  { id: 'plot1', title: 'Resistance', color: color.red, lineWidth: 2 },
  { id: 'plot2', title: 'MidLine', color: color.white, lineWidth: 2 },
  { id: 'plot3', title: 'UpperLine', color: color.yellow, lineWidth: 2 },
  { id: 'plot4', title: 'LowerLine', color: color.yellow, lineWidth: 2 },
];

export const metadata = {
  title: 'Cumulative Buying and Selling Volume Pressure with Dynamic S/R',
  shortTitle: 'Cumulative Buying and Selling Volume Pressure with Dynamic S/R',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<BuyingAndSellingVolumePressureSRInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, devMultiplier, lookback } = cfg;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  // ta.cum of the buying / selling volume
  const cumBuy: number[] = new Array(n);
  const cumSell: number[] = new Array(n);
  let sb = 0;
  let ss = 0;
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const vol = b.volume ?? NaN;
    const denominator = b.high - b.low;
    // denominator != 0 (Pine ==: within 1e-10)
    const nonZero = !isNaN(denominator) && Math.abs(denominator) > EPS;
    const buying = nonZero ? (vol * (b.close - b.low)) / denominator : 0.0;
    const selling = nonZero ? (vol * (b.high - b.close)) / denominator : 0.0;
    // ta.cum skips na values (keeps the previous sum)
    if (!isNaN(buying)) sb += buying;
    if (!isNaN(selling)) ss += selling;
    cumBuy[i] = sb;
    cumSell[i] = ss;
  }
  const nz = (x: number) => (Number.isFinite(x) ? x : 0);
  const cBuy = cumBuy.map((v, i) => nz(i - lookback >= 0 ? v - cumBuy[i - lookback] : NaN));
  const cSell = cumSell.map((v, i) => nz(i - lookback >= 0 ? v - cumSell[i - lookback] : NaN));

  const support: number[] = new Array(n);
  const resistance: number[] = new Array(n);
  let trendState = 0; // var float trendState = 0
  let prevTrend = NaN; // trendState[1] (na on bar 0)
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const bullishCross = i > 0 && le(cBuy[i - 1], cSell[i - 1]) && gt(cBuy[i], cSell[i]);
    const bearishCross = i > 0 && ge(cBuy[i - 1], cSell[i - 1]) && lt(cBuy[i], cSell[i]);
    if (bullishCross) trendState = 1;
    else if (bearishCross) trendState = -1;
    else trendState = prevTrend; // trendState := trendState[1]

    const prevSupport = i > 0 ? support[i - 1] : NaN;
    if (bullishCross) support[i] = b.low;
    else if (eq(trendState, 1) && eq(prevTrend, 1)) support[i] = isNaN(prevSupport) ? b.low : Math.min(prevSupport, b.low);
    else if (isNaN(prevSupport)) support[i] = b.low;
    else support[i] = prevSupport;

    const prevResistance = i > 0 ? resistance[i - 1] : NaN;
    if (bearishCross) resistance[i] = b.high;
    else if (eq(trendState, -1) && eq(prevTrend, -1)) resistance[i] = isNaN(prevResistance) ? b.high : Math.max(prevResistance, b.high);
    else if (isNaN(prevResistance)) resistance[i] = b.high;
    else resistance[i] = prevResistance;

    prevTrend = trendState;
  }

  const rawMid = support.map((s, i) => (s + resistance[i]) / 2.0);
  const rawMidSeries = Series.fromArray(bars, rawMid);
  const mid = A(ta.sma(rawMidSeries, length));
  const sd = A(ta.stdev(rawMidSeries, length));
  const upper = mid.map((m, i) => m + devMultiplier * sd[i]);
  const lower = mid.map((m, i) => m - devMultiplier * sd[i]);

  const t = (i: number) => bars[i].time;
  const plot = (v: number[]) => v.map((x, i) => ({ time: t(i), value: Number.isFinite(x) ? x : NaN }));

  const markers: MarkerData[] = [];
  const textColor = color.blue; // Pine plotshape default text colour
  for (let i = 1; i < n; i++) {
    const c = bars[i].close;
    const c1 = bars[i - 1].close;
    if (le(c1, mid[i - 1]) && gt(c, mid[i])) {
      markers.push({ time: t(i), position: 'belowBar', shape: 'arrowUp', color: color.green, size: 'tiny', text: 'Buy', textColor });
    }
    if (ge(c1, mid[i - 1]) && lt(c, mid[i])) {
      markers.push({ time: t(i), position: 'aboveBar', shape: 'arrowDown', color: color.red, size: 'tiny', text: 'Sell', textColor });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: plot(support), plot1: plot(resistance), plot2: plot(mid), plot3: plot(upper), plot4: plot(lower) },
    markers,
  };
}

export const BuyingAndSellingVolumePressureSR = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
