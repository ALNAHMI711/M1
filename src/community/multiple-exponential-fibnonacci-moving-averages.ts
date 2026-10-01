/**
 * Multiple Exponential Fibnonacci Moving Averages
 *
 * Six moving averages of the source with Fibonacci lengths (21, 55, 144, 233, 377, 610): EMAs, except the fifth
 * line, which is an SMA in the original script (its title stays 'EMA5'). Colours go from cyan to dark teal.
 *
 * Reference: "Multiple Exponential Fibnonacci Moving Averages" by LensOfChartist
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface MultipleExponentialFibnonacciMovingAveragesInputs {
  /** Source */
  src: SourceType;
  /** EMA length of line 1 */
  ema1: number;
  /** EMA length of line 2 */
  ema2: number;
  /** EMA length of line 3 */
  ema3: number;
  /** EMA length of line 4 */
  ema4: number;
  /** SMA length of line 5 */
  ema5: number;
  /** EMA length of line 6 */
  ema6: number;
}

export const defaultInputs: MultipleExponentialFibnonacciMovingAveragesInputs = {
  src: 'close',
  ema1: 21,
  ema2: 55,
  ema3: 144,
  ema4: 233,
  ema5: 377,
  ema6: 610,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'src', defval: 'close' },
  { id: 'ema1', type: 'int', title: 'EMA1', defval: 21 },
  { id: 'ema2', type: 'int', title: 'EMA2', defval: 55 },
  { id: 'ema3', type: 'int', title: 'EMA3', defval: 144 },
  { id: 'ema4', type: 'int', title: 'EMA4', defval: 233 },
  { id: 'ema5', type: 'int', title: 'EMA5', defval: 377 },
  { id: 'ema6', type: 'int', title: 'EMA6', defval: 610 },
];

const COLORS = [
  String(color.rgb(0, 230, 250)),
  String(color.rgb(10, 210, 230)),
  String(color.rgb(20, 190, 210)),
  String(color.rgb(30, 170, 190)),
  String(color.rgb(40, 150, 170)),
  String(color.rgb(50, 130, 150)),
];

export const plotConfig: PlotConfig[] = COLORS.map((c, k) => ({
  id: `plot${k}`, title: `EMA${k + 1}`, color: c, lineWidth: 1,
}));

export const metadata = {
  title: 'Multiple Exponential Fibnonacci Moving Averages',
  shortTitle: 'MEFMA',
  overlay: true,
};

export function calculate(
  bars: Bar[],
  inputs: Partial<MultipleExponentialFibnonacciMovingAveragesInputs> = {},
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const src = getSourceSeries(bars, cfg.src);
  // pema1..pema6: ta.ema, except pema5 = ta.sma(src, ema5)
  const lines = [
    ta.ema(src, cfg.ema1),
    ta.ema(src, cfg.ema2),
    ta.ema(src, cfg.ema3),
    ta.ema(src, cfg.ema4),
    ta.sma(src, cfg.ema5),
    ta.ema(src, cfg.ema6),
  ].map((s) => s.toArray().map((v) => v ?? NaN));

  const plots: IndicatorResult['plots'] = {};
  lines.forEach((vals, k) => {
    plots[`plot${k}`] = bars.map((b, i) => ({ time: b.time, value: vals[i], color: COLORS[k] }));
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
  };
}

export const MultipleExponentialFibnonacciMovingAverages = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
