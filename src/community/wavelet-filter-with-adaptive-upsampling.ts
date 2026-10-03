/**
 * Wavelet Filter with Adaptive Upsampling
 *
 * On each bar, a two-level Haar-like wavelet decomposition of the log returns log(src / src[1]) of the last
 * min(bar_index, 5000) bars: high pass (a - b) / sqrt(2) and low pass (a + b) / sqrt(2) of consecutive returns,
 * downsampled by 2. The detail (high pass) coefficients of each level are soft-thresholded with the universal
 * threshold stdev * sqrt(2 * log(n)). The level 2 detail and approximation are added, upsampled (sinusoidal,
 * least-squares sinusoid fit with a Quinn-Fernandes frequency estimate, or linear midpoint) and added to the level 1
 * detail. The reconstructed log return of the bar is element bar_index % size of that series; the cumulative
 * series multiplies 1 by (1 + reconstructed return) on each bar.
 *
 * Reference: "Wavelet Filter with Adaptive Upsampling [BackQuant]" by BackQuant
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BackQuant :)
 */

import { array, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export type WaveletUpsampleType = 'Sinusoidal Upsample' | 'Advanced Upsample' | 'Simple Upsample';

export interface WaveletFilterWithAdaptiveUpsamplingInputs {
  /** Source */
  src: SourceType;
  /** Frequency of the sinusoidal upsample; also the convergence tolerance of the frequency estimate */
  freq: number;
  /** Phase shift of the sinusoidal upsample */
  phase: number;
  /** Consideration length for the frequency estimation and the least squares fit; the script runs from bar npast + 1 */
  npast: number;
  /** Upsample factor of the advanced upsample */
  upp: number;
  /** Upsampling function */
  upsampleType: WaveletUpsampleType;
  /** Show the reconstructed (cumulative) series */
  showeq: boolean;
  /** Show the reconstructed log returns */
  showlr: boolean;
}

export const defaultInputs: WaveletFilterWithAdaptiveUpsamplingInputs = {
  src: 'close',
  freq: 1,
  phase: 0,
  npast: 2,
  upp: 2,
  upsampleType: 'Sinusoidal Upsample',
  showeq: true,
  showlr: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close', group: 'High and Low Pass Filters' },
  { id: 'freq', type: 'float', title: 'Frequency', defval: 1, group: 'Interpolation' },
  { id: 'phase', type: 'int', title: 'Phase Shift', defval: 0, group: 'Interpolation' },
  { id: 'npast', type: 'int', title: 'Consideration Length for Frequency estimation and Least Squares Fitting Calculation', defval: 2 },
  { id: 'upp', type: 'int', title: 'Upsample Factor', defval: 2 },
  { id: 'upsampleType', type: 'string', title: 'Type of Upsampling Process/Function to use', defval: 'Sinusoidal Upsample',
    options: ['Sinusoidal Upsample', 'Advanced Upsample', 'Simple Upsample'] },
  { id: 'showeq', type: 'bool', title: 'Show Reconstructed Series', defval: true, group: 'Plotting' },
  { id: 'showlr', type: 'bool', title: 'Show Reconstructed Log Returns', defval: false, group: 'Plotting' },
];

const WHITE = '#FFFFFF';
const UP = '#00FF00';
const DOWN = '#FF0000';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Cumulative Series', color: WHITE, lineWidth: 1 },
  { id: 'plot1', title: 'Reconstructed Log Return Histogram', color: UP, lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'Wavelet Filter with Adaptive Upsampling [BackQuant]',
  shortTitle: 'Wavelet Filter [BackQuant]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false); != false with na / infinity */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ne = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) > EPS;
const isNa = (x: number) => !Number.isFinite(x);

/** Pine array.get: a negative index counts from the end; out of bounds is a runtime error */
function aget(arr: number[], index: number): number {
  const k = index < 0 ? arr.length + index : index;
  if (k < 0 || k >= arr.length) {
    throw new Error(`In 'array.get()' function. Index ${index} is out of bounds, array size is ${arr.length}.`);
  }
  return arr[k];
}

/** Pine array.set: a negative index counts from the end; out of bounds is a runtime error */
function aset(arr: number[], index: number, value: number): void {
  const k = index < 0 ? arr.length + index : index;
  if (k < 0 || k >= arr.length) {
    throw new Error(`In 'array.set()' function. Index ${index} is out of bounds, array size is ${arr.length}.`);
  }
  arr[k] = value;
}

/** Pine `for i = from to to by step`: counts down when from > to (the step sign is taken from the bounds) */
function pineFor(from: number, to: number, step: number, body: (i: number) => void): void {
  const s = Math.abs(step);
  if (from <= to) for (let i = from; i <= to; i += s) body(i);
  else for (let i = from; i >= to; i -= s) body(i);
}

const C = 1 / Math.sqrt(2);
const highPass = (a: number, b: number) => (a - b) * C;
const lowPass = (a: number, b: number) => (a + b) * C;

/** coeff > threshold ? coeff - threshold : coeff < -threshold ? coeff + threshold : 0 */
const softThreshold = (coeff: number, threshold: number) =>
  (gt(coeff, threshold) ? coeff - threshold : lt(coeff, -threshold) ? coeff + threshold : 0);

/** Every second element (0, 2, 4, ...) */
function downsample(arr: number[]): number[] {
  const out = array.new_float(Math.ceil(arr.length / 2), NaN);
  pineFor(0, arr.length - 1, 2, (i) => aset(out, i / 2, aget(arr, i)));
  return out;
}

/** Linear upsample: the original values with their midpoints between them */
function upsample(arr: number[]): number[] {
  if (arr.length <= 1) return arr;
  const size = arr.length * 2 - 1;
  const out = array.new_float(size, NaN);
  pineFor(0, arr.length - 2, 1, (i) => {
    const a = aget(arr, i);
    const b = aget(arr, i + 1);
    aset(out, i * 2, a);
    aset(out, i * 2 + 1, (a + b) / 2);
  });
  aset(out, size - 1, aget(arr, arr.length - 1));
  return out;
}

/** Sinusoidal upsample: amplitude * sin(pi * freq + phase) + midpoint between the original values */
function sinusoidalUpsample(arr: number[], freq: number, phase: number): number[] {
  if (arr.length <= 1) return arr;
  const out: number[] = [];
  pineFor(0, arr.length - 2, 1, (i) => {
    const a = aget(arr, i);
    const b = aget(arr, i + 1);
    const amplitude = (b - a) / 2;
    const midPoint = (a + b) / 2;
    out.push(a);
    out.push(amplitude * Math.sin(Math.PI * freq + phase) + midPoint);
  });
  out.push(aget(arr, arr.length - 1));
  return out;
}

/** Pine stops a loop that runs too long with a runtime error; a frequency estimate that does not converge throws */
const MAX_WHILE = 1_000_000;

/** Least squares sinusoid fit of the first npast values (Quinn-Fernandes frequency), sampled npast * factor times */
function advancedUpsample(srcarr: number[], npast: number, frqtol: number, upsampleFactor: number, barIndex: number): number[] {
  if (!(srcarr.length > 1 && barIndex > npast)) return [];
  let alpha = 0.0;
  let beta = 2.0;
  const srcsample = array.new_float(srcarr.length, NaN);
  aset(srcsample, 0, aget(srcarr, 0));
  let iterations = 0;
  while (gt(Math.abs(alpha - beta), frqtol)) {
    if (++iterations > MAX_WHILE) throw new Error('Loop takes too long to execute (> 500 ms)');
    alpha = beta;
    const last = Math.min(npast - 1, srcarr.length - 1);
    pineFor(1, last, 1, (i) => {
      const dxPrev = i > 1 ? aget(srcsample, i - 1) - aget(srcsample, i - 2) : 0.0;
      if (i < srcarr.length) aset(srcsample, i, aget(srcarr, i) + alpha * dxPrev);
    });
    let num = 0.0;
    let den = 0.0;
    pineFor(1, last, 1, (i) => {
      num += aget(srcsample, i - 1) * (aget(srcsample, i) + (i > 1 ? aget(srcsample, i - 2) : 0.0));
      den += aget(srcsample, i - 1) * aget(srcsample, i - 1);
    });
    beta = num / den;
  }
  const w = Math.acos(Math.min(Math.max(beta / 2.0, -1.0), 1.0));

  let Sc = 0.0;
  let Ss = 0.0;
  let Scc = 0.0;
  let Sss = 0.0;
  let Scs = 0.0;
  let Sx = 0.0;
  let Sxc = 0.0;
  let Sxs = 0.0;
  const n = npast;
  pineFor(0, Math.min(npast - 1, srcarr.length - 1), 1, (i) => {
    const c = Math.cos(w * i);
    const s = Math.sin(w * i);
    const dx = aget(srcarr, i);
    Sc += c;
    Ss += s;
    Scc += c * c;
    Sss += s * s;
    Scs += c * s;
    Sx += dx;
    Sxc += dx * c;
    Sxs += dx * s;
  });
  Sc /= n;
  Ss /= n;
  Scc /= n;
  Sss /= n;
  Scs /= n;
  Sx /= n;
  Sxc /= n;
  Sxs /= n;

  const den = Math.pow(Scs - Sc * Ss, 2) - (Scc - Sc * Sc) * (Sss - Ss * Ss);
  let a = 0.0;
  let b = 0.0;
  const m = Sx;
  // `den != 0`: false within 1e-10 and with na
  if (ne(den, 0)) {
    a = ((Sxs - Sx * Ss) * (Scs - Sc * Ss) - (Sxc - Sx * Sc) * (Sss - Ss * Ss)) / den;
    b = ((Sxc - Sx * Sc) * (Scs - Sc * Ss) - (Sxs - Sx * Ss) * (Scc - Sc * Sc)) / den;
  }
  const out: number[] = [];
  pineFor(0, npast * upsampleFactor - 1, 1, (i) => {
    const t = i / upsampleFactor;
    out.push(m + a * Math.cos(w * t) + b * Math.sin(w * t));
  });
  return out;
}

export function calculate(bars: Bar[], inputs: Partial<WaveletFilterWithAdaptiveUpsamplingInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const nBars = bars.length;
  const src = getSourceSeries(bars, cfg.src).toArray().map((v) => v ?? NaN);
  const npast = cfg.npast;

  // LogRoC = math.log(src / src[1])
  const logRoc = src.map((v, i) => (i > 0 ? Math.log(v / src[i - 1]) : NaN));

  const recon: number[] = new Array(nBars).fill(NaN);
  const cum: number[] = new Array(nBars).fill(NaN);
  let reconstructed = NaN; // var float reconstructed_equity = na
  let series = 1.0; // var float Series = 1.0

  for (let bi = 0; bi < nBars; bi++) {
    if (bi > 0 && bi > npast) {
      const highFreqValues: number[] = [];
      const lowFreqValues: number[] = [];
      const highFreqValues2: number[] = [];
      const lowFreqValues2: number[] = [];
      // for i = 0 to math.min(bar_index, 5000) - 1: LogRoC[i] and LogRoC[i + 1]
      pineFor(0, Math.min(bi, 5000) - 1, 1, (i) => {
        const x = bi - i >= 0 ? logRoc[bi - i] : NaN;
        const y = bi - i - 1 >= 0 ? logRoc[bi - i - 1] : NaN;
        highFreqValues.push(highPass(x, y));
        lowFreqValues.push(lowPass(x, y));
      });

      const downsampledLow = downsample(lowFreqValues);
      const downsampledHigh = downsample(highFreqValues);

      // Noise level of the level 1 detail; universal threshold
      const noiseEstimate = array.stdev(downsampledHigh);
      const n = downsampledHigh.length;
      const adaptiveThreshold = noiseEstimate * Math.sqrt(2 * Math.log(n));
      pineFor(0, n - 1, 1, (i) => aset(downsampledHigh, i, softThreshold(aget(downsampledHigh, i), adaptiveThreshold)));

      // Level 2
      pineFor(0, downsampledLow.length - 2, 1, (i) => {
        const frst = aget(downsampledLow, i);
        const scnd = aget(downsampledLow, i + 1);
        highFreqValues2.push(highPass(frst, scnd));
        lowFreqValues2.push(lowPass(frst, scnd));
      });
      const secondDownsampledLow = downsample(lowFreqValues2);
      const secondDownsampledHigh = downsample(highFreqValues2);
      const secondNoiseEstimate = array.stdev(secondDownsampledHigh);
      const secondN = secondDownsampledHigh.length;
      const secondAdaptiveThreshold = secondNoiseEstimate * Math.sqrt(2 * Math.log(secondN));
      pineFor(0, secondN - 1, 1, (i) =>
        aset(secondDownsampledHigh, i, softThreshold(aget(secondDownsampledHigh, i), secondAdaptiveThreshold)));

      // Upsampling and reconstruction
      if (secondDownsampledLow.length > 0) {
        const firstReconSize = Math.min(secondDownsampledHigh.length, secondDownsampledLow.length);
        const firstReconstruct = array.new_float(firstReconSize, NaN);
        pineFor(0, firstReconSize - 1, 1, (j) => {
          const hiVal = aget(secondDownsampledHigh, j);
          const loVal = aget(secondDownsampledLow, j);
          if (!isNa(hiVal) && !isNa(loVal)) aset(firstReconstruct, j, hiVal + loVal);
        });

        const upSampledApprox = cfg.upsampleType === 'Sinusoidal Upsample'
          ? sinusoidalUpsample(firstReconstruct, cfg.freq, cfg.phase)
          : cfg.upsampleType === 'Advanced Upsample'
            ? advancedUpsample(firstReconstruct, npast, cfg.freq, cfg.upp, bi)
            : upsample(firstReconstruct);

        if (upSampledApprox.length > 0) {
          const finalReconSize = Math.min(upSampledApprox.length, downsampledHigh.length);
          const finalRecon = array.new_float(finalReconSize, NaN);
          pineFor(0, finalReconSize - 1, 1, (k) => {
            const approxVal = aget(upSampledApprox, k);
            const detailVal = aget(downsampledHigh, k);
            if (!isNa(approxVal) && !isNa(detailVal)) aset(finalRecon, k, approxVal + detailVal);
          });
          reconstructed = finalRecon.length > 0 ? aget(finalRecon, bi % finalRecon.length) : NaN;
        }
      }
    }
    // Historical bars are confirmed: Series := Series * (1 + reconstructed_equity)
    if (bi > npast && !isNa(reconstructed)) series = series * (1 + reconstructed);
    recon[bi] = reconstructed;
    cum[bi] = series;
  }

  const value = (x: number) => (Number.isFinite(x) ? x : NaN);
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      // plot(showeq ? Series : na, title = "Cumulative Series", color = color.white)
      plot0: bars.map((b, i) => ({ time: b.time, value: cfg.showeq ? value(cum[i]) : NaN, color: WHITE })),
      // plot(showlr ? reconstructed_equity : na, style = plot.style_columns, color = reconstructed_equity > 0 ? #00ff00 : #ff0000)
      plot1: bars.map((b, i) => ({
        time: b.time, value: cfg.showlr ? value(recon[i]) : NaN, color: gt(recon[i], 0) ? UP : DOWN,
      })),
    },
  };
}

export const WaveletFilterWithAdaptiveUpsampling = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
