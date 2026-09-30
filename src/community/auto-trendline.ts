/**
 * Auto Trendline Indicator (based on fractals) [DojiEmoji]
 *
 * Automatically draws trend lines by connecting consecutive fractals (pivot highs/lows).
 * Detects HH/HL/LH/LL patterns from consecutive fractals and plots markers.
 * Recent lines are colored purple, historical lines are gray.
 *
 * Reference: "Auto Trendline [DojiEmoji]" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, LineDrawingData } from '../types';

export interface AutoTrendlineInputs {
  fractalPeriod: number;
  maxPairs: number;
  extend: string;
  showHH: boolean;
  showHL: boolean;
  showLH: boolean;
  showLL: boolean;
}

export const defaultInputs: AutoTrendlineInputs = {
  fractalPeriod: 10,
  maxPairs: 1,
  extend: 'Right',
  showHH: false,
  showHL: true,
  showLH: true,
  showLL: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'fractalPeriod', type: 'int', title: 'Fractal Period', defval: 10, min: 2 },
  { id: 'maxPairs', type: 'int', title: 'Max Pair of Lines', defval: 1, min: 1 },
  { id: 'extend', type: 'string', title: 'Extend Lines', defval: 'Right', options: ['Right', 'Both ways'] },
  { id: 'showHH', type: 'bool', title: 'Show HH', defval: false },
  { id: 'showHL', type: 'bool', title: 'Show HL', defval: true },
  { id: 'showLH', type: 'bool', title: 'Show LH', defval: true },
  { id: 'showLL', type: 'bool', title: 'Show LL', defval: false },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Auto Trendline [DojiEmoji]',
  shortTitle: 'AutoTL',
  overlay: true,
};

export function calculate(
  bars: Bar[],
  inputs: Partial<AutoTrendlineInputs> = {},
): Omit<IndicatorResult, 'markers'> & { lines: LineDrawingData[]; markers: MarkerData[] } {
  const { fractalPeriod: nPeriod, maxPairs, extend, showHH, showHL, showLH, showLL } = {
    ...defaultInputs,
    ...inputs,
  };
  const n = bars.length;
  const extendDir: 'right' | 'both' = extend === 'Both ways' ? 'both' : 'right';

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  // Pine's ta.pivothigh(n,n)[1]: the pivot value appears on the confirmation bar
  // (pivot bar + nPeriod) and [1] shifts it one more bar. The fractal's price/time
  // for line drawing is at the pivot bar (bar_index - n - 1 in Pine).
  const phArr = ta.pivothigh(highSeries, nPeriod, nPeriod).toArray();
  const plArr = ta.pivotlow(lowSeries, nPeriod, nPeriod).toArray();

  interface Fractal {
    barIndex: number; // the actual pivot bar index
    confirmedAt: number; // bar index when confirmed
    price: number;
    type: 'up' | 'down';
  }

  const fractals: Fractal[] = [];

  // Bar t sees the pivot confirmed at t - 1 ([1]), so a pivot confirmed on the last bar is not seen
  for (let t = 1; t < n; t++) {
    const i = t - 1 - nPeriod;
    if (!isNaN(phArr[t - 1])) {
      fractals.push({ barIndex: i, confirmedAt: t, price: phArr[t - 1], type: 'up' });
    }
    if (!isNaN(plArr[t - 1])) {
      fractals.push({ barIndex: i, confirmedAt: t, price: plArr[t - 1], type: 'down' });
    }
  }

  // Sort fractals by confirmation bar to process in order
  fractals.sort((a, b) => a.confirmedAt - b.confirmedAt || a.barIndex - b.barIndex);

  // Build trendlines by connecting consecutive same-type fractals
  const colRecent = '#9C27B0'; // purple
  const colPrev = 'rgba(128,128,128,0.5)'; // gray 50% transparency
  const colHH = 'rgba(128,128,128,1)';
  const colLH = '#EF5350';
  const colHL = '#2196F3';
  const colLL = 'rgba(128,128,128,1)';

  interface TrendLine {
    time1: number;
    price1: number;
    time2: number;
    price2: number;
    type: 'up' | 'down';
  }

  const upLines: TrendLine[] = [];
  const downLines: TrendLine[] = [];

  let recentUp1: Fractal | null = null;
  let recentUp2: Fractal | null = null;
  let recentDn1: Fractal | null = null;
  let recentDn2: Fractal | null = null;

  const markers: MarkerData[] = [];

  for (const frac of fractals) {
    if (frac.type === 'up') {
      recentUp2 = recentUp1;
      recentUp1 = frac;
      if (recentUp2 !== null) {
        upLines.push({
          time1: bars[recentUp2.barIndex].time,
          price1: recentUp2.price,
          time2: bars[recentUp1.barIndex].time,
          price2: recentUp1.price,
          type: 'up',
        });

        // HH/LH detection
        if (recentUp1.price > recentUp2.price) {
          if (showHH) {
            markers.push({
              time: bars[recentUp1.barIndex].time,
              position: 'aboveBar',
              shape: 'circle',
              color: colHH,
              text: 'HH',
            });
          }
        } else {
          if (showLH) {
            markers.push({
              time: bars[recentUp1.barIndex].time,
              position: 'aboveBar',
              shape: 'circle',
              color: colLH,
              text: 'LH',
            });
          }
        }
      }
    } else {
      recentDn2 = recentDn1;
      recentDn1 = frac;
      if (recentDn2 !== null) {
        downLines.push({
          time1: bars[recentDn2.barIndex].time,
          price1: recentDn2.price,
          time2: bars[recentDn1.barIndex].time,
          price2: recentDn1.price,
          type: 'down',
        });

        // HL/LL detection
        if (recentDn1.price > recentDn2.price) {
          if (showHL) {
            markers.push({
              time: bars[recentDn1.barIndex].time,
              position: 'belowBar',
              shape: 'circle',
              color: colHL,
              text: 'HL',
            });
          }
        } else {
          if (showLL) {
            markers.push({
              time: bars[recentDn1.barIndex].time,
              position: 'belowBar',
              shape: 'circle',
              color: colLL,
              text: 'LL',
            });
          }
        }
      }
    }
  }

  // Keep only max N pairs of lines; color recent vs historical
  const maxPerSide = maxPairs;
  const trimmedUpLines = upLines.slice(-maxPerSide);
  const trimmedDnLines = downLines.slice(-maxPerSide);

  const lines: LineDrawingData[] = [];

  for (let i = 0; i < trimmedUpLines.length; i++) {
    const tl = trimmedUpLines[i];
    const isRecent = i === trimmedUpLines.length - 1;
    lines.push({
      time1: tl.time1,
      price1: tl.price1,
      time2: tl.time2,
      price2: tl.price2,
      color: isRecent ? colRecent : colPrev,
      width: isRecent ? 1 : 1,
      style: 'dashed',
      extend: extendDir,
    });
  }

  for (let i = 0; i < trimmedDnLines.length; i++) {
    const tl = trimmedDnLines[i];
    const isRecent = i === trimmedDnLines.length - 1;
    lines.push({
      time1: tl.time1,
      price1: tl.price1,
      time2: tl.time2,
      price2: tl.price2,
      color: isRecent ? colRecent : colPrev,
      width: isRecent ? 1 : 1,
      style: 'dashed',
      extend: extendDir,
    });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    lines,
    markers,
  };
}

export const AutoTrendline = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
