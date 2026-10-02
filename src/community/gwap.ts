/**
 * GWAP (Gamma Weighted Average Price)
 *
 * A weighted average of the last `length` closes: the close of i bars ago has the weight gamma^i
 * (i = 0 .. length - 1), GWAP = sum(close[i] * gamma^i) / sum(gamma^i). It is na before bar `length`.
 *
 * Reference: "GWAP (Gamma Weighted Average Price)" by EdgeTools
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface GwapInputs {
  /** Number of closes in the average */
  length: number;
  /** Gamma weight factor: the close of i bars ago has the weight gammaFactor^i */
  gammaFactor: number;
}

export const defaultInputs: GwapInputs = {
  length: 14,
  gammaFactor: 0.92,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length for GWAP Calculation', defval: 14 },
  { id: 'gammaFactor', type: 'float', title: 'Gamma Weight Factor', defval: 0.92, min: 0.5, max: 1.5, step: 0.01 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Gamma Weighted Average Price', color: color.red, lineWidth: 1 },
];

export const metadata = {
  title: 'GWAP (Gamma Weighted Average Price)',
  shortTitle: 'GWAP',
  overlay: true,
};

/** Pine a != b: false when a and b are within 1e-10 (or one is na) */
const ne = (a: number, b: number) => Math.abs(a - b) > 1e-10;

export function calculate(bars: Bar[], inputs: Partial<GwapInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, gammaFactor } = cfg;
  // Pine runtime errors on bar 0: a negative length fails in array.new_float; with length 0, bar_index >= 0 and
  // `for i = 0 to -1` counts down, so array.set writes index 0 of the empty array
  if (length < 0) throw new Error('Cannot create an array with a negative size.');
  if (length === 0) throw new Error("In 'array.set()' function. Index 0 is out of bounds, array size is 0.");

  const plot0 = bars.map((b, bi) => {
    // gamma_weights = array.new_float(length, 0.0); price_series = array.new_float(length, na);
    // filled only when bar_index >= length
    const weights: number[] = new Array(length).fill(0.0);
    const prices: number[] = new Array(length).fill(NaN);
    if (bi >= length) {
      for (let i = 0; i < length; i++) {
        weights[i] = Math.pow(gammaFactor, i);
        prices[i] = bars[bi - i].close;
      }
    }
    let weightedSum = 0.0;
    let weightTotal = 0.0;
    for (let i = 0; i < length; i++) {
      weightedSum = weightedSum + prices[i] * weights[i];
      weightTotal = weightTotal + weights[i];
    }
    const gwap = ne(weightTotal, 0) ? weightedSum / weightTotal : NaN;
    return { time: b.time, value: Number.isFinite(gwap) ? gwap : NaN, color: color.red };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
  };
}

export const Gwap = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
