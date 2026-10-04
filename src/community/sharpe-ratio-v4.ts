/**
 * Sharpe Ratio v4 INDI
 *
 * The "average return" is the rate of change of the close over `lookbackLength` bars (ta.roc, in percent); the risk
 * is the standard deviation of that rate of change over the same number of bars. The Sharpe ratio is the return
 * divided by the risk. The return and risk lines are hidden by default; a horizontal line at 0.
 * The "Standard Deviation Multipliert" input is not used by the computation (as in the original script).
 *
 * Reference: "Sharpe Ratio v4 INDI" by Zettt
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';

export interface SharpeRatioV4Inputs {
  /** Lookback length of the rate of change and of its standard deviation */
  lookbackLength: number;
  /** Standard deviation multiplier (not used by the computation) */
  stdevMultiplier: number;
}

export const defaultInputs: SharpeRatioV4Inputs = {
  lookbackLength: 20,
  stdevMultiplier: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookbackLength', type: 'int', title: 'Lookback Length', defval: 20, min: 1 },
  { id: 'stdevMultiplier', type: 'float', title: 'Standard Deviation Multipliert', defval: 2, min: 1, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Average Return', color: color.red, lineWidth: 1, display: 'none' },
  { id: 'plot1', title: 'Risk', color: color.orange, lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Sharpe Ratio', color: color.blue, lineWidth: 1 },
];

/** hline(0) with the Pine default style (colour #787B86, dashed, width 1) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, title: 'Level', color: '#787B86', linestyle: 'dashed', linewidth: 1 },
];

export const metadata = {
  title: 'Sharpe Ratio v4 INDI',
  shortTitle: 'Sharpe Ratio v4 INDI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<SharpeRatioV4Inputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

  // averageReturn = ta.roc(close, lookbackLength); stdev = ta.stdev(averageReturn, lookbackLength)
  const averageReturn = A(ta.roc(S(bars.map((b) => b.close)), cfg.lookbackLength));
  const stdev = A(ta.stdev(S(averageReturn), cfg.lookbackLength));
  // sharpe = averageReturn / stdev: a plain division (x / 0 is +-infinity, shown as na)
  const sharpe = averageReturn.map((r, i) => r / stdev[i]);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: fin(averageReturn[i]), color: color.red })),
      plot1: bars.map((b, i) => ({ time: b.time, value: fin(stdev[i]), color: color.orange })),
      plot2: bars.map((b, i) => ({ time: b.time, value: fin(sharpe[i]), color: color.blue })),
    },
    hlines: [{ value: 0, options: { title: 'Level', color: '#787B86', linestyle: 'dashed', linewidth: 1 } }],
  };
}

export const SharpeRatioV4 = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
