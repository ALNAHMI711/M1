/**
 * Volume Spike Indicator
 *
 * Marks the bars where the volume is more than 4 times its 20-bar simple moving average. Each such bar gets a red
 * cross and a red x-cross above the bar. The length (20) and the multiplier (4) are constants of the script.
 *
 * Reference: "Volume Spike Indicator" by rikyu04
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export type VolumeSpikeIndicatorInputs = Record<string, never>;

export const defaultInputs: VolumeSpikeIndicatorInputs = {};

export const inputConfig: InputConfig[] = [];

// No plot(): plotshape markers only
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Volume Spike Indicator',
  shortTitle: 'Volume Spike Indicator',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(
  bars: Bar[],
  _inputs: Partial<VolumeSpikeIndicatorInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const length = 20; // Moving average period
  const spikeMultiplier = 4; // Spike multiplier

  const volume = bars.map((b) => b.volume ?? NaN);
  const volumeSMA = ta.sma(Series.fromArray(bars, volume), length).toArray().map((v) => v ?? NaN);

  const red = String(color.red);
  const markers: MarkerData[] = [];
  bars.forEach((b, i) => {
    const isVolumeSpike = gt(volume[i], volumeSMA[i] * spikeMultiplier);
    if (!isVolumeSpike) return;
    // plotshape(isVolumeSpike, style = shape.cross, location.abovebar, color.red, size.small, title = "Cross")
    markers.push({ time: b.time, position: 'aboveBar', shape: 'cross', color: red, size: 'small' });
    // plotshape(isVolumeSpike, style = shape.xcross, location.abovebar, color.red, size.small, title = "X-Cross")
    markers.push({ time: b.time, position: 'aboveBar', shape: 'xcross', color: red, size: 'small' });
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
  };
}

export const VolumeSpikeIndicator = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
