/**
 * Price Advance & Decline Range Analysis
 *
 * The bar range d = seriesB - seriesA (close - open by default) is split into an advance part (d >= 0, else 0) and a
 * decline part (d <= 0, else 0), drawn as columns. The largest advance and the largest decline so far (running
 * extremes from 0) are drawn as circles. The average of each part (cumulative average, SMA, EMA or double EMA) is
 * drawn in grey, and the mean of the average and the running extreme in red / lime, with a fill between the extreme
 * and that mean.
 *
 * Reference: "[RS]Price Advance & Decline Range Analysis" by RicardoSantos
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © RicardoSantos
 */

import {
  ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';

export type PriceAdvanceDeclineAverageType =
  | 'Cumulative Average'
  | 'Simple Average'
  | 'Exponential Average'
  | 'Double Exponentional Average';

export interface PriceAdvanceDeclineRangeAnalysisInputs {
  /** Series A (the range is seriesB - seriesA) */
  seriesA: SourceType;
  /** Series B */
  seriesB: SourceType;
  averageType: PriceAdvanceDeclineAverageType;
  /** Length of the simple / exponential averages */
  length: number;
}

export const defaultInputs: PriceAdvanceDeclineRangeAnalysisInputs = {
  seriesA: 'open',
  seriesB: 'close',
  averageType: 'Cumulative Average',
  length: 24,
};

export const inputConfig: InputConfig[] = [
  { id: 'seriesA', type: 'source', title: 'Series A:', defval: 'open' },
  { id: 'seriesB', type: 'source', title: 'Series B:', defval: 'close' },
  {
    id: 'averageType', type: 'string', title: 'Average Type:', defval: 'Cumulative Average',
    options: ['Cumulative Average', 'Simple Average', 'Exponential Average', 'Double Exponentional Average'],
  },
  { id: 'length', type: 'int', title: 'Length:', defval: 24 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'PD', color: color.green, lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'PN', color: color.red, lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'PA', color: color.maroon, lineWidth: 1, style: 'circles' },
  { id: 'plot3', title: 'PA', color: color.green, lineWidth: 1, style: 'circles' },
  { id: 'plot4', title: 'A', color: color.gray, lineWidth: 2 },
  { id: 'plot5', title: 'A', color: color.gray, lineWidth: 2 },
  { id: 'plot6', title: 'A', color: color.red, lineWidth: 1 },
  { id: 'plot7', title: 'A', color: color.lime, lineWidth: 1 },
];

export const metadata = {
  title: 'Price Advance & Decline Range Analysis',
  shortTitle: 'PA&DRA',
  overlay: false,
  precision: 5,
};

/** Pine float comparisons: a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const nz = (x: number) => (Number.isFinite(x) ? x : 0);

export function calculate(bars: Bar[], inputs: Partial<PriceAdvanceDeclineRangeAnalysisInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  const seriesA = A(getSourceSeries(bars, cfg.seriesA));
  const seriesB = A(getSourceSeries(bars, cfg.seriesB));
  const pos: number[] = new Array(n);
  const neg: number[] = new Array(n);
  const pApex: number[] = new Array(n);
  const nApex: number[] = new Array(n);
  let prevP = NaN;
  let prevN = NaN;
  for (let i = 0; i < n; i++) {
    const d = seriesB[i] - seriesA[i];
    pos[i] = ge(d, 0) ? d : 0;
    neg[i] = le(d, 0) ? d : 0;
    // pdfappex := nz(pdfappex[1]) <= posdifrange ? posdifrange : nz(pdfappex[1])
    pApex[i] = le(nz(prevP), pos[i]) ? pos[i] : nz(prevP);
    nApex[i] = ge(nz(prevN), neg[i]) ? neg[i] : nz(prevN);
    prevP = pApex[i];
    prevN = nApex[i];
  }

  const average = (x: number[]): number[] => {
    switch (cfg.averageType) {
      case 'Cumulative Average': {
        // ta.cum(x) / (1 + bar_index)
        const cum = A(ta.cum(S(x)));
        return cum.map((v, i) => v / (1 + i));
      }
      case 'Simple Average':
        return A(ta.sma(S(x), cfg.length));
      case 'Exponential Average':
        return A(ta.ema(S(x), cfg.length));
      case 'Double Exponentional Average':
        return A(ta.ema(ta.ema(S(x), cfg.length), cfg.length));
      default:
        return new Array<number>(n).fill(NaN);
    }
  };
  const avgPos = average(pos);
  const avgNeg = average(neg);
  // math.avg(avgposrange, pdfappex)
  const avgMaxPos = avgPos.map((v, i) => (v + pApex[i]) / 2);
  const avgMaxNeg = avgNeg.map((v, i) => (v + nApex[i]) / 2);

  const line = (v: number[], c: string) => bars.map((b, i) => ({ time: b.time, value: v[i], color: c }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: metadata.precision },
    plots: {
      plot0: line(pos, color.green),
      plot1: line(neg, color.red),
      plot2: line(pApex, color.maroon),
      plot3: line(nApex, color.green),
      plot4: line(avgPos, color.gray),
      plot5: line(avgNeg, color.gray),
      plot6: line(avgMaxPos, color.red),
      plot7: line(avgMaxNeg, color.lime),
    },
    // hline(0, '', color.black): default dashed style
    hlines: [{ value: 0, options: { title: '', color: color.black, linestyle: 'dashed' } }],
    // fill(ta0, ta1, #ff52523f); fill(ba0, ba1, #00e6773f)
    fills: [
      { plot1: 'plot2', plot2: 'plot6', options: { color: '#ff52523f' } },
      { plot1: 'plot3', plot2: 'plot7', options: { color: '#00e6773f' } },
    ],
  };
}

export const PriceAdvanceDeclineRangeAnalysis = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
