/**
 * Probabilities Module (Win Rate %)
 *
 * A simple trade model: a trade opens on a bearish bar (close < open) when no trade is open. An open trade closes
 * as a win (1) on a bullish bar (close > open), else as a loss (0) on a bar with close < close[1]. Each trade outcome
 * is pushed into an array; when the array holds more than `look` outcomes it is cleared. The plot is the average of
 * the array * 100 (na while the array is empty).
 *
 * Reference: "Win Rate % [The Quant Science]" by thequantscience
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { array, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface ProbabilitiesModuleTheQuantScienceInputs {
  /** Lookback period (trades) */
  look: number;
}

export const defaultInputs: ProbabilitiesModuleTheQuantScienceInputs = {
  look: 30,
};

export const inputConfig: InputConfig[] = [
  { id: 'look', type: 'int', title: 'Lookback period (Trades)', defval: 30, min: 1, max: 500 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Win Rate %', color: color.aqua, lineWidth: 1 },
];

export const metadata = {
  title: 'Win Rate % [The Quant Science]',
  shortTitle: 'Win Rate % [The Quant Science]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<ProbabilitiesModuleTheQuantScienceInputs> = {},
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;

  let inTrade = false; // var bool in_trade = false
  let tradeOutcome = NaN; // var int trade_outcome = na
  const results = array.new_float(0); // var results_array = array.new_float(0)
  const plot0: { time: number; value: number }[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const entryCondition = lt(b.close, b.open);
    const takeProfitCondExit = gt(b.close, b.open);
    const stopLossCondExit = i > 0 && lt(b.close, bars[i - 1].close);

    const isEntry = !inTrade && entryCondition;
    const isTp = inTrade && takeProfitCondExit;
    const isSl = inTrade && stopLossCondExit;

    if (isEntry) {
      inTrade = true;
      tradeOutcome = NaN;
    }
    if (isTp) {
      inTrade = false;
      tradeOutcome = 1;
    } else if (isSl) {
      inTrade = false;
      tradeOutcome = 0;
    }

    if (!isNaN(tradeOutcome) && (isTp || isSl)) {
      array.push(results, tradeOutcome);
      if (array.size(results) > cfg.look) array.clear(results);
      tradeOutcome = NaN;
    }

    // probabilities = array.size(results_array) > 0 ? array.avg(results_array) * 100 : na
    const value = array.size(results) > 0 ? array.avg(results) * 100 : NaN;
    plot0[i] = { time: b.time, value };
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
  };
}

export const ProbabilitiesModuleTheQuantScience = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
