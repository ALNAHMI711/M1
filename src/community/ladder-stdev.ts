/**
 * Ladder StDev
 *
 * Two standard deviations (unbiased, `stdevLength` values) of the source (PRICE mode) or of its log returns
 * log(src / src[1]) (RETURN mode): one is fed only on the bars with close > open, the other only on the other
 * bars, so each one measures the deviation of its own bars. Each value is kept until its next bar. In RETURN mode
 * the value is converted back to a price distance: src * (exp(stdev) - 1).
 *
 * Reference: "Ladder StDev" by jason5480
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © jason5480
 */

import { taCore, callsite, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export type LadderStDevMode = 'PRICE' | 'RETURN';

export interface LadderStDevInputs {
  /** PRICE: deviation of the source; RETURN: deviation of the log returns of the source */
  stdevMode: LadderStDevMode;
  /** Source of the deviation (PRICE) or of the log returns (RETURN) */
  stdevPriceSrc: SourceType;
  /** Number of values of each standard deviation */
  stdevLength: number;
}

export const defaultInputs: LadderStDevInputs = {
  stdevMode: 'PRICE',
  stdevPriceSrc: 'close',
  stdevLength: 20,
};

export const inputConfig: InputConfig[] = [
  {
    id: 'stdevMode', type: 'string', title: 'StDev Mode', defval: 'PRICE', options: ['PRICE', 'RETURN'],
    tooltip: 'Use the "PRICE" as source for the standard deviation calculations. Or use "RETURN" to use the log returns of the price as source for the standard deviation.',
  },
  {
    id: 'stdevPriceSrc', type: 'source', title: '  Price Src', defval: 'close',
    tooltip: 'The source to be used for the standard deviation calculation when PRICE mode is selected or for the log returns when RETURN mode is selected.',
  },
  {
    id: 'stdevLength', type: 'int', title: 'StDev Len', defval: 20, min: 1,
    tooltip: 'The length to be used for the standard deviation calculation.',
  },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Positive StDev', color: color.teal, lineWidth: 1, style: 'line' },
  { id: 'plot1', title: 'Negative StDev', color: color.red, lineWidth: 1, style: 'line' },
];

export const metadata = {
  title: 'Ladder StDev',
  shortTitle: 'LStDev',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(bars: Bar[], inputs: Partial<LadderStDevInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const price = getSourceSeries(bars, cfg.stdevPriceSrc).toArray().map((v) => v ?? NaN);
  const isPrice = cfg.stdevMode === 'PRICE';
  // stdevSrc = PRICE ? src : math.log(src / src[1])
  const stdevSrc = isPrice ? price : price.map((p, i) => (i > 0 ? Math.log(p / price[i - 1]) : NaN));

  // if close > open: ta.stdev(stdevSrc, len, false) (positive call site) else: ta.stdev(...) (negative call site)
  const up = bars.map((b) => gt(b.close, b.open));
  const down = up.map((u) => !u);
  const sd = (x: number[]) => taCore.stdev(x, cfg.stdevLength, false) as number[];
  const posSd = callsite.whenCalled(up, sd, stdevSrc) as number[];
  const negSd = callsite.whenCalled(down, sd, stdevSrc) as number[];

  // var float ladderPositiveStDevs / ladderNegativeStDevs: set on the bars of their branch, kept on the others
  const ladder = (called: boolean[], s: number[]) => {
    const out: number[] = new Array(n);
    let v = NaN;
    for (let i = 0; i < n; i++) {
      if (called[i]) v = isPrice ? s[i] : price[i] * (Math.exp(s[i]) - 1.0);
      out[i] = v;
    }
    return out;
  };
  const pos = ladder(up, posSd);
  const neg = ladder(down, negSd);

  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: fin(pos[i]) })),
      plot1: bars.map((b, i) => ({ time: b.time, value: fin(neg[i]) })),
    },
  };
}

export const LadderStDev = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
