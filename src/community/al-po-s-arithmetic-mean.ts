/**
 * Al Po's Arithmetic Mean (Enhanced Arithmetic Mean)
 *
 * The cumulative arithmetic mean of the source: the sum of the source from the first bar divided by bar_index + 1.
 * Two counters give the number of bars on which the source closed above / below the mean (shown in the status line
 * and in the data window); a bar on which the source equals the mean resets both counters to 0.
 *
 * Reference: "Enhanced Arithmetic Mean by @nocachy" by sequentialvision
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: ©nocachy
 */

import { getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface AlPoSArithmeticMeanInputs {
  /** Sum source */
  sumSource: SourceType;
  /** Plot style of the mean (0 line ... 10 steplinebr); the port draws the default style (line with breaks) */
  sumStyle: number;
  /** Line width of the mean (1..4); the port draws the default width 1 */
  sumWidth: number;
}

export const defaultInputs: AlPoSArithmeticMeanInputs = {
  sumSource: 'close',
  sumStyle: 1,
  sumWidth: 1,
};

export const inputConfig: InputConfig[] = [
  { id: 'sumSource', type: 'source', title: 'Sum source', defval: 'close' },
  { id: 'sumStyle', type: 'int', title: 'Sum style', defval: 1, min: 0, max: 10, step: 1 },
  { id: 'sumWidth', type: 'int', title: 'Sum width', defval: 1, min: 1, max: 4, step: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bars above the arithmetic mean', color: color.green, lineWidth: 1, display: 'status_line' },
  { id: 'plot1', title: 'Bars below the arithmetic mean', color: color.red, lineWidth: 1, display: 'status_line' },
  { id: 'plot2', title: 'Bars above the arithmetic mean', color: color.green, lineWidth: 1, display: 'data_window' },
  { id: 'plot3', title: 'Bars below the arithmetic mean', color: color.red, lineWidth: 1, display: 'data_window' },
  { id: 'plot4', title: 'Nocachy Arithmetic Mean', color: color.purple, lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'Enhanced Arithmetic Mean by @nocachy',
  shortTitle: 'EAM',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(bars: Bar[], inputs: Partial<AlPoSArithmeticMeanInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const src = getSourceSeries(bars, cfg.sumSource).toArray().map((v) => v ?? NaN);

  const am: number[] = new Array(n);
  const above: number[] = new Array(n);
  const below: number[] = new Array(n);
  let sum = NaN;
  for (let i = 0; i < n; i++) {
    // sum := barstate.isfirst ? sumSource : sum[1] + sumSource
    sum = i === 0 ? src[i] : sum + src[i];
    am[i] = sum / (i + 1);
    // barsAbove / barsBelow start at 0 on each bar; above the mean: barsAbove[1] + 1 (barsBelow kept), below:
    // barsBelow[1] + 1 (barsAbove kept); equal (within 1e-10) or na: both stay 0
    let a = 0;
    let b = 0;
    if (lt(am[i], src[i])) {
      if (i === 0) a = 1;
      else {
        a = above[i - 1] + 1;
        b = below[i - 1];
      }
    } else if (gt(am[i], src[i])) {
      if (i === 0) b = 1;
      else {
        b = below[i - 1] + 1;
        a = above[i - 1];
      }
    }
    above[i] = a;
    below[i] = b;
  }

  const t = (i: number) => bars[i].time;
  const P = (a: number[], c: string) => a.map((v, i) => ({ time: t(i), value: v, color: c }));
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      // plotchar(barsAbove / barsBelow, ..., '', location.top, display = display.status_line / display.data_window):
      // an empty character, only the value is shown
      plot0: P(above, color.green),
      plot1: P(below, color.red),
      plot2: P(above, color.green),
      plot3: P(below, color.red),
      // plot(am, color = color.purple, style = GetStyle(sumStyle), linewidth = math.max(1, sumWidth))
      plot4: P(am, color.purple),
    },
  };
}

export const AlPoSArithmeticMean = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
