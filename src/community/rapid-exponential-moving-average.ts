/**
 * [Pandora][Swarm] Rapid Exponential Moving Average
 *
 * A swarm of 59 filters of the source, periods 1 to 59, all with the selected filter. The Rapid Exponential Moving
 * Average (rema) is an EMA-like filter: omega = 2 pi / (sqrt(0.5)^period * sqrt(17.8) + 1 + period),
 * k = (sin(omega) + cos(omega) - 1) / cos(omega), filter = k * src + (1 - k) * filter[1]. Other choices: rema applied
 * 2, 3 or 4 times, a 2-pole SuperSmoother (jess), a Hann window FIR filter, and ta.alma / wma / ema / hma / sma / rma.
 * The option 'ta.vwma' gives ta.rma, as in the original script (its switch case is 'ta.vwma()').
 *
 * Reference: "[Pandora][Swarm] Rapid Exponential Moving Average" by ImmortalFreedom
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © ImmortalFreedom
 */

import { ta, Series, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface RapidExponentialMovingAverageInputs {
  /** Source series */
  source: SourceType;
  /** Filter of the swarm */
  filter: string;
}

const FILTERS = ['jess()', 'rema()', 'drema()', 'trema()', 'qrema()', 'ta.alma()', 'ta.wma()', 'ta.ema()', 'ta.hma()',
  'hann()', 'ta.sma()', 'ta.vwma', 'ta.rma()'];

export const defaultInputs: RapidExponentialMovingAverageInputs = {
  source: 'close',
  filter: 'rema()',
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source Series', defval: 'close' },
  { id: 'filter', type: 'string', title: 'Filters+', defval: 'rema()', options: FILTERS },
];

const PERIODS = Array.from({ length: 59 }, (_v, k) => k + 1); // 1 .. 59
const plotColor = (p: number) => (p === 1 ? '#EDDDDD' : p % 10 === 0 ? '#CC33FF99' : '#CC33FF');

// display = display.all - display.status_line - display.price_scale on every plot (drawn in the pane)
export const plotConfig: PlotConfig[] = PERIODS.map((p, k): PlotConfig => (
  { id: `plot${k}`, title: String(p).padStart(2, '0'), color: plotColor(p), lineWidth: 1 }));

export const metadata = {
  title: '[Pandora][Swarm] Rapid Exponential Moving Average',
  shortTitle: 'REMA',
  overlay: true,
};

const nz = (x: number, y: number) => (isNaN(x) ? y : x);
/** Pine a < b: b - a > 1e-10 */
const lt = (a: number, b: number) => b - a > 1e-10;

const SQRT17_8 = Math.sqrt(17.8);
const SQRT0_5 = Math.sqrt(0.5);
const PIx2 = Math.PI * 2.0;

/** rema(Series, Period): one call site over all bars */
function rema(src: number[], period: number): number[] {
  if (lt(period, 2.0)) return src.slice();
  const omega = PIx2 / (Math.pow(SQRT0_5, period) * SQRT17_8 + 1.0 + period);
  const alpha = Math.cos(omega);
  const coef0 = (Math.sin(omega) + alpha - 1.0) / alpha;
  const coef1 = 1.0 - coef0;
  const out: number[] = new Array(src.length);
  for (let i = 0; i < src.length; i++) {
    const prev = i > 0 ? out[i - 1] : NaN;
    out[i] = coef0 * src[i] + coef1 * nz(prev, src[i]);
  }
  return out;
}

/** jess(Series, Period): 2-pole SuperSmoother of the 2-bar average */
function jess(src: number[], period: number): number[] {
  if (lt(period, 2.0)) return src.slice();
  const omega = (Math.sqrt(2.0) * Math.PI) / period;
  const alpha = Math.exp(-omega);
  const coef2 = Math.pow(alpha, 2);
  const coef1 = Math.cos(omega) * 2.0 * alpha;
  const coef0 = 1.0 - coef1 + coef2;
  const out: number[] = new Array(src.length);
  for (let i = 0; i < src.length; i++) {
    const s = src[i];
    const s1 = i > 0 ? src[i - 1] : NaN;
    const sma2 = (s + nz(s1, s)) / 2;
    const f1 = i > 0 ? out[i - 1] : NaN;
    const f2 = i > 1 ? out[i - 2] : NaN;
    out[i] = coef0 * sma2 + coef1 * nz(f1, s) - coef2 * nz(f2, nz(f1, s));
  }
  return out;
}

/** hann(Series, Period): Hann window FIR filter */
function hann(src: number[], period: number): number[] {
  const omega = Math.PI / (1 + period);
  return src.map((_v, bi) => {
    let e = 0.0;
    let d = 0.0;
    // for int i = math.min(bar_index, Period - 1) to 0 (counts down)
    for (let i = Math.min(bi, period - 1); i >= 0; i--) {
      const coef = Math.pow(Math.sin(omega * (1 + i)), 2);
      e += coef * src[bi - i];
      d += coef;
    }
    return e / d;
  });
}

export function calculate(bars: Bar[], inputs: Partial<RapidExponentialMovingAverageInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const src = A(getSourceSeries(bars, cfg.source));

  const algo = (p: number): number[] => {
    switch (cfg.filter) {
      case 'jess()': return jess(src, p);
      case 'rema()': return rema(src, p);
      case 'drema()': return rema(rema(src, p), p);
      case 'trema()': return rema(rema(rema(src, p), p), p);
      case 'qrema()': return rema(rema(rema(rema(src, p), p), p), p);
      case 'ta.alma()': return A(ta.alma(S(src), p, 0.85, 6.0));
      case 'ta.wma()': return A(ta.wma(S(src), p));
      case 'ta.ema()': return A(ta.ema(S(src), p));
      case 'hann()': return hann(src, p);
      case 'ta.sma()': return A(ta.sma(S(src), p));
      case 'ta.hma()': return p > 1 ? A(ta.hma(S(src), p)) : src.slice();
      case 'ta.vwma()': return A(ta.vwma(S(src), p, S(bars.map((b) => b.volume ?? NaN))));
      default: return A(ta.rma(S(src), p));
    }
  };

  const plots: Record<string, { time: number; value: number; color: string }[]> = {};
  PERIODS.forEach((p, k) => {
    const v = algo(p);
    const c = plotColor(p);
    plots[`plot${k}`] = bars.map((b, i) => ({ time: b.time, value: Number.isFinite(v[i]) ? v[i] : NaN, color: c }));
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
  };
}

export const RapidExponentialMovingAverage = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
