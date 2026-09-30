/**
 * WICK.ED Fractals
 *
 * Bill Williams fractals on the wicks (high/low), 3-bar or 5-bar.
 * Down fractal (triangle above the bar): high[n] strictly above its neighbours.
 * Up fractal (triangle below the bar): low[n] strictly below its neighbours.
 * Pine draws both shapes with offset=-2 (fixed, whatever n is).
 *
 * Reference: "WICK.ED Fractals" by Mit Nayi (community)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface WickedFractalsInputs {
  n: number;
  fractalBars: '3' | '5';
}

export const defaultInputs: WickedFractalsInputs = {
  n: 2,
  fractalBars: '3',
};

export const inputConfig: InputConfig[] = [
  { id: 'n', type: 'int', title: 'Periods', defval: 2, min: 2 },
  { id: 'fractalBars', type: 'string', title: '3 or 5 Bar Fractal', defval: '3', options: ['3', '5'] },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Close', color: 'transparent', lineWidth: 0, display: 'none' },
];

export const metadata = {
  title: 'WICK.ED Fractals',
  shortTitle: 'WFrac',
  overlay: true,
};

// Pine: color = color.white, transp = 25
const SHAPE_COLOR = 'rgba(255,255,255,0.75)';

export function calculate(bars: Bar[], inputs: Partial<WickedFractalsInputs> = {}): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const { n, fractalBars } = { ...defaultInputs, ...inputs };
  const len = bars.length;

  const markers: MarkerData[] = [];
  const plot0 = bars.map((b) => ({ time: b.time, value: NaN }));

  // x[k] on bar i is bar i - k; a bar before the first one is na, and a comparison with na is false
  const high = (i: number, k: number) => (i - k >= 0 ? bars[i - k].high : NaN);
  const low = (i: number, k: number) => (i - k >= 0 ? bars[i - k].low : NaN);

  for (let i = 2; i < len; i++) {
    let dnFractal = false;
    let upFractal = false;
    if (fractalBars === '5') {
      dnFractal = high(i, n - 2) < high(i, n) && high(i, n - 1) < high(i, n) && high(i, n + 1) < high(i, n) && high(i, n + 2) < high(i, n);
      upFractal = low(i, n - 2) > low(i, n) && low(i, n - 1) > low(i, n) && low(i, n + 1) > low(i, n) && low(i, n + 2) > low(i, n);
    } else if (fractalBars === '3') {
      dnFractal = high(i, n - 1) < high(i, n) && high(i, n + 1) < high(i, n);
      upFractal = low(i, n - 1) > low(i, n) && low(i, n + 1) > low(i, n);
    }
    // Pine: plotshape(..., offset=-2): the shape computed on bar i is drawn on bar i - 2
    const time = bars[i - 2].time;
    if (dnFractal) {
      markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: SHAPE_COLOR });
    }
    if (upFractal) {
      markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: SHAPE_COLOR });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    markers,
  };
}

export const WickedFractals = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
