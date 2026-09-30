/**
 * AI Breakout Bands
 *
 * A two-state (position, velocity) Kalman filter of the close, smoothed by a k-neighbour average of its previous
 * `klen` values weighted by 1 / (|current - past| + 1e-6). Bands: the smoothed line +/- multiplier * mean absolute
 * error of the close around it (SMA over the band lookback), filled to the line. The line colour is the positive
 * colour when the close is above the upper band, the negative colour when it is below the lower band, otherwise the
 * sign of the slope of the smoothed line (linear regression at offset 0 minus offset 1).
 *
 * Reference: "AI Breakout Bands (Zeiierman)" by Zeiierman
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface AIBreakoutBandsInputs {
  /** Process noise of the position state */
  processNoisePos: number;
  /** Process noise of the velocity state */
  processNoiseVel: number;
  /** Measurement noise (R) */
  measurementNoise: number;
  /** Number of past Kalman estimates of the k-neighbour smoothing */
  klen: number;
  /** Linear regression length of the slope */
  slopeWindow: number;
  /** SMA length of the mean absolute error (band width) */
  bandLookback: number;
  /** Multiplier of the mean absolute error */
  bandMultiplier: number;
  /** Bullish colour (upper band) */
  colPos: string;
  /** Bearish colour (lower band) */
  colNeg: string;
}

export const defaultInputs: AIBreakoutBandsInputs = {
  processNoisePos: 0.02,
  processNoiseVel: 0.001,
  measurementNoise: 200,
  klen: 10,
  slopeWindow: 20,
  bandLookback: 100,
  bandMultiplier: 2.1,
  colPos: '#00bcd4',
  colNeg: '#2962ff',
};

