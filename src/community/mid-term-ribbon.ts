/**
 * Mid-term Ribbon
 *
 * Two averages of the weighted price (3 * close + 2 * open + high + low) / 7: an EMA of 14 bars (fast) and an SMA
 * of 26 bars (slow). The ribbon between them is red when the fast line is below the slow line, else green.
 *
 * Reference: "Mid-term Ribbon" by Gartav388637
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

// The Pine script has no inputs
export interface MidTermRibbonInputs {}

export const defaultInputs: MidTermRibbonInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast EMA', color: color.white, lineWidth: 1 },
  { id: 'plot1', title: 'Slow SMA', color: color.yellow, lineWidth: 1 },
];

export const metadata = {
  title: 'Mid-term Ribbon',
  shortTitle: 'Mid-term Ribbon',
  overlay: true,
};

/** Pine a < b: b - a > 1e-10 (false with na) */
const lt = (a: number, b: number) => b - a > 1e-10;

export function calculate(bars: Bar[], _inputs: Partial<MidTermRibbonInputs> = {}): IndicatorResult {
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const price = Series.fromArray(bars, bars.map((b) => (3 * b.close + 2 * b.open + b.high + b.low) / 7));
  // outf = ta.ema((3*close + 2*open + high + low)/7, 14); outs = ta.sma(..., 26)
  const outf = A(ta.ema(price, 14));
  const outs = A(ta.sma(price, 26));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: outf[i], color: color.white })),
      plot1: bars.map((b, i) => ({ time: b.time, value: outs[i], color: color.yellow })),
    },
    // fill(a, b, outf < outs ? color.red : color.green)
    fills: [{ plot1: 'plot0', plot2: 'plot1', colors: outf.map((f, i) => (lt(f, outs[i]) ? color.red : color.green)) }],
  };
}

export const MidTermRibbon = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
