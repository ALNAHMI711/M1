/**
 * QG-Particle Oscillator
 *
 * An adaptive filter of the close: two envelopes (upper / lower sigma) follow the close with a volatility-adaptive
 * factor; the volatility ratio (distance of the close to the envelopes over its smoothed average) sets the smoothing
 * alpha of a level / trend / prediction filter bank. Raw trend = the trend component of the bank; Predict trend =
 * the error component (histogram and a line coloured aqua above zero, purple below). Dots on the zero line show
 * which component leads (Dot U / Dot L) and a warning dot when both slopes agree while the components converge.
 * Squares at the top / bottom mark bars where both components are positive / not positive.
 *
 * Reference: "QG-Particle Oscillator" by QuantG
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { callsite, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface QgParticleOscillatorInputs {
  /** Period of the adaptive filter */
  period: number;
  /** Phase (sets the weight of the trend component in the prediction) */
  phase: number;
}

export const defaultInputs: QgParticleOscillatorInputs = {
  period: 14,
  phase: 0,
};

export const inputConfig: InputConfig[] = [
  { id: 'period', type: 'int', title: 'Period', defval: 14, min: 1 },
  { id: 'phase', type: 'float', title: 'Phase', defval: 0, min: 0 },
];

const RAW_COLOR = String(color.new(color.orange, 50));
const PRED_UP = color.aqua;
const PRED_DOWN = color.purple;
const PRED_ZERO = String(color.rgb(0, 0, 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Raw Trend', color: RAW_COLOR, lineWidth: 1, style: 'linebr' },
  { id: 'plot1', title: 'Predict Trend', color: color.gray, lineWidth: 2, style: 'histogram' },
  { id: 'plot2', title: 'Dot U', color: color.green, lineWidth: 3, style: 'circles' },
  { id: 'plot3', title: 'Dot L', color: color.fuchsia, lineWidth: 3, style: 'circles' },
  { id: 'plot4', title: 'Dot Warn', color: color.yellow, lineWidth: 3, style: 'circles' },
  { id: 'plot5', title: 'Prediction D', color: PRED_UP, lineWidth: 2, style: 'linebr' },
];

export const metadata = {
  title: 'QG-Particle Oscillator',
  shortTitle: 'ParticleOsc',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

const OVER_VALUE = 0.25;
const CYCLE_ALERT = 0.6;

/**
 * One call site of the Pine function slope(src, length, offset = 0): m = src - (src[1] + src[2]) / 2,
 * -1 * (180 / pi * atan(m / 1.5)). The call runs only on some bars; the history of `src` inside the function is kept
 * by bar: src[k] is the argument of the last call made on bar i - k or before it (na before the first call).
 */
function slopeSite() {
  const callBars: number[] = [];
  const values: number[] = [];
  /** argument of the last call on bar `bar` or before it */
  const at = (bar: number) => {
    for (let j = callBars.length - 1; j >= 0; j--) {
      if (callBars[j] <= bar) return values[j];
    }
    return NaN;
  };
  return (barIndex: number, src: number) => {
    callBars.push(barIndex);
    values.push(src);
    const m = src - (at(barIndex - 1) + at(barIndex - 2)) / 2;
    return -1 * ((180 / Math.PI) * Math.atan(m / 1.5));
  };
}

export function calculate(
  bars: Bar[],
  inputs: Partial<QgParticleOscillatorInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // setWeights()
  const permissivity = Math.max(0.1, Math.min(0.01 * cfg.phase + 1.5, 3.0));
  let windowLength = 0.5 * (cfg.period - 1);
  const lengthParam = Math.max(0, Math.log(Math.sqrt(windowLength)) / Math.log(2.0) + 2);
  const expFactor = Math.max(0.5, lengthParam - 2);
  windowLength = windowLength * 0.9;
  const k = Math.sqrt(windowLength) * lengthParam;
  const beta = k / (k + 1);

  let uSigma = NaN;
  let iSigma = NaN;
  let vxAvg = NaN;
  let vxTrend = NaN;
  let rawTrend = NaN;
  let predictTrend = NaN;
  const vxHist: number[] = new Array(n).fill(NaN);
  const fbank = [0.0, 0.0, 0.0, 0.0, 0.0];
  // ta.sma(vxAvg, 65) runs only on the bars where bar_index >= 65 (its history is those calls)
  const smaSite = callsite.sma();

  const raw: number[] = new Array(n).fill(NaN);
  const pred: number[] = new Array(n).fill(NaN);
  const dotU: number[] = new Array(n).fill(NaN);
  const dotL: number[] = new Array(n).fill(NaN);
  const dotWarn: number[] = new Array(n).fill(NaN);
  const slopeRawNeg = slopeSite();
  const slopePredNeg = slopeSite();
  const slopeRawPos = slopeSite();
  const slopePredPos = slopeSite();

  for (let i = 0; i < n; i++) {
    const input = bars[i].close;
    let vx: number;
    if (i < 2) {
      uSigma = input;
      iSigma = input;
      vx = 0.0;
      vxAvg = 0.0;
      vxTrend = 0.0;
      rawTrend = 0.0;
      predictTrend = 0.0;
    } else {
      const uDelta = input - uSigma;
      const iDelta = input - iSigma;
      const uAbs = Math.abs(uDelta);
      const iAbs = Math.abs(iDelta);
      if (gt(uAbs, iAbs)) vx = uAbs;
      else if (lt(uAbs, iAbs)) vx = iAbs;
      else vx = 0.0;
      vxHist[i] = vx;

      const vxLookback = i >= 10 ? vxHist[i - 10] : vx;
      vxAvg = vxAvg + 0.1 * (vx - vxLookback);

      const vxAvgSma = i >= 65 ? smaSite(i, vxAvg, 65) : vxAvg;

      if (i <= 64) vxTrend = vxTrend + (2 * (vxAvg - vxTrend)) / 65;
      else vxTrend = vxAvgSma;

      let vxCoeff = 0.0;
      if (gt(vxTrend, 0)) vxCoeff = vx / vxTrend;
      vxCoeff = Math.min(Math.pow(lengthParam, 1 / expFactor), vxCoeff);
      if (lt(vxCoeff, 1)) vxCoeff = 1.0;

      const vExp = Math.pow(vxCoeff, expFactor);
      const kV = Math.pow(beta, Math.sqrt(vExp));
      const gamma = windowLength / (windowLength + 2);
      const alpha = Math.pow(gamma, vExp);

      uSigma = gt(uDelta, 0) ? input : input - kV * uDelta;
      iSigma = lt(iDelta, 0) ? input : input - kV * iDelta;

      let level = 0.0;
      let trend = 0.0;
      let prediction = 0.0;
      let error = 0.0;
      let posterior = 0.0;
      if (i === 2) {
        level = input;
        prediction = input;
        posterior = input;
      } else {
        level = (1 - alpha) * input + alpha * fbank[0];
        trend = (input - level) * (1 - gamma) + gamma * fbank[1];
        prediction = level + permissivity * trend;
        error = (prediction - fbank[4]) * Math.pow(1 - alpha, 2) + Math.pow(alpha, 2) * fbank[3];
        posterior = fbank[4] + error;
      }
      fbank[0] = level;
      fbank[1] = trend;
      fbank[2] = prediction;
      fbank[3] = error;
      fbank[4] = posterior;

      rawTrend = trend;
      predictTrend = error;
    }
    if (i < 2) vxHist[i] = vx;
    raw[i] = rawTrend;
    pred[i] = predictTrend;

    // Dots (the slope calls run only in their branch; the second call only when the first is < 0 / > 0)
    if (lt(rawTrend, 0) && lt(predictTrend, 0)) {
      if (lt(slopeRawNeg(i, rawTrend), 0) && lt(slopePredNeg(i, predictTrend), 0) && gt(rawTrend, predictTrend)) dotWarn[i] = 0;
      if (lt(rawTrend, predictTrend)) dotL[i] = 0;
      else dotU[i] = 0;
    } else if (gt(rawTrend, 0) && gt(predictTrend, 0)) {
      if (gt(slopeRawPos(i, rawTrend), 0) && gt(slopePredPos(i, predictTrend), 0) && lt(rawTrend, predictTrend)) dotWarn[i] = 0;
      if (gt(rawTrend, predictTrend)) dotU[i] = 0;
      else dotL[i] = 0;
    }
  }

  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const plots: Record<string, { time: number; value: number; color?: string }[]> = {
    plot0: [], plot1: [], plot2: [], plot3: [], plot4: [], plot5: [],
  };
  const markers: MarkerData[] = [];
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    plots.plot0.push({ time: t, value: fin(raw[i]), color: RAW_COLOR });
    plots.plot1.push({ time: t, value: fin(pred[i]), color: color.gray });
    plots.plot2.push({ time: t, value: dotU[i], color: color.green });
    plots.plot3.push({ time: t, value: dotL[i], color: color.fuchsia });
    plots.plot4.push({ time: t, value: dotWarn[i], color: color.yellow });
    const p = pred[i];
    plots.plot5.push({ time: t, value: fin(p), color: gt(p, 0) ? PRED_UP : lt(p, 0) ? PRED_DOWN : PRED_ZERO });

    // getBias(): (rawTrend > 0 ? 1 : -1) + (predictTrend > 0 ? 1 : -1)
    const bias = (gt(raw[i], 0) ? 1 : -1) + (gt(p, 0) ? 1 : -1);
    // plotshape(bias == 2 ? cycleAlert : na, "Bullish", shape.square, location.top, color.green, size.tiny)
    if (bias === 2) markers.push({ time: t, position: 'top', shape: 'square', color: color.green, size: 'tiny' });
    // plotshape(bias == -2 ? -cycleAlert : na, "Bearish", shape.square, location.bottom, color.red, size.tiny)
    if (bias === -2) markers.push({ time: t, position: 'bottom', shape: 'square', color: color.red, size: 'tiny' });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    hlines: [
      { value: 0, options: { title: 'Zero Line', color: color.white, linestyle: 'solid' } },
      { value: OVER_VALUE, options: { title: 'Over Bought', color: color.blue, linestyle: 'solid' } },
      { value: CYCLE_ALERT, options: { title: 'Very Over Bought', color: color.teal, linestyle: 'solid' } },
      { value: -OVER_VALUE, options: { title: 'Over Sold', color: color.red, linestyle: 'solid' } },
      { value: -CYCLE_ALERT, options: { title: 'Very Over Sold', color: color.orange, linestyle: 'solid' } },
    ],
    markers,
  };
}

export const QgParticleOscillator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
