/**
 * Clean Volume Bars (Green/Red + Above Avg Highlight)
 *
 * Volume columns, green when close >= open and red otherwise, with the SMA of the volume as a yellow line. A second
 * column series repeats the volume on the bars where it is above its SMA: white on bullish bars, black on bearish
 * bars (no colour on the other bars).
 *
 * Reference: "Clean Volume Bars (Green/Red + Above Avg Highlight)" by melospoker80
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface CleanVolumeBarsInputs {
  /** Volume SMA length */
  length: number;
}

export const defaultInputs: CleanVolumeBarsInputs = {
  length: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Volume SMA Length', defval: 20 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume', color: color.green, lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Avg Volume', color: color.yellow, lineWidth: 1 },
  { id: 'plot2', title: 'Above Avg Highlight', color: color.white, lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'Clean Volume Bars (Green/Red + Above Avg Highlight)',
  shortTitle: 'Clean Volume Bars (Green/Red + Above Avg Highlight)',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

export function calculate(bars: Bar[], inputs: Partial<CleanVolumeBarsInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const volume = bars.map((b) => b.volume ?? NaN);
  const volMA = ta.sma(Series.fromArray(bars, volume), cfg.length).toArray().map((v) => v ?? NaN);

  const isBull = bars.map((b) => ge(b.close, b.open));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      // plot(volume, 'Volume', style = plot.style_columns, color = isBull ? color.green : color.red)
      plot0: bars.map((b, i) => ({ time: b.time, value: volume[i], color: isBull[i] ? color.green : color.red })),
      plot1: bars.map((b, i) => ({ time: b.time, value: volMA[i], color: color.yellow })),
      // hiColor := volume > volMA ? (isBull ? color.white : color.black) : na
      plot2: bars.map((b, i) => ({
        time: b.time, value: volume[i],
        color: gt(volume[i], volMA[i]) ? (isBull[i] ? color.white : color.black) : 'transparent',
      })),
    },
  };
}

export const CleanVolumeBars = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
