/**
 * CVD Reversal Divergence
 *
 * Cumulative volume delta (CVD): the running sum of + volume on up candles and - volume on down candles. On each
 * confirmed pivot high (pivot low) of price, the high (low) and the CVD at the pivot are compared with the previous
 * pivot: a higher high with a lower CVD, or a lower high with a higher CVD, is a bearish exhaustion (red triangle
 * above the pivot bar); a lower low with a higher CVD, or a higher low with a lower CVD, is a bullish exhaustion
 * (green triangle below the pivot bar). Pre-alerts (faint crosses) mark a bar that makes the highest high (lowest
 * low) of the last lookback + 1 bars, optionally only with a reversal candle and an early CVD divergence against the
 * last pivot.
 *
 * Reference: "CVD Reversal Divergence (Clean & Optimized)" by somnacin
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface CvdReversalDivergenceInputs {
  /** Pivot left / right bars */
  lookback: number;
  /** Show the potential reversal pre-alerts (crosses) */
  showPreAlert: boolean;
  /** Filter 1: a bearish candle for a top pre-alert, a bullish candle for a bottom pre-alert */
  usePAFilter: boolean;
  /** Filter 2: the CVD diverges from the CVD at the last pivot */
  useEarlyDivFilter: boolean;
}

export const defaultInputs: CvdReversalDivergenceInputs = {
  lookback: 10,
  showPreAlert: true,
  usePAFilter: true,
  useEarlyDivFilter: true,
};

const GRP = 'Pre-Alert Noise Reduction Filters';

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'Pivot Confirmation Period (Lookback)', defval: 10, min: 2 },
  { id: 'showPreAlert', type: 'bool', title: 'Show Potential Reversal Pre-Alerts (faint X marks)', defval: true, group: GRP },
  { id: 'usePAFilter', type: 'bool', title: 'Filter 1: Require candle reversal character (bearish close at highs / bullish close at lows)', defval: true, group: GRP },
  { id: 'useEarlyDivFilter', type: 'bool', title: "Filter 2: Require 'early divergence' character", defval: true, group: GRP },
];

/** No plot: the outputs are the shape markers */
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'CVD Reversal Divergence (Clean & Optimized)',
  shortTitle: 'CVD Reversal Divergence (Clean & Optimized)',
  overlay: true,
};

/** Pine a > b: a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;
/** Pine a < b */
const lt = (a: number, b: number) => b - a > 1e-10;
/** Pine a == b: within 1e-10, false with na */
const eq = (a: number, b: number) => Math.abs(a - b) <= 1e-10;

export function calculate(
  bars: Bar[],
  inputs: Partial<CvdReversalDivergenceInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const lb = cfg.lookback;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const high = Series.fromArray(bars, bars.map((b) => b.high));
  const low = Series.fromArray(bars, bars.map((b) => b.low));

  // delta = volume * (close > open ? 1 : close < open ? -1 : 0); cvd = ta.cum(delta)
  const delta = bars.map((b) => (b.volume ?? NaN) * (gt(b.close, b.open) ? 1 : lt(b.close, b.open) ? -1 : 0));
  const cvd = A(ta.cum(Series.fromArray(bars, delta)));
  const ph = A(ta.pivothigh(high, lb, lb));
  const pl = A(ta.pivotlow(low, lb, lb));
  const hh = A(ta.highest(high, lb + 1));
  const ll = A(ta.lowest(low, lb + 1));

  const preHighColor = String(color.new(color.red, 70));
  const preLowColor = String(color.new(color.green, 70));

  let lastPhPrice = NaN;
  let lastPhCvd = NaN;
  let lastPlPrice = NaN;
  let lastPlCvd = NaN;
  const markers: MarkerData[] = [];
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    // Pre-alerts (read the pivot records before this bar updates them)
    const isPotentialPHRaw = eq(b.high, hh[i]);
    const isPotentialPLRaw = eq(b.low, ll[i]);
    const paPH = !cfg.usePAFilter || lt(b.close, b.open);
    const paPL = !cfg.usePAFilter || gt(b.close, b.open);
    const earlyBearDiv = !cfg.useEarlyDivFilter || isNaN(lastPhCvd) || lt(cvd[i], lastPhCvd);
    const earlyBullDiv = !cfg.useEarlyDivFilter || isNaN(lastPlCvd) || gt(cvd[i], lastPlCvd);
    // plotshape(showPreAlert and isPotentialPH, "Potential High", shape.xcross, location.abovebar, color.new(red, 70), size.tiny)
    if (cfg.showPreAlert && isPotentialPHRaw && paPH && earlyBearDiv) {
      markers.push({ time: b.time, position: 'aboveBar', shape: 'xcross', color: preHighColor, size: 'tiny' });
    }
    if (cfg.showPreAlert && isPotentialPLRaw && paPL && earlyBullDiv) {
      markers.push({ time: b.time, position: 'belowBar', shape: 'xcross', color: preLowColor, size: 'tiny' });
    }

    // Confirmed divergences: high[lookback], low[lookback], cvd[lookback] are the values at the pivot bar
    let isBearExhaustion = false;
    let isBullExhaustion = false;
    if (!isNaN(ph[i])) {
      const hP = bars[i - lb].high;
      const cP = cvd[i - lb];
      const hasPrev = !isNaN(lastPhPrice) && !isNaN(lastPhCvd);
      const c1 = hasPrev && gt(hP, lastPhPrice) && lt(cP, lastPhCvd);
      const c2 = hasPrev && lt(hP, lastPhPrice) && gt(cP, lastPhCvd);
      if (c1 || c2) isBearExhaustion = true;
      lastPhPrice = hP;
      lastPhCvd = cP;
    }
    if (!isNaN(pl[i])) {
      const lP = bars[i - lb].low;
      const cP = cvd[i - lb];
      const hasPrev = !isNaN(lastPlPrice) && !isNaN(lastPlCvd);
      const c3 = hasPrev && lt(lP, lastPlPrice) && gt(cP, lastPlCvd);
      const c4 = hasPrev && gt(lP, lastPlPrice) && lt(cP, lastPlCvd);
      if (c3 || c4) isBullExhaustion = true;
      lastPlPrice = lP;
      lastPlCvd = cP;
    }
    // plotshape(..., offset = -lookback): drawn on the pivot bar i - lookback
    if (isBullExhaustion) {
      markers.push({ time: bars[i - lb].time, position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'small' });
    }
    if (isBearExhaustion) {
      markers.push({ time: bars[i - lb].time, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'small' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
  };
}

export const CvdReversalDivergence = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
