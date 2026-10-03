/**
 * POC Volume Bar (Highest Volume in Range)
 *
 * Volume columns: aqua on up bars (close >= open), blue on down bars, and yellow on the bar whose volume equals the
 * highest volume of the last `length` bars.
 *
 * Reference: "POC Volume Bar (Highest Volume in Range)" by greatbrownball
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface PocVolumeBarInputs {
  /** Lookback bars for the highest volume */
  length: number;
}

export const defaultInputs: PocVolumeBarInputs = {
  length: 60,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Lookback bars for POC', defval: 60, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume', color: color.aqua, lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'POC Volume Bar (Highest Volume in Range)',
  shortTitle: 'POC Volume Bar (Highest Volume in Range)',
  overlay: false,
};

/** Pine float comparisons: a == b within 1e-10; a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

export function calculate(bars: Bar[], inputs: Partial<PocVolumeBarInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const volume = bars.map((b) => b.volume ?? NaN);
  const highestVol = ta.highest(Series.fromArray(bars, volume), cfg.length).toArray().map((v) => v ?? NaN);

  const plot0 = bars.map((b, i) => {
    const isPOC = eq(volume[i], highestVol[i]);
    const baseColor = ge(b.close, b.open) ? color.aqua : color.blue;
    return { time: b.time, value: volume[i], color: isPOC ? color.yellow : baseColor };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
  };
}

export const PocVolumeBar = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
