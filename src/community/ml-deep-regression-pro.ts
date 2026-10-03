/**
 * ML Deep Regression Pro
 *
 * Least-squares line over the last `length` closes, fitted with x = bars ago (0 = current bar), evaluated at
 * x = length - 1 (the oldest bar of the window) with explicit sums; the linear regression line (ta.linreg) of the
 * close at the current bar; optional bands at the first line +- multiplier * stdev(first line, length); an EMA of
 * the close. The "Polynomial Degree" input is not used by the computation.
 *
 * Reference: "ML Deep Regression Pro (TechnoBlooms)" by TechnoBlooms
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: This indicator is created under TechnoBlooms - Innovating Trading Indicators and Strategies.
 * All rights reserved. Unauthorized copying or distribution is prohibited. © TechnoBlooms
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface MlDeepRegressionProInputs {
  /** Lookback period of the regressions and of the band standard deviation */
  length: number;
  /** Polynomial degree (not used by the computation, as in the original script) */
  polyDegree: number;
  /** Standard deviation multiplier of the bands */
  stdDevMultiplier: number;
  /** EMA length */
  emaLength: number;
  /** Display the upper and lower bands */
  showBands: boolean;
}

export const defaultInputs: MlDeepRegressionProInputs = {
  length: 20,
  polyDegree: 1,
  stdDevMultiplier: 2.0,
  emaLength: 14,
  showBands: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Lookback Period', defval: 20 },
  { id: 'polyDegree', type: 'int', title: 'Polynomial Degree', defval: 1, min: 1, max: 5 },
  { id: 'stdDevMultiplier', type: 'float', title: 'Standard Deviation Multiplier', defval: 2.0 },
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 14 },
  { id: 'showBands', type: 'bool', title: 'Display Upper and Lower Bands', defval: false },
];

const POLY_COLOR = String(color.rgb(213, 255, 27));
const LINREG_COLOR = String(color.rgb(40, 255, 126));
const BAND_COLOR = String(color.rgb(231, 3, 201));
const EMA_COLOR = String(color.rgb(23, 255, 243));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Polynomial Regression Line', color: POLY_COLOR, lineWidth: 2 },
  { id: 'plot1', title: 'Linear Regression Line', color: LINREG_COLOR, lineWidth: 2 },
  { id: 'plot2', title: 'Upper Band', color: BAND_COLOR, lineWidth: 1 },
  { id: 'plot3', title: 'Lower Band', color: BAND_COLOR, lineWidth: 1 },
  { id: 'plot4', title: 'EMA', color: EMA_COLOR, lineWidth: 1 },
];

export const metadata = {
  title: 'ML Deep Regression Pro (TechnoBlooms)',
  shortTitle: 'ML Deep Regression Pro (TechnoBlooms)',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<MlDeepRegressionProInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const { length: len, stdDevMultiplier, emaLength, showBands } = cfg;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const close = bars.map((b) => b.close);
  const closeS = S(close);
  const at = (i: number) => (i >= 0 ? close[i] : NaN);

  // fun_PRegression(close, length): sums over i = 0 .. len - 1 of i, src[i], i * src[i], i * i (na before bar 0)
  const poly: number[] = new Array(n);
  for (let b = 0; b < n; b++) {
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    const step = len - 1 >= 0 ? 1 : -1; // `for i = 0 to len - 1` counts down when len - 1 < 0
    for (let i = 0; step > 0 ? i <= len - 1 : i >= len - 1; i += step) {
      sumX = sumX + i;
      sumY = sumY + at(b - i);
      sumXY = sumXY + i * at(b - i);
      sumX2 = sumX2 + i * i;
    }
    // Plain divisions: x / 0 is +-infinity, 0 / 0 na, as in Pine
    const denom = len * sumX2 - sumX * sumX;
    const slope = (len * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / len;
    poly[b] = slope * (len - 1) + intercept;
  }

  // fun_STDevBands(polyRegression, length, multiplier)
  const sd = A(ta.stdev(S(poly), len));
  const linreg = A(ta.linreg(closeS, len, 0));
  const ema = A(ta.ema(closeS, emaLength));
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: fin(poly[i]), color: POLY_COLOR })),
      plot1: bars.map((b, i) => ({ time: b.time, value: fin(linreg[i]), color: LINREG_COLOR })),
      plot2: bars.map((b, i) => ({ time: b.time, value: showBands ? fin(poly[i] + sd[i] * stdDevMultiplier) : NaN, color: BAND_COLOR })),
      plot3: bars.map((b, i) => ({ time: b.time, value: showBands ? fin(poly[i] - sd[i] * stdDevMultiplier) : NaN, color: BAND_COLOR })),
      plot4: bars.map((b, i) => ({ time: b.time, value: fin(ema[i]), color: EMA_COLOR })),
    },
  };
}

export const MlDeepRegressionPro = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
