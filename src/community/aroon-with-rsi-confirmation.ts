/**
 * Aroon with RSI Confirmation (92.86%)
 *
 * Aroon up / down over length + 1 bars: 100 * (highestbars(high) + length) / length and the same with lowestbars(low).
 * A buy circle is drawn below the bar when Aroon down is 92.86 within the tolerance, the RSI is above its SMA and
 * the distance between the RSI and its SMA is at most the threshold. A sell circle is drawn above the bar when Aroon
 * up is 92.86 within the tolerance, the RSI is below its SMA and the distance is at most the threshold. The two Aroon
 * lines are hidden plots.
 *
 * Reference: "Aroon with RSI Confirmation (92.86%)" by jaydipali622018
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface AroonWithRsiConfirmationInputs {
  /** Aroon length */
  length: number;
  /** RSI length */
  rsiLength: number;
  /** SMA length of the RSI */
  smoothLength: number;
  /** Maximum distance between the RSI and its SMA (points) */
  diffThreshold: number;
  /** Tolerance around the Aroon level 92.86 */
  tolerance: number;
}

export const defaultInputs: AroonWithRsiConfirmationInputs = {
  length: 14,
  rsiLength: 14,
  smoothLength: 14,
  diffThreshold: 4.6,
  tolerance: 0.2,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Aroon Length', defval: 14, min: 1 },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'smoothLength', type: 'int', title: 'Smoothed RSI Length', defval: 14, min: 1 },
  { id: 'diffThreshold', type: 'float', title: 'Max RSI Difference (pts)', defval: 4.6 },
  { id: 'tolerance', type: 'float', title: 'Aroon 92.86 Tolerance ±', defval: 0.2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Aroon Up', color: color.orange, lineWidth: 1, display: 'none' },
  { id: 'plot1', title: 'Aroon Down', color: color.blue, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Aroon with RSI Confirmation (92.86%)',
  shortTitle: 'Aroon+RSI',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

export function calculate(
  bars: Bar[],
  inputs: Partial<AroonWithRsiConfirmationInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const { length } = cfg;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  const hb = A(ta.highestbars(S(bars.map((b) => b.high)), length + 1));
  const lb = A(ta.lowestbars(S(bars.map((b) => b.low)), length + 1));
  const upper = hb.map((v) => (100 * (v + length)) / length);
  const lower = lb.map((v) => (100 * (v + length)) / length);

  const rsi = A(ta.rsi(S(bars.map((b) => b.close)), cfg.rsiLength));
  const smoothRsi = A(ta.sma(S(rsi), cfg.smoothLength));

  const markers: MarkerData[] = [];
  const buyColor = String(color.new(color.green, 0));
  const sellColor = String(color.new(color.red, 0));
  for (let i = 0; i < bars.length; i++) {
    const rsiDiff = Math.abs(rsi[i] - smoothRsi[i]);
    const aroonUpHit = le(Math.abs(upper[i] - 92.86), cfg.tolerance);
    const aroonDownHit = le(Math.abs(lower[i] - 92.86), cfg.tolerance);
    const buyCond = aroonDownHit && le(rsiDiff, cfg.diffThreshold) && gt(rsi[i], smoothRsi[i]);
    const sellCond = aroonUpHit && le(rsiDiff, cfg.diffThreshold) && lt(rsi[i], smoothRsi[i]);
    // plotshape(..., style = shape.circle, size = size.small, text = "BUY" / "SELL"); default text colour (blue)
    if (buyCond) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'circle', color: buyColor, size: 'small',
        text: 'BUY', textColor: color.blue });
    }
    if (sellCond) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'circle', color: sellColor, size: 'small',
        text: 'SELL', textColor: color.blue });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: upper[i], color: color.orange })),
      plot1: bars.map((b, i) => ({ time: b.time, value: lower[i], color: color.blue })),
    },
    markers,
  };
}

export const AroonWithRsiConfirmation = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
