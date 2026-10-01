/**
 * Intraday vs Overnight Change Tracker
 *
 * Two synthetic prices that start at the close of the second bar (bar_index 1). The intraday price is then multiplied
 * on each bar by close / open (the change during the bar), the overnight price by open / close[1] (the gap from the
 * prior close to the open). A choice shows one line or both.
 *
 * Reference: "Intraday vs Overnight Change Tracker" by TheUltimator5
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © TheUltimator5
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export type IntradayVsOvernightPlotChoice = 'Both Intraday and Overnight' | 'Intraday' | 'Overnight';

export interface IntradayVsOvernightChangeTrackerInputs {
  /** Synthetic price type */
  plotChoice: IntradayVsOvernightPlotChoice;
}

export const defaultInputs: IntradayVsOvernightChangeTrackerInputs = {
  plotChoice: 'Both Intraday and Overnight',
};

export const inputConfig: InputConfig[] = [
  {
    id: 'plotChoice', type: 'string', title: 'Synthetic Price Type', defval: 'Both Intraday and Overnight',
    options: ['Both Intraday and Overnight', 'Intraday', 'Overnight'],
  },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Intraday', color: color.orange, lineWidth: 2 },
  { id: 'plot1', title: 'Overnight', color: color.fuchsia, lineWidth: 2 },
];

export const metadata = {
  title: 'Intraday vs Overnight Change Tracker',
  shortTitle: 'Intraday vs Overnight Change Tracker',
  overlay: false,
};

export function calculate(
  bars: Bar[],
  inputs: Partial<IntradayVsOvernightChangeTrackerInputs> = {},
): IndicatorResult {
  const { plotChoice } = { ...defaultInputs, ...inputs };
  const showIntra = plotChoice === 'Intraday' || plotChoice === 'Both Intraday and Overnight';
  const showOver = plotChoice === 'Overnight' || plotChoice === 'Both Intraday and Overnight';

  const plot0: { time: number; value: number; color: string }[] = [];
  const plot1: { time: number; value: number; color: string }[] = [];
  let intradayPrice = NaN; // var float intradayPrice = na
  let overnightPrice = NaN; // var float overnightPrice = na
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const intradayChange = b.close / b.open;
    const overnightChange = i > 0 ? b.open / bars[i - 1].close : NaN;
    if (i === 1) {
      intradayPrice = b.close;
      overnightPrice = b.close;
    } else {
      intradayPrice = intradayPrice * intradayChange;
      overnightPrice = overnightPrice * overnightChange;
    }
    const intra = showIntra ? intradayPrice : NaN;
    const over = showOver ? overnightPrice : NaN;
    plot0.push({ time: b.time, value: Number.isFinite(intra) ? intra : NaN, color: color.orange });
    plot1.push({ time: b.time, value: Number.isFinite(over) ? over : NaN, color: color.fuchsia });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1 },
  };
}

export const IntradayVsOvernightChangeTracker = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
