/**
 * 12/26 EMA Inflection Zones
 *
 * EMA 12 and EMA 26 of the close. The background is green while EMA 12 is above EMA 26 and red while it is below.
 * A green circle below the bar marks a crossover of EMA 12 above EMA 26, a red circle above the bar a crossunder.
 *
 * Reference: "12/26 EMA Inflection Zones by Korax" by Korax
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';

// The Pine script has no inputs
export interface EmaInflectionZonesKoraxInputs {}

export const defaultInputs: EmaInflectionZonesKoraxInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA 12', color: color.blue, lineWidth: 2 },
  { id: 'plot1', title: 'EMA 26', color: color.red, lineWidth: 2 },
];

export const metadata = {
  title: '12/26 EMA Inflection Zones',
  shortTitle: '12/26 EMA Inflection Zones',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(
  bars: Bar[],
  _inputs: Partial<EmaInflectionZonesKoraxInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } {
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const close = Series.fromArray(bars, bars.map((b) => b.close));
  const ema12 = A(ta.ema(close, 12));
  const ema26 = A(ta.ema(close, 26));

  const bullBg = String(color.new(color.green, 85));
  const bearBg = String(color.new(color.red, 85));
  const bgColors: BgColorData[] = [];
  const markers: MarkerData[] = [];
  // ta.crossover / ta.crossunder compare exactly, with the last bar where both values were not na
  let prevA = NaN;
  let prevB = NaN;
  for (let i = 0; i < n; i++) {
    const a = ema12[i];
    const b = ema26[i];
    const valid = !isNaN(a) && !isNaN(b);
    const bullCross = valid && !isNaN(prevA) && a > b && prevA <= prevB;
    const bearCross = valid && !isNaN(prevA) && a < b && prevA >= prevB;
    if (valid) {
      prevA = a;
      prevB = b;
    }
    // bgcolor(bullishArea ? color.new(color.green, 85) : na); bgcolor(bearishArea ? color.new(color.red, 85) : na)
    if (gt(a, b)) bgColors.push({ time: bars[i].time, color: bullBg });
    else if (gt(b, a)) bgColors.push({ time: bars[i].time, color: bearBg });
    if (bullCross) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'circle', color: color.green, size: 'small' });
    }
    if (bearCross) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'circle', color: color.red, size: 'small' });
    }
  }

  const plot0 = bars.map((b, i) => ({ time: b.time, value: ema12[i] }));
  const plot1 = bars.map((b, i) => ({ time: b.time, value: ema26[i] }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1 },
    markers,
    bgColors,
  };
}

export const EmaInflectionZonesKorax = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
