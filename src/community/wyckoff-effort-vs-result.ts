/**
 * Wyckoff Effort vs. Result
 *
 * A bar has high volume when its volume is above the SMA of the volume times a multiplier. A high-volume down bar
 * (close < open) is an accumulation effort, a high-volume up bar (close > open) a distribution effort. Effort bars
 * are coloured (red / green, 60 % transparent) and a line marks their open.
 *
 * Reference: "Wyckoff Effort vs. Result" by TradeTechanalysis
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © TradeTechanalysis
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface WyckoffEffortVsResultInputs {
  /** Length of the volume SMA */
  avgVolumeLength: number;
  /** Multiplier of the average volume that defines a high volume */
  volumeMultiplier: number;
}

export const defaultInputs: WyckoffEffortVsResultInputs = {
  avgVolumeLength: 50,
  volumeMultiplier: 1.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'avgVolumeLength', type: 'int', title: 'Average Volume Lookback', defval: 50, min: 1 },
  { id: 'volumeMultiplier', type: 'float', title: 'High Volume Multiplier', defval: 1.5, min: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Accumulation Line', color: String(color.new(color.red, 0)), lineWidth: 2, style: 'linebr' },
  { id: 'plot1', title: 'Distribution Line', color: String(color.new(color.green, 0)), lineWidth: 2, style: 'linebr' },
];

export const metadata = {
  title: 'Wyckoff Effort vs. Result',
  shortTitle: 'Wyckoff E/R',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<WyckoffEffortVsResultInputs> = {},
): IndicatorResult & { barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const volume = bars.map((b) => b.volume ?? NaN);
  const avgVolume = ta.sma(Series.fromArray(bars, volume), cfg.avgVolumeLength).toArray().map((v) => v ?? NaN);

  const accColor = String(color.new(color.red, 60));
  const distColor = String(color.new(color.green, 60));
  const accLine = String(color.new(color.red, 0));
  const distLine = String(color.new(color.green, 0));

  const plot0: { time: number; value: number; color: string }[] = [];
  const plot1: { time: number; value: number; color: string }[] = [];
  const barColors: BarColorData[] = [];
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const t = b.time as number;
    const isHighVolume = gt(volume[i], avgVolume[i] * cfg.volumeMultiplier);
    const isEffortAccumulation = gt(b.open, b.close) && isHighVolume;
    const isEffortDistribution = gt(b.close, b.open) && isHighVolume;
    // barcolor(accumulation ? color.new(color.red, 60) : distribution ? color.new(color.green, 60) : na)
    if (isEffortAccumulation) barColors.push({ time: t, color: accColor });
    else if (isEffortDistribution) barColors.push({ time: t, color: distColor });
    plot0.push({ time: t, value: isEffortAccumulation ? b.open : NaN, color: accLine });
    plot1.push({ time: t, value: isEffortDistribution ? b.open : NaN, color: distLine });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1 },
    barColors,
  };
}

export const WyckoffEffortVsResult = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
