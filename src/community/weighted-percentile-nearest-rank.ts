/**
 * Weighted percentile nearest rank (WPNR)
 *
 * The last `length` source values are sorted in ascending order with their weights. Weight of the value i bars ago:
 * (length - i) when weighting by time, times |close - open| of that bar when weighting by inferred volume (1 for a
 * weighting that is off). The output is the first sorted value whose cumulative weight reaches p % of the total
 * weight. Missing values (before the first bar) are sorted last and left out of the total.
 *
 * Reference: "Weighted percentile nearest rank" by gorx1
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface WeightedPercentileNearestRankInputs {
  /** Source */
  src: SourceType;
  /** Number of bars */
  length: number;
  /** Percentile (%) */
  percent: number;
  /** Weighting by time (newer bars weigh more) */
  timeWeighting: boolean;
  /** Weighting by inferred volume |close - open| */
  inferredVolume: boolean;
}

export const defaultInputs: WeightedPercentileNearestRankInputs = {
  src: 'close',
  length: 256,
  percent: 50,
  timeWeighting: true,
  inferredVolume: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'length', type: 'int', title: 'Length', defval: 256 },
  { id: 'percent', type: 'int', title: '%', defval: 50 },
  { id: 'timeWeighting', type: 'bool', title: 'Time', defval: true, inline: '1', group: 'Weighting by:' },
  { id: 'inferredVolume', type: 'bool', title: 'Inferred volume', defval: true, inline: '1', group: 'Weighting by:' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'WPNR', color: color.gray, lineWidth: 1 },
];

export const metadata = {
  title: 'Weighted percentile nearest rank',
  shortTitle: 'WPNR',
  overlay: true,
};

/** Pine float comparisons: a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

export function calculate(bars: Bar[], inputs: Partial<WeightedPercentileNearestRankInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const len = cfg.length;
  const p = cfg.percent;
  // Pine: `for i = 1 to len - 1` counts down to 0 when len is 1, and array.get(1) on a 1-element array fails
  if (len < 2) throw new Error(`Index ${Math.max(len, 0)} is out of bounds. Array size is ${Math.max(len, 0)}.`);
  const src = getSourceSeries(bars, cfg.src).toArray().map((v) => v ?? NaN);

  const data = new Array<number>(len);
  const weights = new Array<number>(len);
  const idx = new Array<number>(len);
  const plot0 = new Array<{ time: number; value: number }>(n);
  for (let bar = 0; bar < n; bar++) {
    for (let i = 0; i < len; i++) {
      const j = bar - i;
      const body = j >= 0 ? Math.abs(bars[j].close - bars[j].open) : NaN;
      weights[i] = (cfg.timeWeighting ? len - i : 1) * (cfg.inferredVolume ? body : 1);
      data[i] = j >= 0 ? src[j] : NaN;
      idx[i] = i;
    }
    // array.sort_indices(data, order.ascending): na values last
    idx.sort((a, b) => {
      const x = data[a];
      const y = data[b];
      if (isNaN(x)) return isNaN(y) ? 0 : 1;
      if (isNaN(y)) return -1;
      return x - y;
    });
    // sorted_weights.sum() (na skipped) / 100 * p
    let sum = 0;
    for (let i = 0; i < len; i++) {
      const w = weights[idx[i]];
      if (!isNaN(w)) sum += w;
    }
    const thres = (sum / 100) * p;
    // Cumulative weights: an na weight makes the rest of the sums na
    let out = 0.0;
    let cum = 0;
    for (let i = 0; i < len; i++) {
      cum = i === 0 ? weights[idx[0]] : cum + weights[idx[i]];
      if (ge(cum, thres)) {
        out = data[idx[i]];
        break;
      }
    }
    plot0[bar] = { time: bars[bar].time, value: out };
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
  };
}

export const WeightedPercentileNearestRank = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
