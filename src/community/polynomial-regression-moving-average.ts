/**
 * Polynomial Regression Moving Average (PRMA)
 *
 * On the first bar, an OLS kernel is built for a polynomial of `degree` fitted on `length` points
 * (x = 0 .. length - 1): kernel = x_last * (X'X)^-1 * X', with X the Vandermonde matrix and x_last the powers of
 * length - 1. A fractional degree blends the kernels of the two nearest integer degrees. On each bar with
 * `length` bars of history, the prediction is the kernel weighted sum of the last `length` source values (0 before).
 * The prediction is smoothed 1 to 10 times with the chosen method (SMA, EMA, WMA, RMA, HMA, DEMA, TEMA, VWMA,
 * Gaussian or none). The line is green when it rises and fuchsia otherwise. A turn up with the close above the line
 * gives an "L" label below the bar; a turn down with the close below the line gives an "S" label above the bar.
 *
 * Reference: "Polynomial Regression Moving Average (PRMA)" by ZakAlgoTrade
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: @ ZakAlgoTrade
 */

import {
  ta, Series, getSourceSeries, color, matrix, math, type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
  type SourceType, type PineMatrix,
} from 'oakscriptjs';
import type { MarkerData } from '../types';

type SmoothType = 'None' | 'SMA' | 'EMA' | 'WMA' | 'RMA' | 'HMA' | 'DEMA' | 'TEMA' | 'VWMA' | 'Gaussian';

export interface PolynomialRegressionMovingAverageInputs {
  source: SourceType;
  /** Regression period */
  length: number;
  /** Polynomial degree (a fractional degree blends two kernels) */
  degree: number;
  colorUp: string;
  colorDn: string;
  /** Smoothing method */
  smoothType: SmoothType;
  /** Smoothing length */
  smoothLen: number;
  /** Number of times the smoothing is applied (1 to 10) */
  smoothIter: number;
  /** Show the L / S signals */
  showSig: boolean;
}

export const defaultInputs: PolynomialRegressionMovingAverageInputs = {
  source: 'close',
  length: 100,
  degree: 4.0,
  colorUp: 'rgb(36, 223, 23)',
  colorDn: color.fuchsia,
  smoothType: 'EMA',
  smoothLen: 5,
  smoothIter: 1,
  showSig: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'length', type: 'int', title: 'Period', defval: 100, min: 2 },
  { id: 'degree', type: 'float', title: 'Degree', defval: 4.0, min: 1.0, step: 0.1 },
  { id: 'colorUp', type: 'color', title: 'Up', defval: 'rgb(36, 223, 23)' },
  { id: 'colorDn', type: 'color', title: 'Down', defval: color.fuchsia },
  {
    id: 'smoothType', type: 'string', title: 'Smoothing Method', defval: 'EMA',
    options: ['None', 'SMA', 'EMA', 'WMA', 'RMA', 'HMA', 'DEMA', 'TEMA', 'VWMA', 'Gaussian'],
  },
  { id: 'smoothLen', type: 'int', title: 'Smoothing Length', defval: 5, min: 1 },
  { id: 'smoothIter', type: 'int', title: 'Smoothing Iterations', defval: 1, min: 1, max: 10 },
  { id: 'showSig', type: 'bool', title: 'Show Signals', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'PRMA', color: 'rgb(36, 223, 23)', lineWidth: 2 },
];

export const metadata = {
  title: 'Polynomial Regression Moving Average (PRMA)',
  shortTitle: 'Polynomial Regression Moving Average (PRMA)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** get_ols_weights(length, deg): x_last * (X'X)^-1 * X' (1 x length matrix) */
function olsWeights(length: number, deg: number): PineMatrix<number> {
  const X = matrix.new_matrix<number>(length, deg + 1, 0.0);
  for (let i = 0; i < length; i++) {
    for (let j = 0; j <= deg; j++) matrix.set(X, i, j, math.pow(i, j) as number);
  }
  const Xt = matrix.transpose(X);
  const XtX = matrix.mult(Xt, X) as PineMatrix<number>;
  const XtXInv = matrix.inv(XtX);
  // Pine runtime error on a singular X'X (e.g. length 3, degree 4)
  if (XtXInv === null) {
    throw new Error("In the 'matrix.inv()' function. Cannot inverse a singular matrix (matrix  determinant is zero).");
  }
  const hFull = matrix.mult(XtXInv, Xt) as PineMatrix<number>;
  const xLast = matrix.new_matrix<number>(1, deg + 1, 0.0);
  for (let j = 0; j <= deg; j++) matrix.set(xLast, 0, j, math.pow(length - 1, j) as number);
  return matrix.mult(xLast, hFull) as PineMatrix<number>;
}

