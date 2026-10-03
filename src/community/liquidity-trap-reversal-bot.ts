/**
 * 111% Liquidity Trap & Reversal
 *
 * The last pivot high and pivot low (lookback on both sides) define a swing range. Extensions of 11 %, 13 % and
 * 27.2 % of the range are drawn above the pivot high and below the pivot low, with a fill between the 111 % and
 * 113 % levels (trap zones). A short trap is armed when the high reaches the 111 % high extension (disarmed by a new
 * pivot high); the close then crossing under the pivot high gives a short reversal arrow. A long trap is the mirror
 * on the low side. Breakout / breakdown arrows mark the close crossing above the pivot high / below the pivot low.
 *
 * Reference: "Liquidity Trap & Reversal bot [Point algo]" by pointalgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, callsite, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface LiquidityTrapReversalBotInputs {
  /** Pivot lookback (left and right bars) */
  pivLen: number;
}

export const defaultInputs: LiquidityTrapReversalBotInputs = {
  pivLen: 15,
};

export const inputConfig: InputConfig[] = [
  { id: 'pivLen', type: 'int', title: 'Pivot Lookback', defval: 15 },
];

const RED_60 = String(color.new(color.red, 60));
const LIME_60 = String(color.new(color.lime, 60));
const MAROON = String(color.new(color.maroon, 0));
const GREEN = String(color.new(color.green, 0));
const GRAY_50 = String(color.new(color.gray, 50));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'High 111%', color: RED_60, lineWidth: 1, style: 'stepline' },
  { id: 'plot1', title: 'High 113%', color: RED_60, lineWidth: 1, style: 'stepline' },
  { id: 'plot2', title: 'High 127.2%', color: MAROON, lineWidth: 2, style: 'stepline' },
  { id: 'plot3', title: 'Low 111%', color: LIME_60, lineWidth: 1, style: 'stepline' },
  { id: 'plot4', title: 'Low 113%', color: LIME_60, lineWidth: 1, style: 'stepline' },
  { id: 'plot5', title: 'Low 127.2%', color: GREEN, lineWidth: 2, style: 'stepline' },
  { id: 'plot6', title: 'Pivot High 100%', color: GRAY_50, lineWidth: 1, style: 'stepline' },
  { id: 'plot7', title: 'Pivot Low 100%', color: GRAY_50, lineWidth: 1, style: 'stepline' },
];

export const metadata = {
  title: '111% Liquidity Trap & Reversal [Quant]',
  shortTitle: '111% Liquidity Trap & Reversal [Quant]',
  overlay: true,
};

/** Pine float comparisons: a >= b unless b - a > 1e-10 (na compares false) */
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(b - a > 1e-10);
const le = (a: number, b: number) => ge(b, a);

export function calculate(
  bars: Bar[],
  inputs: Partial<LiquidityTrapReversalBotInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const len = cfg.pivLen;

  const ph = A(ta.pivothigh(S(bars.map((b) => b.high)), len, len));
  const pl = A(ta.pivotlow(S(bars.map((b) => b.low)), len, len));

  // Pine v6 `and` is lazy: each crossing only runs on the bars where its left operand is true (one call site each)
  const shortCross = callsite.crossunder();
  const longCross = callsite.crossover();
  const breakoutCross = callsite.crossover();
  const breakdownCross = callsite.crossunder();

  const keys = ['plot0', 'plot1', 'plot2', 'plot3', 'plot4', 'plot5', 'plot6', 'plot7'];
  const colors = [RED_60, RED_60, MAROON, LIME_60, LIME_60, GREEN, GRAY_50, GRAY_50];
  const plots: Record<string, { time: number; value: number; color: string }[]> = {};
  keys.forEach((k) => { plots[k] = []; });
  const markers: MarkerData[] = [];

  let lastPh = NaN;
  let lastPl = NaN;
  let swingRange = NaN;
  let shortArmed = false;
  let longArmed = false;
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    if (!Number.isNaN(ph[i])) {
      lastPh = ph[i];
      if (!Number.isNaN(lastPl)) swingRange = Math.abs(lastPh - lastPl);
    }
    if (!Number.isNaN(pl[i])) {
      lastPl = pl[i];
      if (!Number.isNaN(lastPh)) swingRange = Math.abs(lastPh - lastPl);
    }

    const extH111 = lastPh + swingRange * 0.11;
    const extH113 = lastPh + swingRange * 0.13;
    const extH127 = lastPh + swingRange * 0.272;
    const extL111 = lastPl - swingRange * 0.11;
    const extL113 = lastPl - swingRange * 0.13;
    const extL127 = lastPl - swingRange * 0.272;

    const hasSwing = !Number.isNaN(swingRange);
    const values = [extH111, extH113, extH127, extL111, extL113, extL127, lastPh, lastPl];
    keys.forEach((k, j) => {
      plots[k].push({ time: b.time, value: hasSwing ? values[j] : NaN, color: colors[j] });
    });

    // Signal engine: turtle soup reversal
    if (ge(b.high, extH111)) shortArmed = true;
    if (!Number.isNaN(ph[i])) shortArmed = false;
    const shortSignal = shortArmed && shortCross(b.close, lastPh);
    if (shortSignal) shortArmed = false;

    if (le(b.low, extL111)) longArmed = true;
    if (!Number.isNaN(pl[i])) longArmed = false;
    const longSignal = longArmed && longCross(b.close, lastPl);
    if (longSignal) longArmed = false;

    const breakout = hasSwing && breakoutCross(b.close, lastPh);
    const breakdown = hasSwing && breakdownCross(b.close, lastPl);

    // plotshape (Pine default text colour: blue)
    if (longSignal) {
      markers.push({ time: b.time, position: 'belowBar', shape: 'arrowUp', color: String(color.new(color.lime, 0)),
        text: 'REVERSAL', textColor: color.blue, size: 'normal' });
    }
    if (shortSignal) {
      markers.push({ time: b.time, position: 'aboveBar', shape: 'arrowDown', color: String(color.new(color.red, 0)),
        text: 'REVERSAL', textColor: color.blue, size: 'normal' });
    }
    if (breakout) {
      markers.push({ time: b.time, position: 'belowBar', shape: 'arrowUp', color: String(color.new(color.aqua, 0)),
        text: 'BO', textColor: color.blue, size: 'small' });
    }
    if (breakdown) {
      markers.push({ time: b.time, position: 'aboveBar', shape: 'arrowDown', color: String(color.new(color.orange, 0)),
        text: 'BD', textColor: color.blue, size: 'small' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills: [
      { plot1: 'plot0', plot2: 'plot1', options: { color: String(color.new(color.red, 85)), title: 'Short Trap Zone' } },
      { plot1: 'plot3', plot2: 'plot4', options: { color: String(color.new(color.lime, 85)), title: 'Long Trap Zone' } },
    ],
    markers,
  };
}

export const LiquidityTrapReversalBot = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
