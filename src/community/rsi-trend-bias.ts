/**
 * RSI Trend Bias
 *
 * RSI of the close. A trend state starts bearish; it turns bullish when the RSI crosses over the upper threshold and
 * bearish when it crosses under the lower threshold. The RSI line has the bullish or bearish colour of the state,
 * with flat lines at the two thresholds. An optional background on the price pane shows the state.
 *
 * Reference: "RSI Trend Bias" by Botnet101
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Botnet101
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';

export interface RsiTrendBiasInputs {
  /** RSI length */
  rsiLength: number;
  /** Upper threshold */
  upperThreshold: number;
  /** Lower threshold */
  lowerThreshold: number;
  /** Colour the price pane background with the trend state */
  changeBackgroundColor: boolean;
  bullishColor: string;
  bearishColor: string;
  threshholdColor: string;
}

export const defaultInputs: RsiTrendBiasInputs = {
  rsiLength: 14,
  upperThreshold: 70,
  lowerThreshold: 30,
  changeBackgroundColor: false,
  bullishColor: color.green,
  bearishColor: color.red,
  threshholdColor: color.gray,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength', type: 'int', title: 'Length', defval: 14 },
  { id: 'upperThreshold', type: 'int', title: 'Upper', defval: 70 },
  { id: 'lowerThreshold', type: 'int', title: 'Lower', defval: 30 },
  { id: 'changeBackgroundColor', type: 'bool', title: 'Change Background Color?', defval: false },
  { id: 'bullishColor', type: 'color', title: 'Bullish Color', defval: color.green },
  { id: 'bearishColor', type: 'color', title: 'Bearish Color', defval: color.red },
  { id: 'threshholdColor', type: 'color', title: 'Threshold Color', defval: color.gray },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: color.red, lineWidth: 2 },
  { id: 'plot1', title: 'Upper Threshold', color: color.gray, lineWidth: 1 },
  { id: 'plot2', title: 'Lower Threshold', color: color.gray, lineWidth: 1 },
];

export const metadata = {
  title: 'RSI Trend Bias',
  shortTitle: 'RSI Trend Bias',
  overlay: false,
};

export function calculate(
  bars: Bar[],
  inputs: Partial<RsiTrendBiasInputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const close = Series.fromArray(bars, bars.map((b) => b.close));

  const rsiSeries = ta.rsi(close, cfg.rsiLength);
  const rsi = A(rsiSeries);
  // ta.crossover / ta.crossunder: exact comparisons with the last bar where both values were not na (oakscriptjs)
  const up = ta.crossover(rsiSeries, cfg.upperThreshold).toArray();
  const down = ta.crossunder(rsiSeries, cfg.lowerThreshold).toArray();

  const plot0: { time: number; value: number; color: string }[] = [];
  const bgColors: BgColorData[] = [];
  let trend = -1; // var trend = -1
  for (let i = 0; i < n; i++) {
    if (up[i]) trend = 1;
    if (down[i]) trend = -1;
    const col = trend === 1 ? cfg.bullishColor : cfg.bearishColor;
    const t = bars[i].time as number;
    plot0.push({ time: t, value: rsi[i], color: col });
    // bgcolor(changeBackgroundColor ? color.new(col, 90) : na, force_overlay = true)
    if (cfg.changeBackgroundColor) bgColors.push({ time: t, color: String(color.new(col, 90)), forceOverlay: true });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0,
      plot1: bars.map((b) => ({ time: b.time, value: cfg.upperThreshold, color: cfg.threshholdColor })),
      plot2: bars.map((b) => ({ time: b.time, value: cfg.lowerThreshold, color: cfg.threshholdColor })),
    },
    bgColors,
  };
}

export const RsiTrendBias = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
