/**
 * RS Rating (1-99)
 *
 * Raw relative strength score: a weighted sum of the price ratios close / close[n] over 3, 6, 9 and 12 months
 * (63 / 126 / 189 / 252 bars; on a young history the ratio uses the first bar: n = min(n, bar_index)). The score is
 * scaled to 1..99 between its lowest and highest value of the last `distLen` bars (fewer on a young history, at least
 * 2), rounded, and drawn once `minBars` bars are available.
 *
 * Reference: "RS Rating (1-99)" by kulturdesken
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © kulturdesken
 */

import { callsite, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface RsRatingInputs {
  /** 3-month bars */
  len3m: number;
  /** 6-month bars */
  len6m: number;
  /** 9-month bars */
  len9m: number;
  /** 12-month bars */
  len12m: number;
  w3m: number;
  w6m: number;
  w9m: number;
  w12m: number;
  /** Rolling window of the lowest / highest raw score */
  distLen: number;
  /** Minimum number of bars before the rating is drawn */
  minBars: number;
}

export const defaultInputs: RsRatingInputs = {
  len3m: 63,
  len6m: 126,
  len9m: 189,
  len12m: 252,
  w3m: 2.0,
  w6m: 1.0,
  w9m: 1.0,
  w12m: 1.0,
  distLen: 252,
  minBars: 189,
};

export const inputConfig: InputConfig[] = [
  { id: 'len3m', type: 'int', title: '3M bars', defval: 63, min: 1 },
  { id: 'len6m', type: 'int', title: '6M bars', defval: 126, min: 1 },
  { id: 'len9m', type: 'int', title: '9M bars', defval: 189, min: 1 },
  { id: 'len12m', type: 'int', title: '12M bars', defval: 252, min: 1 },
  { id: 'w3m', type: 'float', title: 'Weight 3M', defval: 2.0, step: 0.25 },
  { id: 'w6m', type: 'float', title: 'Weight 6M', defval: 1.0, step: 0.25 },
  { id: 'w9m', type: 'float', title: 'Weight 9M', defval: 1.0, step: 0.25 },
  { id: 'w12m', type: 'float', title: 'Weight 12M', defval: 1.0, step: 0.25 },
  { id: 'distLen', type: 'int', title: 'Distribution window', defval: 252, min: 50 },
  { id: 'minBars', type: 'int', title: 'Minimum bars before output', defval: 189, min: 63 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RS Rating (1–99 proxy)', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'RS Rating (1-99)',
  shortTitle: 'RS Rating (1-99)',
  overlay: false,
};

/** Pine float comparisons: a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;

export function calculate(bars: Bar[], inputs: Partial<RsRatingInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // ratio(back): b = math.min(back, bar_index); b > 0 and not na(close[b]) ? close / close[b] : na
  const ratio = (i: number, back: number) => {
    const b = Math.min(back, i);
    if (!(b > 0)) return NaN;
    const prev = bars[i - b].close;
    return isNaN(prev) ? NaN : bars[i].close / prev;
  };

  const lowest = callsite.lowest();
  const highest = callsite.highest();
  const plot0 = bars.map((bar, i) => {
    const rsRaw = cfg.w3m * ratio(i, cfg.len3m) + cfg.w6m * ratio(i, cfg.len6m)
      + cfg.w9m * ratio(i, cfg.len9m) + cfg.w12m * ratio(i, cfg.len12m);
    // effLen = math.max(2, math.min(distLen, bar_index + 1)): a series length
    const effLen = Math.max(2, Math.min(cfg.distLen, i + 1));
    const lo = lowest(rsRaw, effLen);
    const hi = highest(rsRaw, effLen);
    const ready = i + 1 >= cfg.minBars;
    let rating = NaN;
    if (ready && !isNaN(rsRaw) && ne(hi, lo)) {
      // math.round: ties away from zero
      const x = 1 + (98 * (rsRaw - lo)) / (hi - lo);
      rating = Math.sign(x) * Math.round(Math.abs(x));
    }
    if (!isNaN(rating)) rating = Math.min(99, Math.max(1, rating));
    return { time: bar.time, value: Number.isFinite(rating) ? rating : NaN };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
  };
}

export const RsRating = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
