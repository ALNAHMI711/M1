/**
 * MAMA - FAMA (Ehlers) [KN]
 *
 * Ehlers MESA Adaptive Moving Average. A 4-bar weighted smooth of the source goes through a Hilbert transform
 * (coefficients 0.0962 / 0.5769, scaled by 0.075 * period[1] + 0.54) to get the in-phase (I1) and quadrature (Q1)
 * parts; a homodyne discriminator gives the cycle period (clamped to 0.67..1.5 times the previous period and to
 * 6..50 bars). The phase is atan(Q1 / I1); alpha = fastLimit / max(phase[1] - phase, 1), clamped to
 * slowLimit..fastLimit. MAMA = alpha * src + (1 - alpha) * MAMA[1]; FAMA = 0.5 * alpha * MAMA + (1 - 0.5 * alpha) *
 * FAMA[1]. Both lines are blue when MAMA is above FAMA, orange when below, gray when equal; triangles mark the
 * crosses.
 *
 * Reference: "MAMA - FAMA (Ehlers) [KN]" by KatherinaNote
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface MamaFamaInputs {
  /** Fast limit of alpha */
  fastLimit: number;
  /** Slow limit of alpha */
  slowLimit: number;
  /** Source */
  src: SourceType;
}

export const defaultInputs: MamaFamaInputs = {
  fastLimit: 0.5,
  slowLimit: 0.05,
  src: 'hl2',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLimit', type: 'float', title: 'Fast Limit', defval: 0.5, min: 0.01, max: 1.0 },
  { id: 'slowLimit', type: 'float', title: 'Slow Limit', defval: 0.05, min: 0.01, max: 0.5 },
  { id: 'src', type: 'source', title: 'Source', defval: 'hl2' },
];

const BLUE = String(color.rgb(30, 144, 255));
const ORANGE = String(color.rgb(244, 164, 96));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MAMA', color: BLUE, lineWidth: 2 },
  { id: 'plot1', title: 'FAMA', color: BLUE, lineWidth: 2 },
];

