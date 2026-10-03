/**
 * RSI (14) with Auto Zone Colors
 *
 * The 14-bar RSI of the close, green at or above 70, red at or below 30, blue otherwise. The background is green
 * when the RSI is above 70 and red when it is below 30. Horizontal lines at 70, 30 and 50.
 *
 * Reference: "RSI (14) with Auto Zone Colors — Overbought/Oversold Highlighter" by tarangbharti18
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © tarangbharti18
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';

export interface RsiWithAutoZoneColorsOverboughtOversoldHighlighterInputs {}

export const defaultInputs: RsiWithAutoZoneColorsOverboughtOversoldHighlighterInputs = {};

export const inputConfig: InputConfig[] = [];

const UP_COL = String(color.rgb(7, 243, 15));
const DOWN_COL = String(color.rgb(246, 2, 2));
const MID_COL = String(color.rgb(15, 66, 248));
const BG_UP = String(color.new(color.green, 85));
const BG_DOWN = String(color.new(color.red, 85));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: MID_COL, lineWidth: 2 },
];

export const metadata = {
  title: 'my RSI',
  shortTitle: 'my RSI',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => ge(b, a);

export function calculate(
  bars: Bar[],
  _inputs: Partial<RsiWithAutoZoneColorsOverboughtOversoldHighlighterInputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } {
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const rsi = A(ta.rsi(Series.fromArray(bars, bars.map((b) => b.close)), 14));

  const plot0 = bars.map((b, i) => ({
    time: b.time,
    value: rsi[i],
    color: ge(rsi[i], 70) ? UP_COL : le(rsi[i], 30) ? DOWN_COL : MID_COL,
  }));

  // bgcolor(rsivalue > 70 ? color.new(color.green, 85) : na); bgcolor(rsivalue < 30 ? color.new(color.red, 85) : na)
  const bgColors: BgColorData[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (gt(rsi[i], 70)) bgColors.push({ time: bars[i].time, color: BG_UP });
    if (lt(rsi[i], 30)) bgColors.push({ time: bars[i].time, color: BG_DOWN });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
    hlines: [
      { value: 70, options: { title: 'overbought', color: color.green, linestyle: 'dashed' } },
      { value: 30, options: { title: 'oversold', color: color.red, linestyle: 'dashed' } },
      { value: 50, options: { title: 'oversold', color: color.gray, linestyle: 'dashed' } },
    ],
    bgColors,
  };
}

export const RsiWithAutoZoneColorsOverboughtOversoldHighlighter = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
