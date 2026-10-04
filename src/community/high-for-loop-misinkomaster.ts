/**
 * High For Loop | MisinkoMaster
 *
 * For-loop score of the high: for each offset i from `start` to `end`, -1 when high[i] > high and +1 when
 * high > high[i]. A crossover of the score above the upper threshold starts an uptrend (teal), a crossunder below
 * the lower threshold starts a downtrend (magenta); the colour is kept until the next signal (white before the first
 * one). The score line, both thresholds and the bars use this colour.
 *
 * Reference: "High For Loop | MisinkoMaster" by MisinkoMaster
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © MisinkoMaster
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface HighForLoopMisinkomasterInputs {
  /** Start of the for loop */
  start: number;
  /** End of the for loop */
  end: number;
  /** Upper threshold: a crossover of the score above it triggers an uptrend */
  ut: number;
  /** Lower threshold: a crossunder of the score below it triggers a downtrend */
  lt: number;
}

export const defaultInputs: HighForLoopMisinkomasterInputs = {
  start: 0,
  end: 45,
  ut: 25,
  lt: -7,
};

export const inputConfig: InputConfig[] = [
  { id: 'start', type: 'int', title: 'Start', defval: 0, min: 0, step: 1 },
  { id: 'end', type: 'int', title: 'End', defval: 45, min: 1, step: 1 },
  { id: 'ut', type: 'int', title: 'Upper Treshhold', defval: 25, step: 1 },
  { id: 'lt', type: 'int', title: 'Lower Treshhold', defval: -7, step: 1 },
];

const LONG_COL = String(color.rgb(10, 226, 179, 10));
const SHORT_COL = String(color.rgb(247, 0, 255, 10));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'High For Loop', color: color.white, lineWidth: 3 },
  { id: 'plot1', title: 'Upper Treshhold', color: LONG_COL, lineWidth: 1 },
  { id: 'plot2', title: 'Lower Treshhold', color: SHORT_COL, lineWidth: 1 },
];

export const metadata = {
  title: 'High For Loop | MisinkoMaster',
  shortTitle: 'HLF | MisinkoMaster',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<HighForLoopMisinkomasterInputs> = {},
): IndicatorResult & { barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const { start, end, ut, lt } = cfg;
  const n = bars.length;
  const high = bars.map((b) => b.high);

  // flscore: for i = start to end (counts down when start > end); high[i] before the first bar is na
  const step = start <= end ? 1 : -1;
  const score: number[] = new Array(n);
  for (let k = 0; k < n; k++) {
    let flscore = 0;
    for (let i = start; step > 0 ? i <= end : i >= end; i += step) {
      const hi = k - i >= 0 ? high[k - i] : NaN;
      if (gt(hi, high[k])) flscore += -1;
      if (gt(high[k], hi)) flscore += 1;
    }
    score[k] = flscore;
  }

  // var col = color.white; L = ta.crossover(flscore, ut), S = ta.crossunder(flscore, lt) (exact comparisons)
  const colors: string[] = new Array(n);
  let col: string = color.white;
  for (let k = 0; k < n; k++) {
    const L = k > 0 && score[k] > ut && score[k - 1] <= ut;
    const S = k > 0 && score[k] < lt && score[k - 1] >= lt;
    if (L && !S) col = LONG_COL;
    if (S) col = SHORT_COL;
    colors[k] = col;
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: score[i], color: colors[i] })),
      plot1: bars.map((b) => ({ time: b.time, value: ut, color: LONG_COL })),
      plot2: bars.map((b) => ({ time: b.time, value: lt, color: SHORT_COL })),
    },
    barColors: bars.map((b, i) => ({ time: b.time, color: colors[i] })),
  };
}

export const HighForLoopMisinkomaster = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
