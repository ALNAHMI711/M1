/**
 * MA Cross with Displacement
 *
 * Two SMAs of the close (9 and 21). A displacement bar is a bar whose close moves more than `threshold` percent
 * from the previous close: |close - close[1]| / close[1] * 100 > threshold. Up displacement bars are painted with
 * the bullish colour, down displacement bars with the bearish colour.
 *
 * Reference: "[TehThomas] - MA Cross with Displacement" by TehThomas
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, color, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface MaCrossWithDisplacementInputs {
  /** Length of the first SMA */
  maPeriod1: number;
  /** Length of the second SMA */
  maPeriod2: number;
  /** Displacement threshold (% of the previous close) */
  threshold: number;
  bullishColor: string;
  bearishColor: string;
}

export const defaultInputs: MaCrossWithDisplacementInputs = {
  maPeriod1: 9,
  maPeriod2: 21,
  threshold: 1.1,
  bullishColor: color.green,
  bearishColor: color.red,
};

export const inputConfig: InputConfig[] = [
  { id: 'maPeriod1', type: 'int', title: 'MA 1 Period', defval: 9, min: 1 },
  { id: 'maPeriod2', type: 'int', title: 'MA 2 Period', defval: 21, min: 1 },
  { id: 'threshold', type: 'float', title: 'Displacement Threshold (%)', defval: 1.1, min: 0.1, step: 0.1,
    tooltip: 'Percentage of the candle size', group: 'Candlesticks' },
  { id: 'bullishColor', type: 'color', title: 'Bullish Displacement Color', defval: color.green, group: 'Styles' },
  { id: 'bearishColor', type: 'color', title: 'Bearish Displacement Color', defval: color.red },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA 1', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'MA 2', color: color.red, lineWidth: 1 },
];

export const metadata = {
  title: '[TehThomas] - MA Cross with Displacement',
  shortTitle: '[TehThomas] - MA Cross with Displacement',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<MaCrossWithDisplacementInputs> = {},
): IndicatorResult & { barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const close = getSourceSeries(bars, 'close');
  const ma1 = ta.sma(close, cfg.maPeriod1).toArray().map((v) => v ?? NaN);
  const ma2 = ta.sma(close, cfg.maPeriod2).toArray().map((v) => v ?? NaN);

  const barColors: BarColorData[] = [];
  for (let i = 0; i < bars.length; i++) {
    const c = bars[i].close;
    const c1 = i > 0 ? bars[i - 1].close : NaN;
    // isDisplacement(close, threshold): math.abs(series - series[1]) / series[1] * 100 > threshold
    const disp = gt((Math.abs(c - c1) / c1) * 100, cfg.threshold);
    const bullish = disp && gt(c, c1);
    const bearish = disp && gt(c1, c);
    // barcolor(bullish ? bullish_color : bearish ? bearish_color : na)
    if (bullish) barColors.push({ time: bars[i].time, color: cfg.bullishColor });
    else if (bearish) barColors.push({ time: bars[i].time, color: cfg.bearishColor });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: ma1[i], color: color.blue })),
      plot1: bars.map((b, i) => ({ time: b.time, value: ma2[i], color: color.red })),
    },
    barColors,
  };
}

export const MaCrossWithDisplacement = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
