/**
 * TASC 2026.05 The AutoTune Filter
 *
 * John F. Ehlers' AutoTune filter. A high-pass filter (cutoff period `window`, from bar_index 4) is correlated with
 * itself for the lags 1..window over `window` bars: corr = (w * sxy - sx * sy) / sqrt((w * sxx - sx^2) *
 * (w * syy - sy^2)), with sx / sxx the sums of the series and of its squares, sy / syy these sums lag bars ago and
 * sxy the sum of the products of the current window with the window lag bars ago (1 when the correlation is na).
 * The dominant cycle is twice the lag of the lowest correlation, limited to +/- 2 from its previous value. A band-pass
 * filter (bandwidth 0.25, from bar_index 3) centred on the dominant cycle gives the tuned output. The output can be
 * the high-pass filter, the lowest correlation, the dominant cycle or the tuned band-pass filter.
 *
 * Reference: "TASC 2026.05 The AutoTune Filter" by PineCodersTASC
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export type AutoTuneOutput = 'High-pass filter' | 'Min. correlation' | 'Dominant cycle' | 'Tuned band-pass filter';

export interface TascAutoTuneFilterInputs {
  /** Source series */
  source: SourceType;
  /** Window length (high-pass period and autocorrelation window) */
  window: number;
  /** Series shown */
  output: AutoTuneOutput;
}

export const defaultInputs: TascAutoTuneFilterInputs = {
  source: 'close',
  window: 20,
  output: 'Tuned band-pass filter',
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source:', defval: 'close' },
  { id: 'window', type: 'int', title: 'Window:', defval: 20, min: 3 },
  {
    id: 'output', type: 'string', title: 'Output:', defval: 'Tuned band-pass filter',
    options: ['High-pass filter', 'Min. correlation', 'Dominant cycle', 'Tuned band-pass filter'],
  },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Series', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'TASC 2026.05 The AutoTune Filter',
  shortTitle: 'AutoTune',
  overlay: false,
};

const nz = (x: number, y = 0) => (isNaN(x) ? y : x);

/** math.sum(x, len): sum of the last len values, na until len bars */
function rollingSum(x: number[], len: number): number[] {
  return x.map((_v, i) => {
    if (i < len - 1) return NaN;
    let s = 0;
    for (let j = i - len + 1; j <= i; j++) s += x[j];
    return s;
  });
}

export function calculate(bars: Bar[], inputs: Partial<TascAutoTuneFilterInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const w = cfg.window;
  const src = getSourceSeries(bars, cfg.source).toArray().map((v) => v ?? NaN);
  const s = (i: number) => (i >= 0 ? src[i] : NaN);

  // hpf(src, window); bar_index counts from the first bar of the data
  const hp: number[] = new Array(n);
  {
    const wc = (1.414 * Math.PI) / w;
    const q = Math.exp(-wc);
    const c1 = 2.0 * q * Math.cos(wc);
    const c2 = q * q;
    const a0 = 0.25 * (1.0 + c1 + c2);
    for (let i = 0; i < n; i++) {
      let res = 0.0;
      if (i >= 4) {
        res = a0 * (src[i] - 2.0 * src[i - 1] + src[i - 2]) + c1 * nz(hp[i - 1]) - c2 * nz(hp[i - 2]);
      }
      hp[i] = res;
    }
  }
  const sx = rollingSum(hp, w);
  const sxx = rollingSum(hp.map((v) => v * v), w);
  // data (var array, unshift / pop): data[j] = hp[j bars ago], na before the first bar
  const h = (j: number) => (j >= 0 ? hp[j] : NaN);

  const minCorr: number[] = new Array(n);
  const dc: number[] = new Array(n);
  const acf: number[] = new Array(w).fill(NaN);
  for (let b = 0; b < n; b++) {
    for (let i = 0; i < w; i++) {
      const lag = i + 1;
      // lData = data[lag]: the array as it was lag bars ago (na before the first bar)
      // sxy = mat.mult(lData).first(): sum of data[j] * lData[j]
      let sxy = NaN;
      if (b - lag >= 0) {
        sxy = 0;
        for (let j = 0; j < w; j++) sxy += h(b - j) * h(b - lag - j);
      }
      const sy = b - lag >= 0 ? sx[b - lag] : NaN;
      const syy = b - lag >= 0 ? sxx[b - lag] : NaN;
      const cov = w * sxy - sx[b] * sy;
      const vx = w * sxx[b] - sx[b] * sx[b];
      const vy = w * syy - sy * sy;
      const den = Math.sqrt(vx * vy);
      // Pine x / 0 is +-Infinity (0 / 0: NaN); nz(corr, 1) replaces both, so NaN gives the same value
      const corr = den === 0 ? NaN : cov / den;
      acf[i] = nz(corr, 1);
    }
    let mc = acf[0];
    for (let i = 1; i < w; i++) if (acf[i] < mc) mc = acf[i];
    minCorr[b] = mc;
    let d = (acf.indexOf(mc) + 1) * 2;
    // dc := nz(math.min(math.max(dc, dc[1] - 2), dc[1] + 2), dc)
    const prev = b > 0 ? dc[b - 1] : NaN;
    if (!isNaN(prev)) d = Math.min(Math.max(d, prev - 2), prev + 2);
    dc[b] = d;
  }

  // bpf(src, dc, 0.25)
  const bp: number[] = new Array(n);
  const bw = 0.25;
  for (let i = 0; i < n; i++) {
    const w0 = (2.0 * Math.PI) / dc[i];
    const l1 = Math.cos(w0);
    const g1 = Math.cos(w0 * bw);
    const s1 = 1.0 / g1 - Math.sqrt(1.0 / (g1 * g1) - 1.0);
    let res = 0.0;
    if (i >= 3) {
      res = 0.5 * (1.0 - s1) * (s(i) - s(i - 2)) + l1 * (1.0 + s1) * nz(bp[i - 1]) - s1 * nz(bp[i - 2]);
    }
    bp[i] = res;
  }

  const out = cfg.output === 'High-pass filter' ? hp
    : cfg.output === 'Min. correlation' ? minCorr
      : cfg.output === 'Dominant cycle' ? dc
        : bp;

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: bars.map((b, i) => ({ time: b.time, value: out[i] })) },
    // hline(0, title = "Zero line"): Pine default colour, dashed, width 1
    hlines: [{ value: 0, options: { title: 'Zero line', color: '#787B86', linestyle: 'dashed', linewidth: 1 } }],
  };
}

export const TascAutoTuneFilter = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
