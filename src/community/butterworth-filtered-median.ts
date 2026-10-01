/**
 * Smoothed Low-Pass Butterworth Filtered Median
 *
 * The rolling median of the close (percentile_nearest_rank 50 over `len` bars) is smoothed with a one-pole low-pass
 * filter: a = exp(-2 * pi * cutoff), filtered = a * filtered[1] + (1 - a) * median (the median itself while the
 * previous filtered value is na). The line is an EMA of the filtered median, cyan when it is below the close and the
 * previous close, magenta otherwise.
 *
 * Reference: "Smoothed Low-Pass Butterworth Filtered Median [AlphaAlgos]" by AlphaNatt
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface ButterworthFilteredMedianInputs {
  /** Median length */
  len: number;
  /** Cutoff frequency of the low-pass filter */
  cutoffFreq: number;
  /** EMA length */
  emalen: number;
}

export const defaultInputs: ButterworthFilteredMedianInputs = {
  len: 50,
  cutoffFreq: 0.1,
  emalen: 7,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Median Length', defval: 50, min: 1 },
  { id: 'cutoffFreq', type: 'float', title: 'Cutoff Frequency', defval: 0.1, min: 0.01, max: 1.0, step: 0.01 },
  { id: 'emalen', type: 'int', title: 'EMA Length', defval: 7 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Filtered Median (Butterworth)', color: '#00F1FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Smoothed Low-Pass Butterworth Filtered Median [AlphaAlgos]',
  shortTitle: 'Smoothed Low-Pass Butterworth Filtered Median [AlphaAlgos]',
  overlay: true,
};

/** Pine float comparisons: a < b only when b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(bars: Bar[], inputs: Partial<ButterworthFilteredMedianInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const close = bars.map((b) => b.close);

  // a = math.exp(-2 * math.pi * cutoffFreq * deltaT), deltaT = 1
  const a = Math.exp(-2 * Math.PI * cfg.cutoffFreq * 1);
  const b = 1 - a;
  const percentile = A(ta.percentile_nearest_rank(Series.fromArray(bars, close), cfg.len, 50));
  // filteredMedian := na(filteredMedian[1]) ? percentile : a * filteredMedian[1] + b * percentile
  const filtered: number[] = new Array(n);
  let prev = NaN;
  for (let i = 0; i < n; i++) {
    filtered[i] = isNaN(prev) ? percentile[i] : a * prev + b * percentile[i];
    prev = filtered[i];
  }
  const ema = A(ta.ema(Series.fromArray(bars, filtered), cfg.emalen));

  const plot0 = bars.map((bar, i) => {
    // (ema < close) and (ema < close[1]) ? #00F1FF : #FF019A
    const up = lt(ema[i], close[i]) && i > 0 && lt(ema[i], close[i - 1]);
    return { time: bar.time, value: ema[i], color: up ? '#00F1FF' : '#FF019A' };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
  };
}

export const ButterworthFilteredMedian = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
