/**
 * Keyzone
 *
 * Step lines at the lowest low and the highest high of the previous 3, 8, 21 and 89 bars (the current bar is not
 * in the window): ultra fast (lime), fast (green), slow (orange) and ultra slow (red) key zones. The Pine script
 * also tracks buy / sell conditions but draws nothing with them.
 *
 * Reference: "Keyzone" by Uttaya
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface KeyzoneInputs {}

export const defaultInputs: KeyzoneInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Ultra Fast Lower Keyzone', color: color.lime, lineWidth: 1, style: 'stepline' },
  { id: 'plot1', title: 'Ultra Fast Upper Keyzone', color: color.lime, lineWidth: 1, style: 'stepline' },
  { id: 'plot2', title: 'Fast Lower Keyzone', color: color.green, lineWidth: 1, style: 'stepline' },
  { id: 'plot3', title: 'Fast Upper Keyzone', color: color.green, lineWidth: 1, style: 'stepline' },
  { id: 'plot4', title: 'Slow Lower Keyzone', color: color.orange, lineWidth: 1, style: 'stepline' },
  { id: 'plot5', title: 'Slow Upper Keyzone', color: color.orange, lineWidth: 1, style: 'stepline' },
  { id: 'plot6', title: 'Ultra Slow Lower Keyzone', color: color.red, lineWidth: 1, style: 'stepline' },
  { id: 'plot7', title: 'Ultra Slow Upper Keyzone', color: color.red, lineWidth: 1, style: 'stepline' },
];

export const metadata = {
  title: 'Keyzone',
  shortTitle: 'Keyzone',
  overlay: true,
};

export function calculate(bars: Bar[], _inputs: Partial<KeyzoneInputs> = {}): IndicatorResult {
  const low = Series.fromArray(bars, bars.map((b) => b.low));
  const high = Series.fromArray(bars, bars.map((b) => b.high));
  // ta.lowest(len)[1] / ta.highest(len)[1]: the extreme of the low / high on the previous bar
  const prev = (s: Series) => {
    const a = s.toArray().map((v) => v ?? NaN);
    return bars.map((_b, i) => (i > 0 ? a[i - 1] : NaN));
  };
  const zones = [3, 8, 21, 89].flatMap((len) => [prev(ta.lowest(low, len)), prev(ta.highest(high, len))]);

  const plots: IndicatorResult['plots'] = {};
  zones.forEach((z, k) => {
    plots[`plot${k}`] = bars.map((b, i) => ({ time: b.time, value: z[i] }));
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
  };
}

export const Keyzone = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
