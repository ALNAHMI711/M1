/**
 * VWMA/SMA Delta Volatility (Statistical Anomaly Detector)
 *
 * delta = vwma(source, length) - sma(source, length). The last `sampleSize` deltas give a mean and a population
 * standard deviation (na values skipped); the filters are mean -+ zScore * stdev. The delta and the two filters are
 * scaled to -100..100 with the lowest / highest delta of the last `sampleSize` bars. The histogram is red when the
 * delta is negative and below the lower filter, green when it is positive and above the upper filter, faint silver
 * otherwise. Optional lines draw the scaled filters (Z-score channel).
 *
 * Reference: "VWMA/SMA Delta Volatility (Statistical Anomaly Detector)" by tkarolak
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © tkarolak
 */

import {
  ta, Series, color, getSourceSeries,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';

export interface VwmaSmaDeltaVolatilityInputs {
  /** Source for the MA delta */
  source: SourceType;
  /** Length of the VWMA and of the SMA */
  length: number;
  /** Number of deltas of the statistics and of the scaling */
  sampleSize: number;
  /** Standard deviation multiplier of the filters */
  zScore: number;
  /** Show the Z-score channel */
  showChannel: boolean;
}

export const defaultInputs: VwmaSmaDeltaVolatilityInputs = {
  source: 'close',
  length: 14,
  sampleSize: 100,
  zScore: 2.0,
  showChannel: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'length', type: 'int', title: 'MAs Length', defval: 14, min: 3 },
  { id: 'sampleSize', type: 'int', title: 'Statistical sample size', defval: 100, min: 20, max: 2000, step: 1 },
  { id: 'zScore', type: 'float', title: 'Z-score', defval: 2.0, min: 1.0, max: 3.0, step: 0.1 },
  { id: 'showChannel', type: 'bool', title: 'Z-score channel', defval: true },
];

const CHANNEL_COLOR = String(color.new(color.gray, 70));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Delta', color: '#2962FF', lineWidth: 1, style: 'histogram' },
  { id: 'plot1', title: 'Lower Filter', color: CHANNEL_COLOR, lineWidth: 1, display: 'pane' },
  { id: 'plot2', title: 'Upper Filter', color: CHANNEL_COLOR, lineWidth: 1, display: 'pane' },
];

export const metadata = {
  title: 'VWMA/SMA Delta Volatility (Statistical Anomaly Detector)',
  shortTitle: 'SAD',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(bars: Bar[], inputs: Partial<VwmaSmaDeltaVolatilityInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, sampleSize, zScore, showChannel } = cfg;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  const src = getSourceSeries(bars, cfg.source);
  const volume = S(bars.map((b) => b.volume ?? NaN));
  // delta = ta.vwma(source, lenght) - ta.sma(source, lenght)
  const vwma = A(ta.vwma(src, length, volume));
  const sma = A(ta.sma(src, length));
  const delta = bars.map((_b, i) => vwma[i] - sma[i]);

  // var array<float> data = array.new_float(sampleSize, na); push(delta); shift()
  const data: number[] = new Array(sampleSize).fill(NaN);
  const lowerFilter: number[] = new Array(n);
  const upperFilter: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    data.push(delta[i]);
    data.shift();
    // array.avg / array.stdev (biased): na values skipped, na when the array has no value
    let count = 0;
    let sum = 0;
    for (const v of data) {
      if (!Number.isNaN(v)) {
        count++;
        sum += v;
      }
    }
    const mean = count ? sum / count : NaN;
    let sq = 0;
    for (const v of data) if (!Number.isNaN(v)) sq += (v - mean) * (v - mean);
    const stdev = count ? Math.sqrt(sq / count) : NaN;
    lowerFilter[i] = mean - zScore * stdev;
    upperFilter[i] = mean + zScore * stdev;
  }

  // Scaling to -100..100 with the lowest / highest delta of the last sampleSize bars
  const lo = A(ta.lowest(S(delta), sampleSize));
  const hi = A(ta.highest(S(delta), sampleSize));
  const scale = (x: number, i: number) => -100 + (200.0 * (x - lo[i])) / Math.max(hi[i] - lo[i], 10e-10);

  const silver = String(color.new(color.silver, 80));
  const plot0 = bars.map((b, i) => {
    const d = delta[i];
    const c = lt(d, 0) && lt(d, lowerFilter[i]) ? color.red : gt(d, 0) && gt(d, upperFilter[i]) ? color.green : silver;
    const v = scale(d, i);
    return { time: b.time, value: Number.isFinite(v) ? v : NaN, color: c };
  });
  const channel = (f: number[]) => bars.map((b, i) => {
    const v = scale(f[i], i);
    return { time: b.time, value: showChannel && Number.isFinite(v) ? v : NaN, color: CHANNEL_COLOR };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1: channel(lowerFilter), plot2: channel(upperFilter) },
    hlines: [
      { value: 0, options: { title: 'Base Line', color: String(color.new(color.orange, 50)), linestyle: 'dotted' } },
    ],
  };
}

export const VwmaSmaDeltaVolatility = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