export const inputConfig: InputConfig[] = [
  { id: 'processNoisePos', type: 'float', title: 'Process Noise (Position)', defval: 0.02, min: 0.0001, step: 0.1 },
  { id: 'processNoiseVel', type: 'float', title: 'Process Noise (Velocity)', defval: 0.001, min: 0.00001, step: 0.01 },
  { id: 'measurementNoise', type: 'float', title: 'Measurement Noise (R)', defval: 200, min: 1 },
  { id: 'klen', type: 'int', title: 'K-Neighbor Length', defval: 10, min: 1 },
  { id: 'slopeWindow', type: 'int', title: 'Slope Calculation Window', defval: 20, min: 1 },
  { id: 'bandLookback', type: 'int', title: 'Band Lookback (MAE)', defval: 100, min: 1 },
  { id: 'bandMultiplier', type: 'float', title: 'Band Multiplier', defval: 2.1, step: 0.1 },
  { id: 'colPos', type: 'color', title: 'Positive Color', defval: '#00bcd4' },
  { id: 'colNeg', type: 'color', title: 'Negative Color', defval: '#2962ff' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Smoothed Kalman Base', color: '#2962ff00', lineWidth: 1 },
  { id: 'plot1', title: 'Smoothed Kalman Trend', color: '#00bcd4', lineWidth: 2 },
  { id: 'plot2', title: 'Upper Band', color: '#00bcd4', lineWidth: 1 },
  { id: 'plot3', title: 'Lower Band', color: '#2962ff', lineWidth: 1 },
];

export const metadata = {
  title: 'AI Breakout Bands',
  shortTitle: 'AI Breakout Bands',
  overlay: true,
};

/** Pine float comparison: a > b only when a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;

export function calculate(
  bars: Bar[],
  inputs: Partial<AIBreakoutBandsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const { processNoisePos, processNoiseVel, measurementNoise, klen, slopeWindow, bandLookback, bandMultiplier, colPos, colNeg } = cfg;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const close = bars.map((b) => b.close);

  // Kalman state (var), set to [close, 0] and the identity covariance on the first bar
  const xp: number[] = new Array(n);
  let x_p = NaN;
  let x_v = NaN;
  let p00 = NaN;
  let p01 = NaN;
  let p10 = NaN;
  let p11 = NaN;
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      x_p = close[0];
      x_v = 0.0;
      p00 = 1.0;
      p01 = 0.0;
      p10 = 0.0;
      p11 = 1.0;
    }
    // f_kalman(close, x_p, x_v, p00, p01, p10, p11)
    const z = close[i];
    const predP = x_p + x_v;
    const predV = x_v;
    const a00 = p00 + p10;
    const a01 = p01 + p11;
    const a10 = p10;
    const a11 = p11;
    const q00 = a00 + a01 + processNoisePos;
    const q01 = a01;
    const q10 = a10 + a11;
    const q11 = a11 + processNoiseVel;
    const y = z - predP;
    const s = q00 + measurementNoise;
    const k0 = q00 / s;
    const k1 = q10 / s;
    x_p = predP + k0 * y;
    x_v = predV + k1 * y;
    p00 = (1 - k0) * q00;
    p01 = (1 - k0) * q01;
    p10 = -k1 * q00 + q10;
    p11 = -k1 * q01 + q11;
    xp[i] = x_p;
  }

  // f_knn_smooth(x_p, klen): src[i] is na before the first bar, and sumW += na makes sumW na (result: curr)
  const smooth = xp.map((curr, i) => {
    let sumW = 0.0;
    let sumX = 0.0;
    for (let k = 1; k <= klen; k++) {
      const xi = i - k >= 0 ? xp[i - k] : NaN;
      const dist = Math.abs(curr - xi) + 1e-6;
      const w = 1.0 / dist;
      sumW += w;
      sumX += xi * w;
    }
    return gt(sumW, 0) ? sumX / sumW : curr;
  });

  // slope = ta.linreg(smoothKalman, slope_window, 0) - ta.linreg(smoothKalman, slope_window, 1)
  const lr0 = A(ta.linreg(S(smooth), slopeWindow, 0));
  const lr1 = A(ta.linreg(S(smooth), slopeWindow, 1));
  // mae = ta.sma(math.abs(close - smoothKalman), bandLookback)
  const mae = A(ta.sma(S(close.map((c, i) => Math.abs(c - smooth[i]))), bandLookback));
  const upper = smooth.map((v, i) => v + bandMultiplier * mae[i]);
  const lower = smooth.map((v, i) => v - bandMultiplier * mae[i]);

  // mainCol = close > upperBand ? colPos : close < lowerBand ? colNeg : (slope > 0 ? colPos : colNeg)
  const mainCol = bars.map((_, i) => {
    if (gt(close[i], upper[i])) return colPos;
    if (gt(lower[i], close[i])) return colNeg;
    return gt(lr0[i] - lr1[i], 0) ? colPos : colNeg;
  });

  const upCol = String(color.new(colPos, 75));
  const dnCol = String(color.new(colNeg, 75));
  const upFill = String(color.new(colPos, 90));
  const dnFill = String(color.new(colNeg, 90));
  const baseCol = String(color.new(color.blue, 100));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      // p_base = plot(smoothKalman, color = color.new(color.blue, 100))
      plot0: bars.map((b, i) => ({ time: b.time, value: smooth[i], color: baseCol })),
      // plot(smoothKalman, color = mainCol, linewidth = 2)
      plot1: bars.map((b, i) => ({ time: b.time, value: smooth[i], color: mainCol[i] })),
      // p_up = plot(upperBand, color = color.new(colPos, 75)); p_down = plot(lowerBand, color = color.new(colNeg, 75))
      plot2: bars.map((b, i) => ({ time: b.time, value: upper[i], color: upCol })),
      plot3: bars.map((b, i) => ({ time: b.time, value: lower[i], color: dnCol })),
    },
    // fill(p_base, p_up, color.new(colPos, 90)); fill(p_base, p_down, color.new(colNeg, 90))
    fills: [
      { plot1: 'plot0', plot2: 'plot2', colors: new Array<string>(n).fill(upFill) },
      { plot1: 'plot0', plot2: 'plot3', colors: new Array<string>(n).fill(dnFill) },
    ],
    markers: [],
  };
}

export const AIBreakoutBands = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
