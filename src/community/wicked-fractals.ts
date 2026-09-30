/**
 * WICK.ED Fractals
 *
 * Fractal detection based on wicks (high/low).
 * Fractal up = high is strictly highest among leftBars left and rightBars right.
 * Fractal down = low is strictly lowest among leftBars left and rightBars right.
 *
 * Reference: "WICK.ED Fractals" (community)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface WickedFractalsInputs {
  leftBars: number;
  rightBars: number;
}

export const defaultInputs: WickedFractalsInputs = {
  leftBars: 2,
  rightBars: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'leftBars', type: 'int', title: 'Left Bars', defval: 2, min: 1 },
  { id: 'rightBars', type: 'int', title: 'Right Bars', defval: 2, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Close', color: 'transparent', lineWidth: 0, display: 'none' },
];

export const metadata = {
  title: 'WICK.ED Fractals',
  shortTitle: 'WFrac',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<WickedFractalsInputs> = {}): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const { leftBars, rightBars } = { ...defaultInputs, ...inputs };

  const markers: MarkerData[] = [];
  const plot0 = bars.map((b) => ({ time: b.time, value: NaN }));

  // Pine: every neighbour strictly below (high) / above (low) the fractal bar; shapes drawn on the fractal bar (offset=-2)
  for (let c = leftBars; c + rightBars < bars.length; c++) {
    let dnFractal = true;
    let upFractal = true;
    for (let k = -leftBars; k <= rightBars; k++) {
      if (k === 0) continue;
      if (!(bars[c + k].high < bars[c].high)) dnFractal = false;
      if (!(bars[c + k].low > bars[c].low)) upFractal = false;
    }
    if (dnFractal) {
      markers.push({ time: bars[c].time, position: 'aboveBar', shape: 'triangleDown', color: '#EF5350', text: 'F' });
    }
    if (upFractal) {
      markers.push({ time: bars[c].time, position: 'belowBar', shape: 'triangleUp', color: '#26A69A', text: 'F' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    markers,
  };
}

export const WickedFractals = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
