/**
 * Lunar Phase (LUNAR)
 *
 * Lunar phase from the bar open time with orbital terms: the Julian date gives T (Julian centuries from J2000);
 * the mean longitude, elongation, anomalies and argument of latitude of the Moon (and the Sun mean longitude) are
 * polynomials of T (modulo 360 degrees); six periodic terms correct the Moon longitude. The phase is
 * (1 - cos(Moon longitude - Sun longitude)) / 2: 0 at the new moon, 1 at the full moon. Characters mark the new moon
 * (a trough below 0.1), the first quarter (rising cross of 0.5), the full moon (a peak above 0.88) and the last
 * quarter (falling cross of 0.5), drawn one bar back at the previous phase value.
 *
 * Reference: "Lunar Phase (LUNAR)" by mihakralj
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: The MIT License (MIT) © mihakralj
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { barInterval, barTime } from '../bar-time';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface LunarPhaseInputs {}

export const defaultInputs: LunarPhaseInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Lunar Phase', color: color.yellow, lineWidth: 2 },
];

export const metadata = {
  title: 'Lunar Phase (LUNAR)',
  shortTitle: 'LUNAR',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

/** lunar(): phase from the bar open time in milliseconds */
function lunar(timeMs: number): number {
  const jd = timeMs / 86400000.0 + 2440587.5;
  const T = (jd - 2451545.0) / 36525.0;
  const Lp = (218.3164477 + 481267.88123421 * T - 0.0015786 * T * T + T * T * T / 538841.0 - T * T * T * T / 65194000.0) % 360.0;
  const D = (297.8501921 + 445267.1114034 * T - 0.0018819 * T * T + T * T * T / 545868.0 - T * T * T * T / 113065000.0) % 360.0;
  const M = (357.5291092 + 35999.0502909 * T - 0.0001536 * T * T + T * T * T / 24490000.0) % 360.0;
  const Mp = (134.9633964 + 477198.8675055 * T + 0.0087414 * T * T + T * T * T / 69699.0 - T * T * T * T / 14712000.0) % 360.0;
  const F = (93.272095 + 483202.0175233 * T - 0.0036539 * T * T - T * T * T / 3526000.0 + T * T * T * T / 863310000.0) % 360.0;
  const DRad = (D * Math.PI) / 180.0;
  const MRad = (M * Math.PI) / 180.0;
  const MpRad = (Mp * Math.PI) / 180.0;
  const FRad = (F * Math.PI) / 180.0;
  const dL = 6288.016 * Math.sin(MpRad) + 1274.242 * Math.sin(2.0 * DRad - MpRad)
    + 658.314 * Math.sin(2.0 * DRad) + 214.818 * Math.sin(2.0 * MpRad)
    + 186.986 * Math.sin(MRad) + 109.154 * Math.sin(2.0 * FRad);
  const LMoon = Lp + dL / 1000000.0;
  const LSun = (280.46646 + 36000.76983 * T + 0.0003032 * T * T) % 360.0;
  const phaseAngle = (((LMoon - LSun) % 360.0) * Math.PI) / 180.0;
  return (1.0 - Math.cos(phaseAngle)) / 2.0;
}

export function calculate(
  bars: Bar[],
  _inputs: Partial<LunarPhaseInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const n = bars.length;
  // Pine `time`: bar open time in milliseconds (bar times are in seconds)
  const phase = bars.map((b) => lunar(b.time * 1000));
  const interval = barInterval(bars);
  const white = color.white;
  const markers: MarkerData[] = [];
  const plot0 = bars.map((b, i) => ({ time: b.time, value: phase[i], color: color.yellow }));

  for (let i = 1; i < n; i++) {
    const p = phase[i];
    const p1 = phase[i - 1];
    const d1 = p - p1; // delta1
    const d1Prev = i >= 2 ? p1 - phase[i - 2] : NaN; // delta1[1]
    const newMoon = lt(p, 0.1) && lt(p1, 0.1) && gt(d1, 0) && lt(d1Prev, 0);
    const firstQuarter = lt(p1, 0.5) && ge(p, 0.5) && gt(d1, 0);
    const fullMoon = gt(p, 0.88) && gt(p1, 0.88) && le(d1, 0) && ge(d1Prev, 0);
    const lastQuarter = gt(p1, 0.5) && le(p, 0.5) && lt(d1, 0);
    // plotchar(cond ? lunarPhase[1] : na, title, char, location.absolute, color.white, size = size.tiny, offset = -1):
    // the value of bar i (the phase of bar i - 1) is drawn on bar i - 1
    const time = barTime(bars, i - 1, interval);
    const mark = (on: boolean, text: string) => {
      if (on && !isNaN(p1)) {
        markers.push({ time, position: 'atPriceMiddle', price: p1, shape: 'circle', color: 'transparent', text,
          textColor: white, size: 'tiny' });
      }
    };
    mark(newMoon, '🌑');
    mark(firstQuarter, '🌓');
    mark(fullMoon, '🌕');
    mark(lastQuarter, '🌗');
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
    markers,
  };
}

export const LunarPhase = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
