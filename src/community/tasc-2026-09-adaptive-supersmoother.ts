/**
 * TASC 2026.09 Adaptive SuperSmoother
 *
 * John F. Ehlers' Adaptive SuperSmoother. The SuperSmoother is a second-order IIR filter with critical period P:
 * w = 1.414 * pi / P, q = exp(-w), c1 = 2 q cos(w), c2 = q^2, a0 = (1 - c1 + c2) / 2 and, from bar_index 4,
 * ss = a0 * (src + src[1]) + c1 * ss[1] - c2 * ss[2] (the source before). The adaptive filter takes the bar change of
 * a base SuperSmoother (roc1), scales it by its root mean square over `RMS length` bars (roc = min(|roc1 / rms|, 2)
 * when rms > 0, else 0) and runs a second SuperSmoother with the period max(int(P * (1 - roc / 2)^2), 2). The two
 * filters are drawn on the price pane; the oscillator is the adaptive filter minus the base filter, with a zero line.
 *
 * Reference: "TASC 2026.09 Adaptive SuperSmoother" by PineCodersTASC
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface TascAdaptiveSuperSmootherInputs {
  /** Source series */
  source: SourceType;
  /** Base period of the filters */
  period: number;
  /** RMS length of the Adaptive SuperSmoother */
  rmsLength: number;
}

export const defaultInputs: TascAdaptiveSuperSmootherInputs = {
  source: 'close',
  period: 20,
  rmsLength: 81,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'period', type: 'int', title: 'Base period', defval: 20, min: 2 },
  { id: 'rmsLength', type: 'int', title: 'RMS length', defval: 81, min: 2 },
];

export const plotConfig: PlotConfig[] = [
  // Pine force_overlay = true: the two filters are drawn on the price pane
  { id: 'plot0', title: 'SuperSmoother', color: color.red, lineWidth: 1, forceOverlay: true },
  { id: 'plot1', title: 'Adaptive SuperSmoother', color: color.blue, lineWidth: 1, forceOverlay: true },
  { id: 'plot2', title: 'SS Base', color: color.red, lineWidth: 1 },
  { id: 'plot3', title: 'Adaptive SS Oscillator', color: color.blue, lineWidth: 1 },
];

export const metadata = {
  title: 'TASC 2026.09 Adaptive SuperSmoother',
  shortTitle: 'SS - Adaptive',
  overlay: false,
};

/** Pine float comparison: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;

/** superSmoother(source, period) with a per-bar period (one call site: its own history of res) */
function superSmoother(src: number[], period: (i: number) => number): number[] {
  const n = src.length;
  const res: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const p = period(i);
    const w = (1.414 * Math.PI) / p;
    const q = Math.exp(-w);
    const c1 = 2.0 * q * Math.cos(w);
    const c2 = q * q;
    const a0 = (1.0 - c1 + c2) / 2.0;
    let r = src[i];
    // if bar_index >= 4: res := a0 * (source + source[1]) + c1 * res[1] - c2 * res[2]
    if (i >= 4) r = a0 * (src[i] + src[i - 1]) + c1 * res[i - 1] - c2 * res[i - 2];
    res[i] = r;
  }
  return res;
}

export function calculate(bars: Bar[], inputs: Partial<TascAdaptiveSuperSmootherInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const src = getSourceSeries(bars, cfg.source).toArray().map((v) => v ?? NaN);

  // ssBase = superSmoother(srcInput, perInput)
  const ssBase = superSmoother(src, () => cfg.period);

  // adaptiveSuperSmoother(srcInput, perInput, rmsInput)
  const ss = superSmoother(src, () => cfg.period);
  // roc1 = nz(ss - ss[1])
  const roc1 = ss.map((v, i) => {
    const d = i > 0 ? v - ss[i - 1] : NaN;
    return isNaN(d) ? 0 : d;
  });
  // rms(roc1, rmsLength) = math.sqrt(ta.sma(roc1 * roc1, rmsLength))
  const meanSq = ta.sma(Series.fromArray(bars, roc1.map((x) => x * x)), cfg.rmsLength).toArray().map((v) => v ?? NaN);
  const aPeriod: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const rocRMS = Math.sqrt(meanSq[i]);
    let roc = 0.0;
    if (gt(rocRMS, 0)) roc = Math.min(Math.abs(roc1[i] / rocRMS), 2.0);
    const factor = Math.pow(1.0 - 0.5 * roc, 2);
    // int aPeriod = math.max(int(period * factor), 2)
    aPeriod[i] = Math.max(Math.trunc(cfg.period * factor), 2);
  }
  const ssAdaptive = superSmoother(src, (i) => aPeriod[i]);

  const t = (i: number) => bars[i].time;
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((_b, i) => ({ time: t(i), value: ssBase[i], color: color.red })),
      plot1: bars.map((_b, i) => ({ time: t(i), value: ssAdaptive[i], color: color.blue })),
      plot2: bars.map((_b, i) => ({ time: t(i), value: 0, color: color.red })),
      // osc = ssAdaptive - ssBase
      plot3: bars.map((_b, i) => ({ time: t(i), value: ssAdaptive[i] - ssBase[i], color: color.blue })),
    },
  };
}

export const TascAdaptiveSuperSmoother = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
