/**
 * MESA Adaptive Ehlers Flow
 *
 * Ehlers' MESA Adaptive Moving Average on the bar midpoint (high + low) / 2. A Hilbert transform of the 4-bar WMA
 * of the price gives the in-phase / quadrature components, the homodyne discriminator gives the cycle period, and
 * the phase change sets the adaptive alpha (fast limit / delta phase, kept between the slow and the fast limits).
 * MAMA = alpha * price + (1 - alpha) * MAMA[1]; FAMA = alpha / 2 * MAMA + (1 - alpha / 2) * FAMA[1]. Both are
 * smoothed by an EMA. The MESA line is cyan when the smoothed MAMA is above the smoothed FAMA and the close is above
 * it, magenta in the opposite case, grey otherwise. The FAMA line is hidden by default.
 *
 * Reference: "MESA Adaptive Ehlers Flow | AlphaNatt" by AlphaNatt
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface MesaAdaptiveEhlersFlowInputs {
  /** Fast limit of the adaptive alpha */
  fastLimit: number;
  /** Slow limit of the adaptive alpha */
  slowLimit: number;
  /** Band multiplier (the bands are computed but not drawn by the Pine script) */
  bandMultiplier: number;
  /** Gradient steps (not used by the Pine script) */
  gradientSteps: number;
  /** EMA length of the MAMA / FAMA smoothing */
  signalSmoothing: number;
}

export const defaultInputs: MesaAdaptiveEhlersFlowInputs = {
  fastLimit: 0.5,
  slowLimit: 0.05,
  bandMultiplier: 1.5,
  gradientSteps: 10,
  signalSmoothing: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLimit', type: 'float', title: 'Fast Limit', defval: 0.5, step: 0.1 },
  { id: 'slowLimit', type: 'float', title: 'Slow Limit', defval: 0.05, step: 0.01 },
  { id: 'bandMultiplier', type: 'float', title: 'Band Multiplier', defval: 1.5, step: 0.1 },
  { id: 'gradientSteps', type: 'int', title: 'Gradient Steps', defval: 10 },
  { id: 'signalSmoothing', type: 'int', title: 'Signal Smoothing', defval: 3 },
];

const BULL = '#00F1FF';
const BEAR = '#FF019A';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MESA Adaptive', color: BULL, lineWidth: 2 },
  { id: 'plot1', title: 'FAMA', color: String(color.new(BULL, 50)), lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'MESA Adaptive Ehlers Flow | AlphaNatt',
  shortTitle: 'MESA Adaptive Ehlers Flow | AlphaNatt',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
/** Pine x != 0: false when x is na or within 1e-10 of 0 */
const nonZero = (x: number) => !isNaN(x) && Math.abs(x) > EPS;
const nz = (x: number) => (isNaN(x) ? 0 : x);
/** Pine math.min / math.max: na when an argument is na */
const min = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.min(a, b));
const max = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.max(a, b));

export function calculate(bars: Bar[], inputs: Partial<MesaAdaptiveEhlersFlowInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const { fastLimit, slowLimit } = cfg;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  const price = bars.map((b) => (b.high + b.low) / 2);
  const smooth: number[] = new Array(n);
  const detrender: number[] = new Array(n);
  const q1: number[] = new Array(n);
  const i1: number[] = new Array(n);
  const i2: number[] = new Array(n);
  const q2: number[] = new Array(n);
  const re: number[] = new Array(n);
  const im: number[] = new Array(n);
  const period: number[] = new Array(n);
  const phase: number[] = new Array(n);
  const alpha: number[] = new Array(n);
  const mama: number[] = new Array(n);
  const fama: number[] = new Array(n);
  // x[k] of a series (na before the first bar)
  const at = (x: number[], i: number) => (i >= 0 ? x[i] : NaN);
  const hilbert = (x: number[], i: number, per1: number) =>
    (0.0962 * x[i] + 0.5769 * nz(at(x, i - 2)) - 0.5769 * nz(at(x, i - 4)) - 0.0962 * nz(at(x, i - 6)))
    * (0.075 * nz(per1) + 0.54);

  for (let i = 0; i < n; i++) {
    smooth[i] = (4 * price[i] + 3 * nz(at(price, i - 1)) + 2 * nz(at(price, i - 2)) + nz(at(price, i - 3))) / 10;
    const per1 = at(period, i - 1);
    detrender[i] = hilbert(smooth, i, per1);
    q1[i] = hilbert(detrender, i, per1);
    i1[i] = nz(at(detrender, i - 3));
    const ji = hilbert(i1, i, per1);
    const jq = hilbert(q1, i, per1);
    // Phasor addition, then smoothing with the previous final values
    i2[i] = 0.2 * (i1[i] - jq) + 0.8 * nz(at(i2, i - 1));
    q2[i] = 0.2 * (q1[i] + ji) + 0.8 * nz(at(q2, i - 1));
    // Homodyne discriminator
    const i2p = nz(at(i2, i - 1));
    const q2p = nz(at(q2, i - 1));
    re[i] = 0.2 * (i2[i] * i2p + q2[i] * q2p) + 0.8 * nz(at(re, i - 1));
    im[i] = 0.2 * (i2[i] * q2p - q2[i] * i2p) + 0.8 * nz(at(im, i - 1));
    // var float period: keeps its previous value when not computed
    let p = per1;
    // 2 * pi / math.atan(im / re): a plain division (x / 0 is +/-infinity, then math.min / math.max clamp it)
    if (nonZero(im[i]) && nonZero(re[i])) p = (2 * Math.PI) / Math.atan(im[i] / re[i]);
    p = max(1.5, min(p, 50));
    period[i] = 0.2 * p + 0.8 * nz(per1);

    // math.atan(q1 / i1): with i1 = 0 (the first 3 bars, nz(detrender[3])) the result is +/-90 degrees, as
    // atan(+/-infinity), not na
    phase[i] = (Math.atan(q1[i] / i1[i]) * 180) / Math.PI;
    let dp = nz(at(phase, i - 1)) - phase[i];
    dp = max(1, min(dp, 50));
    let a = fastLimit / dp; // dp is at least 1 here
    a = max(slowLimit, min(a, fastLimit));
    alpha[i] = a;
    mama[i] = a * price[i] + (1 - a) * nz(at(mama, i - 1));
    fama[i] = 0.5 * a * mama[i] + (1 - 0.5 * a) * nz(at(fama, i - 1));
  }

  const mamaSmooth = A(ta.ema(Series.fromArray(bars, mama), cfg.signalSmoothing));
  const famaSmooth = A(ta.ema(Series.fromArray(bars, fama), cfg.signalSmoothing));

  const colors = bars.map((b, i) => {
    const bull = gt(mamaSmooth[i], famaSmooth[i]) && gt(b.close, mamaSmooth[i]);
    const bear = lt(mamaSmooth[i], famaSmooth[i]) && lt(b.close, mamaSmooth[i]);
    return bull ? BULL : bear ? BEAR : color.gray;
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: mamaSmooth[i], color: colors[i] })),
      plot1: bars.map((b, i) => ({ time: b.time, value: famaSmooth[i], color: String(color.new(colors[i], 50)) })),
    },
  };
}

export const MesaAdaptiveEhlersFlow = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
