/**
 * TASC 2026.01 The Reversion Index (John F. Ehlers)
 *
 * d = close - close[1]; the ratio is sum(d, length) / sum(|d|, length) (0 when the sum of |d| is 0 or na). Two
 * SuperSmoother filters of the ratio give the Smooth line (period 8) and the Trigger line (period 4). Each filter
 * smooths the 2-bar average of its input: f = c0 * avg(x, x[1]) + c1 * f[1] + c2 * f[2].
 *
 * Reference: "TASC 2026.01 The Reversion Index" by PineCodersTASC
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { Series, math, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface Tasc202601TheReversionIndexInputs {
  /** Normalization length of the data */
  length: number;
}

export const defaultInputs: Tasc202601TheReversionIndexInputs = {
  length: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'RI Length', defval: 20 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Smooth', color: '#F23645', lineWidth: 1 },
  { id: 'plot1', title: 'Trigger', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'TASC 2026.01 The Reversion Index',
  shortTitle: 'RI',
  overlay: false,
};

const nz = (x: number, y = 0) => (Number.isFinite(x) ? x : y);

/** superSmoother(Series, Period): the coefficients are `var` (computed on the first bar) */
function superSmoother(src: number[], period: number): number[] {
  const ALPHA = (Math.PI * Math.sqrt(2.0)) / period;
  const BETA = math.exp(-ALPHA);
  const COEF2 = -math.pow(BETA, 2);
  const COEF1 = math.cos(ALPHA) * 2.0 * BETA;
  const COEF0 = 1.0 - COEF1 - COEF2;
  const out: number[] = new Array(src.length);
  for (let i = 0; i < src.length; i++) {
    // math.avg(Series, nz(Series[1], Series))
    const prev = i > 0 ? src[i - 1] : NaN;
    const sma2 = (src[i] + nz(prev, src[i])) / 2;
    const s1 = i > 0 ? out[i - 1] : NaN;
    const s2 = i > 1 ? out[i - 2] : NaN;
    out[i] = COEF0 * sma2 + COEF1 * nz(s1) + COEF2 * nz(s2);
  }
  return out;
}

export function calculate(bars: Bar[], inputs: Partial<Tasc202601TheReversionIndexInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const d = bars.map((b, i) => (i > 0 ? b.close - bars[i - 1].close : NaN));
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const ds = A(math.sum(Series.fromArray(bars, d), cfg.length));
  const ads = A(math.sum(Series.fromArray(bars, d.map((x) => Math.abs(x))), cfg.length));
  const ri: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    // ratio = ads != 0.0 ? ds / ads : 0.0 (`!=` within 1e-10; na != 0 is false)
    ri[i] = !isNaN(ads[i]) && Math.abs(ads[i]) > 1e-10 ? ds[i] / ads[i] : 0.0;
  }
  const sm = superSmoother(ri, 8);
  const tr = superSmoother(ri, 4);
  const v = (x: number) => (Number.isFinite(x) ? x : NaN);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: v(sm[i]), color: '#F23645' })),
      plot1: bars.map((b, i) => ({ time: b.time, value: v(tr[i]), color: '#2962FF' })),
    },
    // hline(0): Pine defaults (colour #787B86, dashed, width 1)
    hlines: [{ value: 0, options: { title: 'Level', color: '#787B86', linestyle: 'dashed', linewidth: 1 } }],
  };
}

export const Tasc202601TheReversionIndex = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
