/**
 * High-Low of X Bar
 *
 * The range (high - low) of the bar `barsAgo` bars ago. While bar_index < barsAgo the range is na and a second
 * line is drawn at 1 ("Not Enough Bars").
 *
 * Reference: "High-Low of X Bar" by sam-austin
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface HighLowOfXBarInputs {
  /** Number of bars ago */
  barsAgo: number;
  /** Show the difference line */
  showDiff: boolean;
  /** Colour of the difference line */
  diffColor: string;
  /** Colour of the "Not Enough Bars" line */
  notEnoughBarsColor: string;
}

export const defaultInputs: HighLowOfXBarInputs = {
  barsAgo: 1000,
  showDiff: true,
  diffColor: color.green,
  notEnoughBarsColor: color.red,
};

export const inputConfig: InputConfig[] = [
  { id: 'barsAgo', type: 'int', title: 'Number of Bars Ago', defval: 1000, min: 1, max: 2000,
    tooltip: 'Enter a value between 1 and 2000 for normal users. Premium users can enter values beyond 2000.' },
  { id: 'showDiff', type: 'bool', title: 'Show Difference Line', defval: true },
  { id: 'diffColor', type: 'color', title: 'Difference Line Color', defval: color.green },
  { id: 'notEnoughBarsColor', type: 'color', title: 'Not Enough Bars Line Color', defval: color.red },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Difference Value', color: color.green, lineWidth: 2 },
  { id: 'plot1', title: 'Not Enough Bars Line', color: color.red, lineWidth: 2 },
];

export const metadata = {
  title: 'Difference of High-Low from 1000th Bar Ago',
  shortTitle: 'Difference of High-Low from 1000th Bar Ago',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<HighLowOfXBarInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const k = cfg.barsAgo;

  const plot0 = bars.map((b, i) => {
    // diff_barsAgo = high[barsAgo] - low[barsAgo]; na when bar_index < barsAgo
    const diff = i < k ? NaN : bars[i - k].high - bars[i - k].low;
    // plot(showDiff ? diff_barsAgo : na, color = diffColor, linewidth = 2)
    return { time: b.time, value: cfg.showDiff ? diff : NaN, color: cfg.diffColor };
  });
  // plot(bar_index < barsAgo ? 1 : na, color = notEnoughBarsColor, linewidth = 2)
  const plot1 = bars.map((b, i) => ({ time: b.time, value: i < k ? 1 : NaN, color: cfg.notEnoughBarsColor }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1 },
  };
}

export const HighLowOfXBar = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
