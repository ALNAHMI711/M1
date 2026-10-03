/**
 * VolVol
 *
 * Direction: the z-score of the close (100 * (close - EMA) / stdev), smoothed by two SMAs. Intensity: the same
 * z-score of the low (when the direction is positive) or of the high, smoothed by two EMAs of length / 2. Momentum:
 * the EMA of the balance of up-close and down-close volume of the last `length` bars, weighted by (length - i)^2.
 * The three lines are drawn on the price scale. A sum of intensity and momentum above 50 (below -50) is a spike.
 * Squares mark exits (a spike against the direction), triangles mark adds and circles mark new entries.
 *
 * Reference: "VolVol" by kunalgolani
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © kunalgolani
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface VolVolInputs {
  /** Length of the EMA / stdev / SMA (the intensity and momentum EMAs use length / 2) */
  length: number;
}

export const defaultInputs: VolVolInputs = {
  length: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 5 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Direction', color: String(color.rgb(62, 228, 98, 92)), lineWidth: 1, style: 'area' },
  { id: 'plot1', title: 'Intensity', color: String(color.rgb(33, 243, 233)), lineWidth: 1 },
  { id: 'plot2', title: 'Momentum', color: String(color.rgb(225, 29, 247, 19)), lineWidth: 1 },
];

export const metadata = {
  title: 'VolVol',
  shortTitle: 'VolVol',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<VolVolInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const len = cfg.length;
  // Pine v6: length / 2 keeps the fraction (2.5 for 5)
  const half = len / 2;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

  // raw_direction = 100 * (close - ta.ema(close, length)) / ta.stdev(close, length) (plain division)
  const close = S(bars.map((b) => b.close));
  const emaC = A(ta.ema(close, len));
  const sdC = A(ta.stdev(close, len));
  const rawDirection = bars.map((b, i) => (100 * (b.close - emaC[i])) / sdC[i]);
  const direction = A(ta.sma(ta.sma(S(rawDirection), len), len));

  // source = direction > 0 ? low : high
  const source = bars.map((b, i) => (gt(direction[i], 0) ? b.low : b.high));
  const srcS = S(source);
  const emaS = A(ta.ema(srcS, len));
  const sdS = A(ta.stdev(srcS, len));
  const rawIntensity = source.map((v, i) => (100 * (v - emaS[i])) / sdS[i]);
  const intensity = A(ta.ema(ta.ema(S(rawIntensity), half), half));

  const rawMomentum: number[] = new Array(n);
  for (let k = 0; k < n; k++) {
    let bull = 0;
    let bear = 0;
    for (let i = 0; i <= len - 1; i++) {
      const c0 = k - i >= 0 ? bars[k - i].close : NaN;
      const c1 = k - i - 1 >= 0 ? bars[k - i - 1].close : NaN;
      const vol = k - i >= 0 ? (bars[k - i].volume ?? NaN) : NaN;
      // na compares false: the else branch adds the volume (na volume makes the sum na)
      if (gt(c0, c1)) bull += vol * (len - i) * (len - i);
      else bear += vol * (len - i) * (len - i);
    }
    rawMomentum[k] = (100 * (bull - bear)) / (bull + bear);
  }
  const momentum = A(ta.ema(S(rawMomentum), half));

  const posCol = String(color.rgb(62, 228, 98, 92));
  const negCol = String(color.rgb(228, 62, 68, 92));
  const plot0 = bars.map((b, i) => ({ time: b.time, value: fin(direction[i]), color: gt(direction[i], 0) ? posCol : negCol }));
  const plot1 = bars.map((b, i) => ({ time: b.time, value: fin(intensity[i]) }));
  // plot(momentum == 0 ? intensity : momentum)
  const plot2 = bars.map((b, i) => ({ time: b.time, value: fin(eq(momentum[i], 0) ? intensity[i] : momentum[i]) }));

  const sum = (i: number) => (i >= 0 ? intensity[i] + momentum[i] : NaN);
  const bullSpike = (i: number) => gt(sum(i), 50);
  const bearSpike = (i: number) => lt(sum(i), -50);
  const bullEntry = (i: number) => i >= 0 && gt(sum(i), sum(i - 1)) && (gt(direction[i], direction[i - 1]) || bullSpike(i));
  const bearEntry = (i: number) => i >= 0 && lt(sum(i), sum(i - 1)) && (lt(direction[i], direction[i - 1]) || bearSpike(i));

  const markers: MarkerData[] = [];
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    const up = gt(direction[i], 0);
    const down = lt(direction[i], 0);
    // bullish_exit = direction > 0 and bearish_spike and not bearish_spike[1]
    if (up && bearSpike(i) && !bearSpike(i - 1)) {
      markers.push({ time: t, position: 'belowBar', shape: 'square', color: color.red, forceOverlay: true });
    }
    if (down && bullSpike(i) && !bullSpike(i - 1)) {
      markers.push({ time: t, position: 'aboveBar', shape: 'square', color: color.green, forceOverlay: true });
    }
    // bullish_add = direction > 0 and ((bearish_spike[1] and not bearish_spike) or (intensity < 0 and momentum > 0))
    if (up && ((bearSpike(i - 1) && !bearSpike(i)) || (lt(intensity[i], 0) && gt(momentum[i], 0)))) {
      markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: color.green, forceOverlay: true });
    }
    if (down && ((bullSpike(i - 1) && !bullSpike(i)) || (gt(intensity[i], 0) && lt(momentum[i], 0)))) {
      markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: color.red, forceOverlay: true });
    }
    // plotshape(bullish_entry and not bullish_entry[1], "LONG", shape.circle)
    if (bullEntry(i) && !bullEntry(i - 1)) {
      markers.push({ time: t, position: 'belowBar', shape: 'circle', color: color.green, forceOverlay: true });
    }
    if (bearEntry(i) && !bearEntry(i - 1)) {
      markers.push({ time: t, position: 'aboveBar', shape: 'circle', color: color.red, forceOverlay: true });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2 },
    markers,
  };
}

export const VolVol = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
