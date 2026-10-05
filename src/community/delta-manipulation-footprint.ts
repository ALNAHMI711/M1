/**
 * Delta Manipulation Footprint
 *
 * Bar volume delta: + volume on an up or flat candle (close >= open), - volume on a down candle. The change of this
 * delta from the previous bar is significant when its absolute value is above the SMA of the absolute changes times
 * a multiplier. Significant bars are coloured: green (up candle, delta rising), red (down candle, delta falling),
 * yellow (candle and delta in opposite directions).
 *
 * Reference: "Delta Manipulation Footprint" by destrobr0685
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface DeltaManipulationFootprintInputs {
  /** SMA length of the absolute delta change */
  length: number;
  /** Threshold multiplier of the SMA */
  thresholdMultiplier: number;
}

export const defaultInputs: DeltaManipulationFootprintInputs = {
  length: 20,
  thresholdMultiplier: 1.9,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Moving Average Length', defval: 20 },
  { id: 'thresholdMultiplier', type: 'float', title: 'Threshold Multiplier', defval: 1.9 },
];

/** No plot: the only output is the bar colour */
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Delta Manipulation Footprint',
  shortTitle: 'Delta Manipulation Footprint',
  overlay: true,
};

/** Pine a > b: a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;
/** Pine a >= b: not (b > a), false with na */
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > 1e-10);
/** Pine a < b */
const lt = (a: number, b: number) => b - a > 1e-10;

export function calculate(
  bars: Bar[],
  inputs: Partial<DeltaManipulationFootprintInputs> = {},
): IndicatorResult & { barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const vol = (b: Bar) => b.volume ?? NaN;

  // aggDelta = buyVol - sellVol, buyVol = volume * (close >= open ? 1 : 0), sellVol = volume * (close < open ? 1 : 0)
  const aggDelta = bars.map((b) => vol(b) * (ge(b.close, b.open) ? 1 : 0) - vol(b) * (lt(b.close, b.open) ? 1 : 0));
  // deltaDiff = aggDelta - nz(aggDelta[1], 0)
  const deltaDiff = aggDelta.map((d, i) => {
    const prev = i > 0 ? aggDelta[i - 1] : NaN;
    return d - (Number.isFinite(prev) ? prev : 0);
  });
  const absDeltaDiff = deltaDiff.map((d) => Math.abs(d));
  const avgAbs = ta.sma(Series.fromArray(bars, absDeltaDiff), cfg.length).toArray().map((v) => v ?? NaN);

  const barColors: BarColorData[] = [];
  for (let i = 0; i < n; i++) {
    const threshold = avgAbs[i] * cfg.thresholdMultiplier;
    if (!gt(absDeltaDiff[i], threshold)) continue; // isSignificantDelta
    const candleIsPositive = ge(bars[i].close, bars[i].open);
    const deltaIsPositive = gt(deltaDiff[i], 0);
    let c: string;
    if (candleIsPositive && deltaIsPositive) c = color.green; // candle up and delta rising
    else if (!candleIsPositive && !deltaIsPositive) c = color.red; // candle down and delta falling
    else c = color.yellow; // candle and delta in opposite directions (divergence)
    barColors.push({ time: bars[i].time, color: c });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    barColors,
  };
}

export const DeltaManipulationFootprint = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
