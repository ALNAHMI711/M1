/**
 * Relative Volume Indicator (RVOL)
 *
 * Relative volume = volume / SMA(volume, lookback), drawn as columns. The column is red below the average volume
 * threshold, yellow below the above-average threshold, green below the extreme threshold and fuchsia otherwise.
 * Dotted horizontal lines at the three thresholds.
 *
 * Reference: "Relative Volume Indicator (RVOL)" by AlgoCollective
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface RelativeVolumeIndicatorInputs {
  /** Length of the SMA of the volume */
  lookbackPeriod: number;
  averageVolumeThreshold: number;
  aboveAverageThreshold: number;
  extremeVolumeThreshold: number;
  belowAvgColor: string;
  avgColor: string;
  aboveAvgColor: string;
  extremeColor: string;
}

export const defaultInputs: RelativeVolumeIndicatorInputs = {
  lookbackPeriod: 20,
  averageVolumeThreshold: 0.8,
  aboveAverageThreshold: 1.25,
  extremeVolumeThreshold: 4.0,
  belowAvgColor: color.red,
  avgColor: color.yellow,
  aboveAvgColor: color.green,
  extremeColor: color.fuchsia,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookbackPeriod', type: 'int', title: 'Average Volume Lookback Period', defval: 20, min: 1, group: 'Settings' },
  { id: 'averageVolumeThreshold', type: 'float', title: 'Average Volume Threshold', defval: 0.8, min: 0.1, step: 0.1, group: 'Settings' },
  { id: 'aboveAverageThreshold', type: 'float', title: 'Above Average Threshold', defval: 1.25, min: 0.5, step: 0.05, group: 'Settings' },
  { id: 'extremeVolumeThreshold', type: 'float', title: 'Extreme Volume Threshold', defval: 4.0, min: 1.5, step: 0.5, group: 'Settings' },
  { id: 'belowAvgColor', type: 'color', title: 'Below Average Color', defval: color.red, group: 'Colors', inline: 'color_below' },
  { id: 'avgColor', type: 'color', title: 'Average Color', defval: color.yellow, group: 'Colors', inline: 'color_avg' },
  { id: 'aboveAvgColor', type: 'color', title: 'Above Average Color', defval: color.green, group: 'Colors', inline: 'color_above' },
  { id: 'extremeColor', type: 'color', title: 'Extreme Color', defval: color.fuchsia, group: 'Colors', inline: 'color_extreme' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Relative Volume', color: color.red, lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'Relative Volume Indicator (RVOL)',
  shortTitle: 'Relative Volume Indicator (RVOL)',
  overlay: false,
  precision: 1,
  format: 'volume',
};

/** Pine a < b: b - a > 1e-10 (false with na) */
const lt = (a: number, b: number) => b - a > 1e-10;

export function calculate(bars: Bar[], inputs: Partial<RelativeVolumeIndicatorInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  const averageVolume = A(ta.sma(Series.fromArray(bars, bars.map((b) => b.volume ?? NaN)), cfg.lookbackPeriod));

  const plot0 = bars.map((b, i) => {
    // A plain division: x / 0 is +-infinity (0 / 0 NaN); the comparisons use the infinite value, the plot shows na
    const rv = (b.volume ?? NaN) / averageVolume[i];
    const c = lt(rv, cfg.averageVolumeThreshold) ? cfg.belowAvgColor
      : lt(rv, cfg.aboveAverageThreshold) ? cfg.avgColor
        : lt(rv, cfg.extremeVolumeThreshold) ? cfg.aboveAvgColor
          : cfg.extremeColor;
    return { time: b.time, value: Number.isFinite(rv) ? rv : NaN, color: c };
  });

  return {
    metadata: {
      title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay,
      precision: metadata.precision, format: metadata.format,
    },
    plots: { plot0 },
    hlines: [
      { value: cfg.averageVolumeThreshold, options: { title: 'Average Volume Threshold', color: color.gray, linestyle: 'dotted', linewidth: 1 } },
      { value: cfg.aboveAverageThreshold, options: { title: 'Above Average Threshold', color: color.gray, linestyle: 'dotted', linewidth: 1 } },
      { value: cfg.extremeVolumeThreshold, options: { title: 'Extreme Volume Threshold', color: color.fuchsia, linestyle: 'dotted', linewidth: 1 } },
    ],
  };
}

export const RelativeVolumeIndicator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
