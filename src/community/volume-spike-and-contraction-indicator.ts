/**
 * Volume Spike and Contraction Indicator
 *
 * Bands around the simple moving average of the volume: upper = SMA + spike sensitivity * stdev, lower = SMA -
 * contraction sensitivity * stdev (both over the MA length). A volume spike is a crossover of the volume above the
 * upper band; a volume contraction is a crossunder of the volume below the lower band on a closed bar. A spike is
 * marked with '💥' below a bull bar (close > open) or above any other bar; a contraction with '↗' below a bull bar or
 * '⤵' above any other bar.
 *
 * Reference: "Volume Spike and Contraction Indicator" by epicurusMcPot
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © epicurusMcPot
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface VolumeSpikeAndContractionInputs {
  /** Length of the volume SMA and stdev */
  maLength: number;
  /** Stdev multiplier of the upper band (spikes) */
  mult: number;
  /** Stdev multiplier of the lower band (contractions) */
  mult2: number;
}

export const defaultInputs: VolumeSpikeAndContractionInputs = {
  maLength: 20,
  mult: 3,
  mult2: 1,
};

export const inputConfig: InputConfig[] = [
  { id: 'maLength', type: 'int', title: 'Volume MA length', defval: 20 },
  { id: 'mult', type: 'float', title: 'Sensitivity of Spikes', defval: 3, min: 0.1, step: 0.1 },
  { id: 'mult2', type: 'float', title: 'Sensitivity of Contractions', defval: 1, min: 0.1, step: 0.1 },
];

// No plot(): the outputs are four plotchar markers
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Volume Spike and Contraction Indicator',
  shortTitle: 'Volume Spike and Contraction Indicator',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<VolumeSpikeAndContractionInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  const volume = new Series(bars, (b) => b.volume ?? NaN);
  const volMA = A(ta.sma(volume, cfg.maLength));
  const volDev = A(ta.stdev(volume, cfg.maLength)).map((v) => cfg.mult * v);
  const volDev2 = A(ta.stdev(volume, cfg.maLength)).map((v) => cfg.mult2 * v);
  const upperDevVol1 = volMA.map((v, i) => v + volDev[i]);
  const lowerDevVol1 = volMA.map((v, i) => v - volDev2[i]);

  // ta.crossover / ta.crossunder compare exactly (library functions)
  const volumeSpike = ta.crossover(volume, S(upperDevVol1)).toArray();
  // volumeContraction = ta.crossunder(volume, lowerDevVol1) and barstate.isconfirmed (every bar is a closed bar)
  const volumeContraction = ta.crossunder(volume, S(lowerDevVol1)).toArray();

  const yellow = String(color.yellow);
  const aqua = String(color.aqua);
  const markers: MarkerData[] = [];
  // plotchar(..., char, location, color, size = size.small, force_overlay = true): transparent shape, the char as text
  const mark = (time: number, position: 'aboveBar' | 'belowBar', text: string, textColor: string) =>
    markers.push({ time, position, shape: 'circle', color: 'transparent', text, textColor, size: 'small',
      forceOverlay: true });
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const isBullCandle = gt(b.close, b.open);
    const spike = !!volumeSpike[i];
    const contraction = !!volumeContraction[i];
    if (spike && isBullCandle) mark(b.time, 'belowBar', '💥', yellow);
    if (spike && !isBullCandle) mark(b.time, 'aboveBar', '💥', yellow);
    if (contraction && isBullCandle) mark(b.time, 'belowBar', '↗', aqua);
    if (contraction && !isBullCandle) mark(b.time, 'aboveBar', '⤵', aqua);
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
  };
}

export const VolumeSpikeAndContractionIndicator = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
