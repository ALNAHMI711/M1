/**
 * AI-Weighted RSI (Zeiierman)
 *
 * The target is the previous bar's RSI. Five predictors are the previous bar's log return, RSI, ATR(200) / close,
 * log volume change and volume. Over a learning window, each predictor gets the correlation with the target as its
 * coefficient (the RSI coefficient is fixed at 1), the predictors are ordered by absolute correlation and the
 * prediction is the sum of coefficient * z-score of each predictor. The predicted z-score is mapped back to an RSI
 * level with the rolling mean and stdev of the target, then to a weight -(50 - predicted RSI) / 50 clamped to -2..2.
 * The weight is plotted with an SMA signal line, bands at +/- 0.5 and gradient fills to zero.
 *
 * Reference: "AI-Weighted RSI (Zeiierman)" by Zeiierman
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface AIWeightedRSIInputs {
  /** RSI length */
  rsiLen: number;
  /** SMA length of the signal line */
  sigLen: number;
  /** Rolling window for the correlations and z-scores */
  learnLen: number;
}

export const defaultInputs: AIWeightedRSIInputs = {
  rsiLen: 14,
  sigLen: 20,
  learnLen: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 2 },
  { id: 'sigLen', type: 'int', title: 'Signal Length', defval: 20, min: 2 },
  { id: 'learnLen', type: 'int', title: 'Learning Window', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'AI-Weighted RSI', color: '#7E57C2', lineWidth: 1 },
  { id: 'plot1', title: 'AI-Weighted RSI Signal Line', color: color.yellow, lineWidth: 1 },
  { id: 'plot2', title: 'Zero', color: 'transparent', lineWidth: 1, display: 'none' },
];

const MID_COLOR = String(color.new('#787B86', 50));
const BAND_FILL = String(color.rgb(126, 87, 194, 90));

// Pine hline default style: dashed
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: 0.5, title: 'AI-Weighted RSI Upper Band', color: '#787B86', linestyle: 'dashed' },
  { id: 'hline_mid', price: 0, title: 'AI-Weighted RSI Middle Band', color: MID_COLOR, linestyle: 'dashed' },
  { id: 'hline_lower', price: -0.5, title: 'AI-Weighted RSI Lower Band', color: '#787B86', linestyle: 'dashed' },
];

export const fillConfig = [
  { id: 'fill0', plot1: 'hline_upper', plot2: 'hline_lower', color: BAND_FILL },
];

export const metadata = {
  title: 'AI-Weighted RSI (Zeiierman)',
  shortTitle: 'AI-Weighted RSI (Zeiierman)',
  overlay: false,
  precision: 1,
};

// Pine compares floats with a tolerance of 1e-10; a comparison with na is false.
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
// Pine nz(): na and +-infinity (log(0), x / 0) give the replacement
const nz = (v: number, r = 0) => (Number.isFinite(v) ? v : r);
/** Division: Pine x / 0 is +-Infinity, but each use here is guarded, has a price denominator, or goes through
 * nz() (volLogChg), where NaN gives the same value */
const div = (a: number, b: number) => (b === 0 ? NaN : a / b);

