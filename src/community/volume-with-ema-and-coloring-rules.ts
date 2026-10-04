/**
 * Volume with EMA and Coloring Rules
 *
 * The volume as a histogram with the EMA of the volume over `emaLength` bars. A volume bar is blue when the volume
 * is above its EMA, white otherwise. The EMA is a red line.
 *
 * Reference: "Volume with EMA and Coloring Rules" by itisfilipe
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface VolumeWithEmaAndColoringRulesInputs {
  /** EMA length of the volume */
  emaLength: number;
}

export const defaultInputs: VolumeWithEmaAndColoringRulesInputs = {
  emaLength: 500,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 500, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume', color: color.blue, lineWidth: 3, style: 'histogram' },
  { id: 'plot1', title: 'Volume EMA', color: color.red, lineWidth: 2 },
];

export const metadata = {
  title: 'Volume with EMA and Coloring Rules',
  shortTitle: 'VolEMA',
  overlay: false,
  format: 'volume',
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(bars: Bar[], inputs: Partial<VolumeWithEmaAndColoringRulesInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const volume = bars.map((b) => b.volume ?? NaN);
  const volEMA = A(ta.ema(Series.fromArray(bars, volume), cfg.emaLength));

  // barColor = volume > volEMA ? color.blue : color.white
  const plot0 = bars.map((b, i) => ({
    time: b.time, value: volume[i], color: gt(volume[i], volEMA[i]) ? color.blue : color.white,
  }));
  const plot1 = bars.map((b, i) => ({ time: b.time, value: volEMA[i], color: color.red }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, format: metadata.format },
    plots: { plot0, plot1 },
  };
}

export const VolumeWithEmaAndColoringRules = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
