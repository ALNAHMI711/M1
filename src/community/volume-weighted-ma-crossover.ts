/**
 * Volume-Weighted MA Crossover [AlphaAlgos]
 *
 * VWMA of the source over `lenVwma` bars, coloured by its last cross with the SMA over `lenSma` bars: cyan after the
 * VWMA crosses over the SMA, magenta after it crosses under (magenta before the first cross).
 *
 * Reference: "Volume-Weighted MA Crossover [AlphaAlgos]" by AlphaNatt
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface VolumeWeightedMaCrossoverInputs {
  /** VWMA length */
  lenVwma: number;
  /** SMA length */
  lenSma: number;
  /** Source */
  src: SourceType;
}

export const defaultInputs: VolumeWeightedMaCrossoverInputs = {
  lenVwma: 20,
  lenSma: 50,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'lenVwma', type: 'int', title: 'VWMA Length', defval: 20, group: 'Volume-Weighted Moving Average Settings' },
  { id: 'lenSma', type: 'int', title: 'SMA Length', defval: 50, group: 'Simple Moving Average Settings' },
  { id: 'src', type: 'source', title: 'Source', defval: 'close', group: 'General Settings' },
];

const LONG_COL = '#00F1FF';
const SHORT_COL = '#FF019A';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VWMA', color: SHORT_COL, lineWidth: 2 },
];

export const metadata = {
  title: 'Volume-Weighted MA Crossover [AlphaAlgos]',
  shortTitle: 'Volume-Weighted MA Crossover [AlphaAlgos]',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<VolumeWeightedMaCrossoverInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const src = getSourceSeries(bars, cfg.src);
  const volume = new Series(bars, (b) => b.volume ?? NaN);

  const vwma = A(ta.vwma(src, cfg.lenVwma, volume));
  const sma = A(ta.sma(src, cfg.lenSma));

  const plot0: { time: number; value: number; color: string }[] = [];
  // var color signal_color = na: set on the crosses (crossover / crossunder compared with the last bar where both
  // values were not na; a tie there counts; exact comparisons: no 1e-10 tolerance, unlike the operators)
  let signal = '';
  let pv = NaN;
  let ps = NaN;
  for (let i = 0; i < n; i++) {
    const v = vwma[i];
    const s = sma[i];
    const longCondition = v > s && pv <= ps;
    const shortCondition = v < s && pv >= ps;
    if (!isNaN(v) && !isNaN(s)) {
      pv = v;
      ps = s;
    }
    if (longCondition) signal = LONG_COL;
    if (shortCondition) signal = SHORT_COL;
    // color = signal_color == #00F1FF ? #00F1FF : #FF019A
    plot0.push({ time: bars[i].time, value: v, color: signal === LONG_COL ? LONG_COL : SHORT_COL });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
  };
}

export const VolumeWeightedMaCrossover = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
