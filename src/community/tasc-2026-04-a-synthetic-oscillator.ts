/**
 * TASC 2026.04 A Synthetic Oscillator
 *
 * John F. Ehlers' Synthetic Oscillator. The source is smoothed by a 12-bar Hann filter, then bandpass filtered
 * (highpass at the upper bound, Super Smoother at the lower bound) and normalized by its 100-bar RMS: the real
 * component. Its rate of change, normalized the same way, is the imaginary component. The rate of change of the
 * phase angle gives the dominant cycle, limited to the bounds. A bandpass filter (highpass then Ultimate Smoother)
 * at the geometric mean of the bounds gives the phase resets: the cumulative phase adds 2 * pi / cycle per bar and
 * is reset to pi / cycle when the bandpass crosses above 0 and to pi + pi / cycle when it crosses below 0. The
 * oscillator is the sine of the cumulative phase, held when a reset would make it move back in the same quadrant.
 * The filters start on bar_index 4.
 *
 * Reference: "TASC 2026.04 A Synthetic Oscillator" by PineCodersTASC
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface TascSyntheticOscillatorInputs {
  /** Source series */
  src: SourceType;
  /** Lower bound of the dominant cycle (lowpass period) */
  lb: number;
  /** Upper bound of the dominant cycle (highpass period), greater than the lower bound */
  ub: number;
}

