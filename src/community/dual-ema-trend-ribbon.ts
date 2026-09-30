/**
 * Dual EMA Trend Ribbon
 *
 * Two EMA pairs of the close: a fast ribbon (EMA 10 / EMA 30) and a slow ribbon (EMA 40 / EMA 50). Each ribbon is
 * the fill between its two EMAs, green when its fast EMA is above its slow EMA and red otherwise (light colours for
 * the fast ribbon, dark colours for the slow ribbon). The four EMAs are drawn as thin black lines.
 *
 * Reference: "Dual EMA Trend Ribbon (Multi-Timeframe Trend Confirmation)" by Aleksin_Aleksandar
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface DualEMATrendRibbonInputs {
  /** Fast EMA of ribbon 1 */
  fastLength1: number;
  /** Slow EMA of ribbon 1 */
  slowLength1: number;
  /** Fast EMA of ribbon 2 */
  fastLength2: number;
  /** Slow EMA of ribbon 2 */
  slowLength2: number;
}

export const defaultInputs: DualEMATrendRibbonInputs = {
  fastLength1: 10,
  slowLength1: 30,
  fastLength2: 40,
  slowLength2: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength1', type: 'int', title: 'Fast EMA 1  Period', defval: 10, min: 1 },
  { id: 'slowLength1', type: 'int', title: 'Slow EMA 1  Period', defval: 30, min: 1 },
  { id: 'fastLength2', type: 'int', title: 'Fast EMA 2  Period', defval: 40, min: 1 },
  { id: 'slowLength2', type: 'int', title: 'Slow EMA 2  Period', defval: 50, min: 1 },
];

// Pine colours: color.rgb(0, 0, 0), color.rgb(7, 0, 0), color.new(#070600, 0), color.new(#040505, 0)
const FAST1_COL = String(color.rgb(0, 0, 0));
const SLOW1_COL = String(color.rgb(7, 0, 0));
const FAST2_COL = String(color.new('#070600', 0));
const SLOW2_COL = String(color.new('#040505', 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast EMA 1', color: FAST1_COL, lineWidth: 1 },
  { id: 'plot1', title: 'Slow EMA 1', color: SLOW1_COL, lineWidth: 1 },
  { id: 'plot2', title: 'Fast EMA 2', color: FAST2_COL, lineWidth: 1 },
  { id: 'plot3', title: 'Slow EMA 2', color: SLOW2_COL, lineWidth: 1 },
];

export const metadata = {
  title: 'Dual EMA Band (On Chart)',
  shortTitle: 'DEMA-Band-OC',
  overlay: true,
};

/** Pine a > b: a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;

export function calculate(
  bars: Bar[],
  inputs: Partial<DualEMATrendRibbonInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const close = Series.fromArray(bars, bars.map((b) => b.close));
  const ema = (len: number) => ta.ema(close, len).toArray().map((v) => v ?? NaN);

  const fast1 = ema(cfg.fastLength1);
  const slow1 = ema(cfg.slowLength1);
  const fast2 = ema(cfg.fastLength2);
  const slow2 = ema(cfg.slowLength2);

  // ribbon_color_1 = fast_ema_1 > slow_ema_1 ? color.new(#4bd64f, 40) : color.new(#f31f1f, 40)
  const bull1 = String(color.new('#4bd64f', 40));
  const bear1 = String(color.new('#f31f1f', 40));
  // ribbon_color_2 = fast_ema_2 > slow_ema_2 ? color.new(#032404, 30) : color.new(#3d0202, 30)
  const bull2 = String(color.new('#032404', 30));
  const bear2 = String(color.new('#3d0202', 30));

  const line = (vals: number[], col: string) => bars.map((b, i) => ({ time: b.time, value: vals[i], color: col }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: line(fast1, FAST1_COL),
      plot1: line(slow1, SLOW1_COL),
      plot2: line(fast2, FAST2_COL),
      plot3: line(slow2, SLOW2_COL),
    },
    fills: [
      // fill(p_fast_1, p_slow_1, color = ribbon_color_1, title = "Trend Ribbon 1 Fill")
      { plot1: 'plot0', plot2: 'plot1', colors: bars.map((_, i) => (gt(fast1[i], slow1[i]) ? bull1 : bear1)) },
      // fill(p_fast_2, p_slow_2, color = ribbon_color_2, title = "Trend Ribbon 2 Fill")
      { plot1: 'plot2', plot2: 'plot3', colors: bars.map((_, i) => (gt(fast2[i], slow2[i]) ? bull2 : bear2)) },
    ],
    markers: [],
  };
}

export const DualEMATrendRibbon = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