export const metadata = {
  title: 'MAMA - FAMA (Ehlers) [KN]',
  shortTitle: 'MAMA - FAMA (Ehlers) [KN]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; a != b only when |a - b| > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;
const nz = (x: number, r = 0) => (Number.isFinite(x) ? x : r);

export function calculate(
  bars: Bar[],
  inputs: Partial<MamaFamaInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const { fastLimit, slowLimit } = cfg;
  const n = bars.length;
  const srcArr = getSourceSeries(bars, cfg.src).toArray().map((v) => v ?? NaN);

  const mama: number[] = new Array(n);
  const fama: number[] = new Array(n);
  const detrH: number[] = new Array(n);

  // var arrays of 7 history values (index 0 = current bar), initialised to 0.0
  const smoothHist = new Array(7).fill(0);
  const detrendHist = new Array(7).fill(0);
  const I1Hist = new Array(7).fill(0);
  const Q1Hist = new Array(7).fill(0);
  const shift = (arr: number[], v: number) => {
    for (let k = 6; k >= 1; k--) arr[k] = arr[k - 1];
    arr[0] = v;
  };

  // var floats: the value of the previous bar is the history value [1] (na before bar 0)
  let period = 0.0;
  let periodPrev = NaN;
  let periodPrev2 = NaN;
  let smoothPeriodPrev = NaN;
  let phase = 0.0;
  let phasePrev = NaN;
  let I2Prev = NaN;
  let Q2Prev = NaN;
  let RePrev = NaN;
  let ImPrev = NaN;
  let mamaPrev = NaN;
  let famaPrev = NaN;

  const s = (i: number, k: number) => (i - k >= 0 ? srcArr[i - k] : NaN);

  for (let i = 0; i < n; i++) {
    const src = srcArr[i];
    // htCoef(idx, hist): (0.0962 * h0 + 0.5769 * h2 - 0.5769 * h4 - 0.0962 * h6) * (0.075 * nz(period[1]) + 0.54).
    // Pine rule: `period[1]` read inside a user function, before the global `period` is assigned on the bar, gives
    // the value of two bars ago (the global history of the current bar is not open yet).
    const htCoef = (h: number[]) =>
      (0.0962 * h[0] + 0.5769 * h[2] - 0.5769 * h[4] - 0.0962 * h[6]) * (0.075 * nz(periodPrev2) + 0.54);

    const smooth = (4.0 * src + 3.0 * nz(s(i, 1)) + 2.0 * nz(s(i, 2)) + nz(s(i, 3))) / 10.0;
    shift(smoothHist, smooth);

    const cof1 = htCoef(smoothHist);
    const detrender = i > 5 ? cof1 : smooth;
    detrH[i] = detrender;
    shift(detrendHist, detrender);

    const cof2 = htCoef(detrendHist);
    const Q1 = i > 5 ? cof2 : detrender;
    // I1 := nz(detrender[3], detrender)
    const I1 = nz(i - 3 >= 0 ? detrH[i - 3] : NaN, detrender);
    shift(I1Hist, I1);
    shift(Q1Hist, Q1);

    const cof3 = htCoef(I1Hist);
    const cof4 = htCoef(Q1Hist);
    const JI = i > 5 ? cof3 : I1;
    const JQ = i > 5 ? cof4 : Q1;

    const I2 = 0.2 * (I1 - JQ) + 0.8 * nz(I2Prev);
    const Q2 = 0.2 * (Q1 + JI) + 0.8 * nz(Q2Prev);

    const Re = 0.2 * (I2 * nz(I2Prev) + Q2 * nz(Q2Prev)) + 0.8 * nz(RePrev);
    const Im = 0.2 * (I2 * nz(Q2Prev) - Q2 * nz(I2Prev)) + 0.8 * nz(ImPrev);

    if (ne(Re, 0) && ne(Im, 0)) {
      period = 360.0 / (Math.atan(Im / Re) * (180.0 / Math.PI));
    }
    period = Math.min(period, 1.5 * nz(periodPrev, period));
    period = Math.max(period, 0.67 * nz(periodPrev, period));
    period = Math.max(Math.min(period, 50), 6);
    const smoothPeriod = 0.2 * period + 0.8 * nz(smoothPeriodPrev, period);

    if (ne(I1, 0)) {
      phase = Math.atan(Q1 / I1) * (180.0 / Math.PI);
    }

    const deltaPhase = Math.max(nz(phasePrev) - phase, 1.0);
    const alpha = Math.max(Math.min(fastLimit / deltaPhase, fastLimit), slowLimit);

    const m = alpha * src + (1.0 - alpha) * nz(mamaPrev, src);
    const f = 0.5 * alpha * m + (1.0 - 0.5 * alpha) * nz(famaPrev, src);
    mama[i] = m;
    fama[i] = f;

    periodPrev2 = periodPrev;
    periodPrev = period;
    smoothPeriodPrev = smoothPeriod;
    phasePrev = phase;
    I2Prev = I2;
    Q2Prev = Q2;
    RePrev = Re;
    ImPrev = Im;
    mamaPrev = m;
    famaPrev = f;
  }

  // mamaColor = mama > fama ? blue : mama < fama ? orange : color.gray
  const colorAt = (i: number) => (gt(mama[i], fama[i]) ? BLUE : gt(fama[i], mama[i]) ? ORANGE : color.gray);
  const val = (x: number) => (Number.isFinite(x) ? x : NaN);

  const markers: MarkerData[] = [];
  for (let i = 1; i < n; i++) {
    // ta.crossover / ta.crossunder: exact comparisons (no 1e-10 tolerance)
    if (mama[i] > fama[i] && mama[i - 1] <= fama[i - 1]) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: BLUE, size: 'small' });
    }
    if (mama[i] < fama[i] && mama[i - 1] >= fama[i - 1]) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: ORANGE, size: 'small' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: val(mama[i]), color: colorAt(i) })),
      plot1: bars.map((b, i) => ({ time: b.time, value: val(fama[i]), color: colorAt(i) })),
    },
    markers,
  };
}

export const MamaFama = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