/** mat_scale(m, s) / mat_add(m1, m2) of the Pine script */
function matScale(m: PineMatrix<number>, s: number): PineMatrix<number> {
  const r = matrix.rows(m);
  const c = matrix.columns(m);
  const res = matrix.new_matrix<number>(r, c, 0.0);
  for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) matrix.set(res, i, j, matrix.get(m, i, j) * s);
  return res;
}
function matAdd(m1: PineMatrix<number>, m2: PineMatrix<number>): PineMatrix<number> {
  const r = matrix.rows(m1);
  const c = matrix.columns(m1);
  const res = matrix.new_matrix<number>(r, c, 0.0);
  for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) matrix.set(res, i, j, matrix.get(m1, i, j) + matrix.get(m2, i, j));
  return res;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<PolynomialRegressionMovingAverageInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, degree, smoothType, smoothLen, smoothIter } = cfg;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const src = A(getSourceSeries(bars, cfg.source));

  // Kernel, built on the first bar (barstate.isfirst)
  const nrPred: number[] = new Array(n).fill(0);
  if (n > 0) {
    const degF = Math.floor(degree);
    const degC = Math.ceil(degree);
    const weight = degree - degF;
    const kFloor = olsWeights(length, Math.trunc(degF));
    const kernel = degF === degC
      ? kFloor
      : matAdd(matScale(kFloor, 1.0 - weight), matScale(olsWeights(length, Math.trunc(degC)), weight));

    // if not na(source[length]): nr_pred = sum of kernel(0, i) * source[length - 1 - i]
    for (let b = length; b < n; b++) {
      if (isNaN(src[b - length])) continue;
      let sum = 0.0;
      for (let i = 0; i < length; i++) sum += matrix.get(kernel, 0, i) * src[b - (length - 1 - i)];
      nrPred[b] = sum;
    }
  }

  // Smoothing: each iteration is its own call site, run on every bar
  const volume = S(bars.map((b) => b.volume ?? NaN));
  const wma = (x: number[], len: number) => A(ta.wma(S(x), len));
  const ema = (x: number[], len: number) => A(ta.ema(S(x), len));
  const smoothOnce = (x: number[], len: number): number[] => {
    switch (smoothType) {
      case 'SMA': return A(ta.sma(S(x), len));
      case 'EMA': return ema(x, len);
      case 'WMA': return wma(x, len);
      case 'RMA': return A(ta.rma(S(x), len));
      case 'HMA': {
        // halfLen = math.max(int(len / 2), 1); sqrtLen = math.max(int(math.sqrt(len)), 1)
        const halfLen = Math.max(Math.trunc(len / 2), 1);
        const sqrtLen = Math.max(Math.trunc(Math.sqrt(len)), 1);
        const wHalf = wma(x, halfLen);
        const wFull = wma(x, len);
        return wma(wHalf.map((v, i) => 2 * v - wFull[i]), sqrtLen);
      }
      case 'DEMA': {
        const e1 = ema(x, len);
        const e2 = ema(e1, len);
        return e1.map((v, i) => 2 * v - e2[i]);
      }
      case 'TEMA': {
        const e1 = ema(x, len);
        const e2 = ema(e1, len);
        const e3 = ema(e2, len);
        return e1.map((v, i) => 3 * (v - e2[i]) + e3[i]);
      }
      case 'VWMA': return A(ta.vwma(S(x), len, volume));
      case 'Gaussian': {
        // sum of nz(src[i]) * exp(-0.5 * (i / sigma)^2) / sum of the weights, sigma = len / 3
        const sigma = len / 3.0;
        const w: number[] = [];
        for (let i = 0; i < len; i++) w.push(math.exp(-0.5 * (math.pow(i / sigma, 2) as number)) as number);
        return x.map((_v, b) => {
          let sum = 0.0;
          let wsum = 0.0;
          for (let i = 0; i < len; i++) {
            const p = b - i >= 0 ? x[b - i] : NaN;
            sum += (isNaN(p) ? 0 : p) * w[i];
            wsum += w[i];
          }
          return sum / wsum;
        });
      }
      default: return x;
    }
  };
  let prma = nrPred;
  if (smoothType !== 'None') {
    for (let k = 1; k <= Math.min(smoothIter, 10); k++) prma = smoothOnce(prma, smoothLen);
  }

  const markers: MarkerData[] = [];
  const plot0: { time: number; value: number; color: string }[] = [];
  let prevUp = false;
  let prevDn = false;
  for (let i = 0; i < n; i++) {
    const prev = i > 0 ? prma[i - 1] : NaN;
    const up = gt(prma[i], prev);
    const dn = lt(prma[i], prev);
    const t = bars[i].time as number;
    plot0.push({ time: t, value: Number.isFinite(prma[i]) ? prma[i] : NaN, color: up ? cfg.colorUp : cfg.colorDn });
    // plotshape(showSig and sig_buy and close > prma, "Long", shape.labelup, location.belowbar, colorUp, text = "L")
    if (cfg.showSig && up && prevDn && gt(bars[i].close, prma[i])) {
      markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: cfg.colorUp, text: 'L',
        textColor: color.white, size: 'tiny' });
    }
    // plotshape(showSig and sig_sell and close < prma, "Short", shape.labeldown, location.abovebar, colorDn, text = "S")
    if (cfg.showSig && dn && prevUp && lt(bars[i].close, prma[i])) {
      markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: cfg.colorDn, text: 'S',
        textColor: color.white, size: 'tiny' });
    }
    prevUp = up;
    prevDn = dn;
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
    markers,
  };
}

export const PolynomialRegressionMovingAverage = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
