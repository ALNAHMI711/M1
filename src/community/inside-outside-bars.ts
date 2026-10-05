/**
 * Inside / Outside Bars
 *
 * Colours the inside bars (high below the previous high and low above the previous low) and the outside bars (high
 * above the previous high and low below the previous low). Each kind can be turned off and has its own colour.
 *
 * Reference: "Inside / Outside Bars" by Iggy-
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface InsideOutsideBarsInputs {
  ibOn: boolean;
  ibColor: string;
  obOn: boolean;
  obColor: string;
}

// Input colour defaults color.new(color.orange, 20) and color.new(color.fuchsia, 20): alpha 0.8
export const defaultInputs: InsideOutsideBarsInputs = {
  ibOn: true,
  ibColor: 'rgba(255, 152, 0, 0.8)',
  obOn: true,
  obColor: 'rgba(224, 64, 251, 0.8)',
};

export const inputConfig: InputConfig[] = [
  { id: 'ibOn', type: 'bool', title: 'Enable Inside Bars', defval: true, group: '━━━━━━  Inside Bars  ━━━━━━' },
  { id: 'ibColor', type: 'color', title: 'Inside Bar Color', defval: 'rgba(255, 152, 0, 0.8)', group: '━━━━━━  Inside Bars  ━━━━━━' },
  { id: 'obOn', type: 'bool', title: 'Enable Outside Bars', defval: true, group: '━━━━━━  Outside Bars  ━━━━━━' },
  { id: 'obColor', type: 'color', title: 'Outside Bar Color', defval: 'rgba(224, 64, 251, 0.8)', group: '━━━━━━  Outside Bars  ━━━━━━' },
];

// No plot(): bar colours (barcolor) only
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Inside / Outside Bars',
  shortTitle: 'Inside / Outside Bars',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<InsideOutsideBarsInputs> = {},
): IndicatorResult & { barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };

  const barColors: BarColorData[] = [];
  bars.forEach((b, i) => {
    const high1 = i > 0 ? bars[i - 1].high : NaN;
    const low1 = i > 0 ? bars[i - 1].low : NaN;
    const isInside = lt(b.high, high1) && gt(b.low, low1);
    const isOutside = gt(b.high, high1) && lt(b.low, low1);

    // barcolor(ib_on and is_inside ? ib_color : na); barcolor(ob_on and is_outside ? ob_color : na)
    // (the second call is drawn on top; both conditions cannot be true on the same bar)
    if (cfg.ibOn && isInside) barColors.push({ time: b.time, color: cfg.ibColor });
    if (cfg.obOn && isOutside) barColors.push({ time: b.time, color: cfg.obColor });
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    barColors,
  };
}

export const InsideOutsideBars = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