/** f_topk_indices(arr) of the script: indices of the 5 largest values (nz), first index on ties */
function topkIndices(arr: number[]): number[] {
  const sz = arr.length;
  const kk = Math.min(5, sz);
  const tmp = arr.map((v) => nz(v));
  const out: number[] = [];
  for (let k = 0; k < kk; k++) {
    let maxI = 0;
    let maxV = tmp[0];
    for (let j = 1; j < sz; j++) {
      const vj = tmp[j];
      // take = na(maxV) or (not na(vj) and vj > maxV)
      if (isNaN(maxV) || (!isNaN(vj) && gt(vj, maxV))) {
        maxV = vj;
        maxI = j;
      }
    }
    out.push(maxI);
    tmp[maxI] = NaN;
  }
  return out;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<AIWeightedRSIInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const { rsiLen, sigLen, learnLen } = cfg;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const close = bars.map((b) => b.close);
  const vol = bars.map((b) => b.volume ?? NaN);
  const prev = (a: number[], i: number) => (i > 0 ? a[i - 1] : NaN);

  // Per-bar features
  // retLog = math.log(close / nz(close[1], close)); volLogChg = math.log(vol / nz(vol[1], vol))
  const retLog = close.map((c, i) => Math.log(div(c, nz(prev(close, i), c))));
  const rsiVal = A(ta.rsi(S(close), rsiLen));
  const atr200 = A(ta.atr(bars, 200));
  const atrPct = atr200.map((a, i) => div(a, close[i]));
  const volLogChg = vol.map((v, i) => Math.log(div(v, nz(prev(vol, i), v))));

  // Target: prior bar RSI; predictors: prior-bar values of each feature
  const yRsi = rsiVal.map((_v, i) => prev(rsiVal, i));
  const xRet = retLog.map((_v, i) => nz(prev(retLog, i)));
  const xRsi = rsiVal.map((_v, i) => nz(prev(rsiVal, i)));
  const xAtrp = atrPct.map((_v, i) => nz(prev(atrPct, i)));
  const xVchg = volLogChg.map((_v, i) => nz(prev(volLogChg, i)));
  const xVol = vol.map((_v, i) => nz(prev(vol, i)));

  const corr = (x: number[]) => A(ta.correlation(S(yRsi), S(x), learnLen));
  // f_z(src, len): s > 0 ? (src - sma) / stdev : 0
  const fz = (x: number[]) => {
    const m = A(ta.sma(S(x), learnLen));
    const s = A(ta.stdev(S(x), learnLen));
    return x.map((v, i) => nz(gt(s[i], 0) ? div(v - m[i], s[i]) : 0));
  };
  const corrRet = corr(xRet);
  const corrRsi = corr(xRsi);
  const corrAtrp = corr(xAtrp);
  const corrVchg = corr(xVchg);
  const corrVol = corr(xVol);
  const zRet = fz(xRet);
  const zRsi = fz(xRsi);
  const zAtrp = fz(xAtrp);
  const zVchg = fz(xVchg);
  const zVol = fz(xVol);

  // rsi_mean = ta.sma(y_rsi, learnLen); rsi_std = ta.stdev(y_rsi, learnLen)
  const rsiMean = A(ta.sma(S(yRsi), learnLen));
  const rsiStd = A(ta.stdev(S(yRsi), learnLen));

  const rsiWeight: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    // corrs = |nz(corr)| of each predictor; topIdx = f_topk_indices(corrs)
    const corrs = [corrRet[i], corrRsi[i], corrAtrp[i], corrVchg[i], corrVol[i]].map((c) => Math.abs(nz(c)));
    const topIdx = topkIndices(corrs);
    const featZ = [zRet[i], zRsi[i], zAtrp[i], zVchg[i], zVol[i]];
    // coef = nz(corr) of each predictor, coef_rsi = 1.0
    const coef = [nz(corrRet[i]), 1.0, nz(corrAtrp[i]), nz(corrVchg[i]), nz(corrVol[i])];
    // f_pred: s += nz(coef[idx]) * nz(featZ[idx]) over topIdx
    let s = 0.0;
    for (const idx of topIdx) s += nz(coef[idx]) * nz(featZ[idx]);
    // pred_rsi = nz(rsi_mean) + nz(rsi_std) * pred_rsi_z
    const predRsi = nz(rsiMean[i]) + nz(rsiStd[i]) * s;
    // rsiWeight = math.max(-2, math.min(2, (50 - nz(pred_rsi)) / 50)) * -1
    rsiWeight[i] = Math.max(-2, Math.min(2, (50 - nz(predRsi)) / 50)) * -1;
  }
  const maRsi = A(ta.sma(S(rsiWeight), sigLen));

  const constant = <T>(v: T) => new Array<T>(n).fill(v);
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: metadata.precision },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: rsiWeight[i] })),
      plot1: bars.map((b, i) => ({ time: b.time, value: maRsi[i] })),
      // midLinePlot = plot(0, color = na, editable = false, display = display.none)
      plot2: bars.map((b) => ({ time: b.time, value: 0 })),
    },
    hlines: hlineConfig.map((h) => ({ value: h.price, options: { title: h.title, color: h.color, linestyle: h.linestyle } })),
    fills: [
      // fill(rsiUpperBand, rsiLowerBand, color = color.rgb(126, 87, 194, 90))
      { plot1: 'hline_upper', plot2: 'hline_lower', options: { title: 'AI-Weighted RSI Background Fill', color: BAND_FILL } },
      // fill(rsiPlot, midLinePlot, 0.5, 0, top_color = color.new(color.lime, 0), bottom_color = color.new(color.lime, 100))
      { plot1: 'plot0', plot2: 'plot2', options: { title: 'Overbought Gradient Fill' }, gradient: {
        topValue: constant(0.5), bottomValue: constant(0),
        topColor: constant<string | null>(String(color.new(color.lime, 0))),
        bottomColor: constant<string | null>(String(color.new(color.lime, 100))),
      } },
      // fill(rsiPlot, midLinePlot, 0, -0.5, top_color = color.new(color.red, 100), bottom_color = color.new(color.red, 0))
      { plot1: 'plot0', plot2: 'plot2', options: { title: 'Oversold Gradient Fill' }, gradient: {
        topValue: constant(0), bottomValue: constant(-0.5),
        topColor: constant<string | null>(String(color.new(color.red, 100))),
        bottomColor: constant<string | null>(String(color.new(color.red, 0))),
      } },
    ],
    markers: [],
  };
}

export const AIWeightedRSI = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
