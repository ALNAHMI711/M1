/**
 * Minimalist Doji Highlighter
 *
 * A doji is a bar whose body (|open - close|) is at most a fraction of its high - low range. Doji bars are coloured
 * white; an optional white cross above the bar marks them too.
 *
 * Reference: "Minimalist Doji Highlighter" by SensitiveSuit
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

export interface MinimalistDojiHighlighterInputs {
  /** Doji maximum body size, as a fraction of the high - low range */
  accuracy: number;
  /** Show a cross above the doji bars */
  showcross: boolean;
}

export const defaultInputs: MinimalistDojiHighlighterInputs = {
  accuracy: 0.15,
  showcross: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'accuracy', type: 'float', title: 'Doji Maximum Body Size', defval: 0.15, min: 0.001 },
  { id: 'showcross', type: 'bool', title: 'Show Cross Above Bar?', defval: false },
];

// No plot(): the outputs are bar colours and a plotshape marker
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Minimalist Doji Highlighter',
  shortTitle: 'Minimalist Doji Highlighter',
  overlay: true,
};

/** Pine float comparison: a <= b unless a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

export function calculate(
  bars: Bar[],
  inputs: Partial<MinimalistDojiHighlighterInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const white = String(color.white);
  const crossColor = String(color.new(color.white, 0));
  const barColors: BarColorData[] = [];
  const markers: MarkerData[] = [];
  for (const b of bars) {
    const doji = le(Math.abs(b.open - b.close), (b.high - b.low) * cfg.accuracy);
    // barcolor(doji ? color.white : na)
    if (doji) barColors.push({ time: b.time, color: white });
    // plotshape(showcross ? doji : na, style = shape.cross, location = location.abovebar, size = size.tiny):
    // the 1 / 0 series is a bool for location.abovebar (0 draws nothing)
    if (cfg.showcross && doji) {
      markers.push({ time: b.time, position: 'aboveBar', shape: 'cross', color: crossColor, size: 'tiny' });
    }
  }
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    barColors,
  };
}

export const MinimalistDojiHighlighter = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
