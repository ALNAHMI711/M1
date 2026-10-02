/**
 * Euclidean Range
 *
 * A moving average (SMA, EMA or HMA) of the source is the reference. The Euclidean distance between the source and
 * the reference over the last `length` bars is dist = sqrt(sum((src[i] - ref[i])^2)). The bands are reference +- dist
 * (drawn on the price pane). The pane shows the z-scores over `zLength` bars of dist / src (high volatility) and of
 * src / dist (low volatility). The price pane background takes a red gradient of the low-volatility z-score when it is
 * above the high-volatility z-score and above 0.5.
 *
 * Reference: "Euclidean Range [InvestorUnknown]" by InvestorUnknown
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © InvestorUnknown
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BgColorData } from '../types';

export interface EuclideanRangeInputs {
  /** Window length of the average and of the distance */
  length: number;
  /** Z-score lookback */
  zLength: number;
  source: SourceType;
  avgType: 'SMA' | 'EMA' | 'HMA';
  /** Allow intra-bar updating (false: the outputs of the previous bar) */
  intrabar: boolean;
  /** Plot the moving average */
  plotMa: boolean;
  colorBg: boolean;
}

export const defaultInputs: EuclideanRangeInputs = {
  length: 14,
  zLength: 100,
  source: 'close',
  avgType: 'HMA',
  intrabar: true,
  plotMa: false,
  colorBg: true,
};

const G1 = 'Indicator Settings';
const G2 = 'Plot Settings';

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Window Length', defval: 14, min: 1, group: G1 },
  { id: 'zLength', type: 'int', title: 'Z-Score Length', defval: 100, group: G1 },
  { id: 'source', type: 'source', title: 'Source', defval: 'close', group: G1 },
  { id: 'avgType', type: 'string', title: 'Average Type', defval: 'HMA', options: ['SMA', 'EMA', 'HMA'], group: G1 },
  { id: 'intrabar', type: 'bool', title: 'Allow Intra-bar Updating', defval: true, group: G2 },
  { id: 'plotMa', type: 'bool', title: 'Plot moving average', defval: false, group: G2 },
  { id: 'colorBg', type: 'bool', title: 'Color Background', defval: true, group: G2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Moving Average', color: color.blue, lineWidth: 1, forceOverlay: true },
  { id: 'plot1', title: 'Upper bound', color: color.purple, lineWidth: 2, forceOverlay: true },
  { id: 'plot2', title: 'Lower bound', color: color.yellow, lineWidth: 2, forceOverlay: true },
  { id: 'plot3', title: 'High-volatility Z-Score', color: color.white, lineWidth: 3 },
  { id: 'plot4', title: 'Low-volatility Z-Score', color: color.red, lineWidth: 3 },
];

export const metadata = {
  title: 'Euclidean Range [InvestorUnknown]',
  shortTitle: 'Euclidean Range',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(bars: Bar[], inputs: Partial<EuclideanRangeInputs> = {}): IndicatorResult & { bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, zLength } = cfg;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  const srcSeries = getSourceSeries(bars, cfg.source);
  const src = A(srcSeries);
  const reference = A(cfg.avgType === 'SMA' ? ta.sma(srcSeries, length)
    : cfg.avgType === 'EMA' ? ta.ema(srcSeries, length) : ta.hma(srcSeries, length));

  // euclidean_distance(source, reference, length): sqrt(sum of (src[i] - ref[i])^2, i = 0 .. length - 1); a missing
  // bar (na) gives na
  const dist: number[] = new Array(n);
  for (let t = 0; t < n; t++) {
    let sum = 0;
    for (let i = 0; i <= length - 1; i++) {
      const diff = t - i >= 0 ? src[t - i] - reference[t - i] : NaN;
      sum += diff * diff;
    }
    dist[t] = Math.sqrt(sum);
  }
  const upper = reference.map((r, i) => r + dist[i]);
  const lower = reference.map((r, i) => r - dist[i]);
  // Plain divisions: x / 0 is +-infinity (0 / 0 na), as Pine
  const distR = dist.map((d, i) => d / src[i]);
  const distV = dist.map((d, i) => src[i] / d);

  // z_score(x, lookback) = (x - sma(x, lookback)) / stdev(x, lookback)
  const zScore = (x: number[]) => {
    const avg = A(ta.sma(S(x), zLength));
    const sd = A(ta.stdev(S(x), zLength));
    return x.map((v, i) => (v - avg[i]) / sd[i]);
  };
  const zR = zScore(distR);
  const zV = zScore(distV);

  // bg_col = (z_v > z_r and z_v > 0.5) ? color.from_gradient(z_v, 0, 10, color.new(color.red, 90), color.new(color.red, 50)) : na
  const red90 = String(color.new(color.red, 90));
  const red50 = String(color.new(color.red, 50));
  const bgCol: Array<string | null> = zV.map((v, i) => (gt(v, zR[i]) && gt(v, 0.5)
    ? String(color.from_gradient(v, 0, 10, red90, red50)) : null));

  // i = intrabar ? 0 : 1: the plots show x[i]
  const lag = cfg.intrabar ? 0 : 1;
  const at = <T>(arr: T[], i: number, na: T): T => (i - lag >= 0 ? arr[i - lag] : na);
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const P = (vals: number[]) => bars.map((b, i) => ({ time: b.time, value: fin(at(vals, i, NaN)) }));

  const bgColors: BgColorData[] = [];
  if (cfg.colorBg) {
    for (let i = 0; i < n; i++) {
      const c = at(bgCol, i, null);
      if (c !== null) bgColors.push({ time: bars[i].time, color: c, forceOverlay: true });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: cfg.plotMa ? P(reference) : bars.map((b) => ({ time: b.time, value: NaN })),
      plot1: P(upper),
      plot2: P(lower),
      plot3: P(zR),
      plot4: P(zV),
    },
    hlines: [{ value: 0, options: { title: 'Mid line', color: color.gray, linestyle: 'dashed', linewidth: 2 } }],
    bgColors,
  };
}

export const EuclideanRange = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