export const defaultInputs: TascSyntheticOscillatorInputs = {
  src: 'close',
  lb: 15,
  ub: 25,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source Series:', defval: 'close' },
  { id: 'lb', type: 'int', title: 'Lower Bound:', defval: 15, min: 3 },
  { id: 'ub', type: 'int', title: 'Upper Bound:', defval: 25, min: 4 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Synthetic Oscillator', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'TASC 2026.04 A Synthetic Oscillator',
  shortTitle: 'SO',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false); a != b when |a - b| > 1e-10 */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;
const nz = (x: number) => (isNaN(x) ? 0 : x);

/** Filter constants of the period: [q, c1, c2] */
function consts(period: number): [number, number, number] {
  const q = Math.exp((-1.414 * Math.PI) / period);
  const c1 = 2.0 * q * Math.cos((1.414 * Math.PI) / period);
  return [q, c1, q * q];
}

/** HP(src, period): 0 before bar_index 4, then nz(a0 * (src - 2 * src[1] + src[2]) + c1 * hp[1] - c2 * hp[2]) */
function highPass(src: number[], period: number): number[] {
  const [, c1, c2] = consts(period);
  const a0 = (1 + c1 + c2) / 4;
  const hp = new Array(src.length).fill(0);
  for (let i = 4; i < src.length; i++) {
    hp[i] = nz(a0 * (src[i] - 2 * src[i - 1] + src[i - 2]) + c1 * hp[i - 1] - c2 * hp[i - 2]);
  }
  return hp;
}

/** SuperSmoother(src, period): src before bar_index 4, then a0 * (src + src[1]) + c1 * ss[1] - c2 * ss[2] */
function superSmoother(src: number[], period: number): number[] {
  const [, c1, c2] = consts(period);
  const a0 = (1.0 - c1 + c2) / 2;
  const ss = src.slice();
  for (let i = 4; i < src.length; i++) ss[i] = a0 * (src[i] + src[i - 1]) + c1 * ss[i - 1] - c2 * ss[i - 2];
  return ss;
}

/** UltimateSmoother(src, period): src before bar_index 4, then the all-pass minus high-pass response */
function ultimateSmoother(src: number[], period: number): number[] {
  const [, c1, c2] = consts(period);
  const a0 = (1.0 + c1 + c2) / 4.0;
  const us = src.slice();
  for (let i = 4; i < src.length; i++) {
    us[i] = (1.0 - a0) * src[i] + (2.0 * a0 - c1) * src[i - 1] + (c2 - a0) * src[i - 2]
      + c1 * nz(us[i - 1]) - c2 * nz(us[i - 2]);
  }
  return us;
}

/**
 * RMS(src, length): math.sum(src * src, length) (na until `length` bars, na while an na value is in the window);
 * sqrt(sum / length) when the sum is not 0, else 0 (an na sum gives 0)
 */
function rms(src: number[], length: number): number[] {
  const out: number[] = new Array(src.length);
  for (let i = 0; i < src.length; i++) {
    let s = NaN;
    if (i >= length - 1) {
      s = 0;
      for (let k = i - length + 1; k <= i; k++) s += src[k] * src[k];
    }
    out[i] = ne(s, 0) ? Math.sqrt(s / length) : 0.0;
  }
  return out;
}

/** Hann(src, length): Hann-window weighted average of src[0 .. length - 1] (na values count as 0) */
function hann(src: number[], length: number): number[] {
  return src.map((_v, i) => {
    let filt = 0.0;
    let coef = 0.0;
    for (let c = 1; c <= length; c++) {
      const p = Math.cos((2 * Math.PI * c) / (length + 1));
      filt += (1.0 - p) * nz(i - (c - 1) >= 0 ? src[i - (c - 1)] : NaN);
      coef += 1.0 - p;
    }
    return ne(coef, 0.0) ? filt / coef : 0.0;
  });
}

export function calculate(bars: Bar[], inputs: Partial<TascSyntheticOscillatorInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const { lb, ub } = cfg;
  if (lb >= ub) {
    // runtime.error in Pine
    throw new Error("The 'Upper Bound' value must be greater than the 'Lower Bound' value.");
  }
  const n = bars.length;
  const src = getSourceSeries(bars, cfg.src).toArray().map((v) => v ?? NaN);

  // Real component: bandpass filtered and normalized
  const price = hann(src, 12);
  const hp = highPass(price, ub);
  const lp = superSmoother(hp, lb);
  const lpRms = rms(lp, 100);
  const re = lp.map((v, i) => (ne(lpRms[i], 0.0) ? v / lpRms[i] : 0.0));
  // Imaginary component: rate of change, normalized
  const roc = re.map((v, i) => (i > 0 ? v - re[i - 1] : NaN));
  const rocRms = rms(roc, 100);
  const im = roc.map((v, i) => (ne(rocRms[i], 0.0) ? v / rocRms[i] : 0.0));

  // Bandpass filter at the average dominant cycle period
  const mid = Math.trunc(Math.sqrt(lb * ub));
  const bp = ultimateSmoother(highPass(src, mid), mid);

  const so: number[] = new Array(n);
  let ph = 0.0; // var float ph = 0.0
  for (let i = 0; i < n; i++) {
    // Rate of change of the arctangent, limited to the bounds
    const denom = roc[i] * im[i] - (im[i] - (i > 0 ? im[i - 1] : NaN)) * re[i];
    let dc = ne(denom, 0.0) ? (6.28 * (re[i] * re[i] + im[i] * im[i])) / denom : 0.0;
    dc = Math.max(lb, Math.min(ub, dc));

    // Cumulative phase, reset at 0 and 180 degrees (ta.crossover / ta.crossunder of bp and 0)
    ph += (2 * Math.PI) / dc;
    const xo = i > 0 && gt(bp[i], 0.0) && le(bp[i - 1], 0.0);
    const xu = i > 0 && lt(bp[i], 0.0) && ge(bp[i - 1], 0.0);
    if (xo) ph = Math.PI / dc;
    else if (xu) ph = Math.PI + Math.PI / dc;

    // Sine of the phase; remove the reset glitch when the move stays in the same quadrant
    let s = Math.sin(ph);
    const prev = i > 0 ? so[i - 1] : NaN;
    if (gt(ph, 0.0) && lt(ph, Math.PI / 2) && lt(s, prev)) s = prev;
    else if (gt(ph, Math.PI) && lt(ph, (3 * Math.PI) / 2) && gt(s, prev)) s = prev;
    so[i] = s;
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: so[i] })),
    },
    // hline(0, "Zero Line"): Pine default colour, dashed, width 1
    hlines: [{ value: 0, options: { title: 'Zero Line', color: '#787B86', linestyle: 'dashed', linewidth: 1 } }],
  };
}

export const TascSyntheticOscillator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
