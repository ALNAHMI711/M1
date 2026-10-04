/**
 * Net Volume Indicator
 *
 * Displays the net volume (upVolume - downVolume) for each bar, as one blue line, with a zero line.
 * Positive values indicate buying pressure, negative indicates selling pressure.
 *
 * The values are an estimate: the standard indicator splits the volume of each bar into up and down volume from
 * lower-timeframe (intrabar) volume, which the chart bars do not have. This implementation gives all the volume of a
 * bar to up or down volume by close vs open (0 when close equals open). The design (plot colour, zero line) is the
 * one of the standard indicator.
 *
 * Based on the standard Net Volume indicator.
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';

export interface NetVolumeInputs {
  // No configurable inputs in the standard indicator
}

export const defaultInputs: NetVolumeInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Net Volume', color: '#2962FF', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, color: '#787B86', linestyle: 'dashed', title: 'Zero' },
];

export const metadata = {
  title: 'Net Volume',
  shortTitle: 'Net Vol',
  overlay: false,
};

export function calculate(bars: Bar[], _inputs: Partial<NetVolumeInputs> = {}): IndicatorResult {
  const deltaValues: number[] = [];

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const volume = bar.volume ?? 0;

    // Determine delta based on close vs open
    let delta: number;
    if (bar.close > bar.open) {
      // Bullish bar - all volume is "up volume"
      delta = volume;
    } else if (bar.close < bar.open) {
      // Bearish bar - all volume is "down volume"
      delta = -volume;
    } else {
      // Neutral bar - no clear direction
      delta = 0;
    }

    deltaValues.push(delta);
  }

  const plotData = deltaValues.map((value, i) => ({
    time: bars[i].time,
    value: value,
  }));

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': plotData,
    },
  };
}

export const NetVolume = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
