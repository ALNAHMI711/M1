/**
 * Price Linear Sequence Counter
 *
 * Counts the bars in a row where Series B is above Series A (difference > 0; +1 per bar) and the bars in a row where
 * it is below (difference < 0; -1 per bar); a bar that breaks the run resets the count to 0. Both counts are drawn as
 * columns. Two lines keep the highest positive count and the lowest negative count reached so far.
 *
 * Reference: "Price Linear Sequence Counter" by RicardoSantos
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © RicardoSantos
 */

import { getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface PriceLinearSequenceCounterInputs {
  /** Length (declared in the Pine script, not used by its computation) */
  length: number;
  /** Series A */
  sa: SourceType;
  /** Series B */
  sb: SourceType;
}

export const defaultInputs: PriceLinearSequenceCounterInputs = {
  length: 24,
  sa: 'open',
  sb: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length:', defval: 24 },
  { id: 'sa', type: 'source', title: 'Series A:', defval: 'open' },
  { id: 'sb', type: 'source', title: 'Series B:', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'PLS', color: color.green, lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'NLS', color: color.red, lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'PL', color: color.black, lineWidth: 1 },
  { id: 'plot3', title: 'NL', color: color.black, lineWidth: 1 },
];

export const metadata = {
  title: 'Price Linear Sequence Counter',
  shortTitle: 'PLSC',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const nz = (x: number) => (isNaN(x) ? 0 : x);

export function calculate(bars: Bar[], inputs: Partial<PriceLinearSequenceCounterInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const sa = getSourceSeries(bars, cfg.sa).toArray().map((v) => v ?? NaN);
  const sb = getSourceSeries(bars, cfg.sb).toArray().map((v) => v ?? NaN);

  const pls: number[] = new Array(n);
  const nls: number[] = new Array(n);
  const pl: number[] = new Array(n);
  const nl: number[] = new Array(n);
  let prevPls = NaN;
  let prevNls = NaN;
  let prevPl = NaN;
  let prevNl = NaN;
  for (let i = 0; i < n; i++) {
    const difrange = sb[i] - sa[i];
    const posdifrange = ge(difrange, 0) ? difrange : 0;
    const negdifrange = le(difrange, 0) ? difrange : 0;
    // poslinearsequence := posdifrange > 0 ? nz(poslinearsequence[1]) + 1 : 0
    const p = gt(posdifrange, 0) ? nz(prevPls) + 1 : 0;
    // neglinearsequence := negdifrange < 0 ? nz(neglinearsequence[1]) - 1 : 0
    const q = lt(negdifrange, 0) ? nz(prevNls) - 1 : 0;
    // plinappex := nz(plinappex[1]) <= poslinearsequence ? poslinearsequence : nz(plinappex[1])
    const a = le(nz(prevPl), p) ? p : nz(prevPl);
    // nlinappex := nz(nlinappex[1]) >= neglinearsequence ? neglinearsequence : nz(nlinappex[1])
    const b = ge(nz(prevNl), q) ? q : nz(prevNl);
    pls[i] = p;
    nls[i] = q;
    pl[i] = a;
    nl[i] = b;
    prevPls = p;
    prevNls = q;
    prevPl = a;
    prevNl = b;
  }

  const line = (v: number[], c: string) => bars.map((bar, i) => ({ time: bar.time, value: v[i], color: c }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: line(pls, color.green),
      plot1: line(nls, color.red),
      plot2: line(pl, color.black),
      plot3: line(nl, color.black),
    },
    // hline(0, '0', color.black): Pine default style dashed
    hlines: [{ value: 0, options: { title: '0', color: color.black, linestyle: 'dashed' } }],
  };
}

export const PriceLinearSequenceCounter = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
