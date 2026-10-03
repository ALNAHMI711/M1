/**
 * Dynamic Stop Loss & Take Profit
 *
 * Stop loss and take profit levels around the close, at a multiple of the ATR. Long trades: stop = close - ATR *
 * slMultiplier, target = close + ATR * tpMultiplier; short trades: the other side of the close.
 *
 * Reference: "Dynamic Stop Loss & Take Profit" by criptoblast2
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type Series } from 'oakscriptjs';

export interface DynamicStopLossTakeProfitInputs {
  /** ATR length */
  atrLength: number;
  /** Stop loss multiplier of the ATR */
  slMultiplier: number;
  /** Take profit multiplier of the ATR */
  tpMultiplier: number;
  /** Trade type */
  tradeType: 'Long' | 'Short';
}

export const defaultInputs: DynamicStopLossTakeProfitInputs = {
  atrLength: 14,
  slMultiplier: 1.5,
  tpMultiplier: 3,
  tradeType: 'Long',
};

export const inputConfig: InputConfig[] = [
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14 },
  { id: 'slMultiplier', type: 'float', title: 'Stop Loss Multiplier', defval: 1.5, min: 1.5, max: 4, step: 0.5 },
  { id: 'tpMultiplier', type: 'float', title: 'Take Profit Multiplier', defval: 3, min: 2, max: 5, step: 0.5 },
  { id: 'tradeType', type: 'string', title: 'Trade Type', defval: 'Long', options: ['Long', 'Short'] },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Stop Loss', color: color.red, lineWidth: 1 },
  { id: 'plot1', title: 'Take Profit', color: color.lime, lineWidth: 1 },
];

export const metadata = {
  title: 'Dynamic Stop Loss & Take Profit',
  shortTitle: 'Dynamic Stop Loss & Take Profit',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<DynamicStopLossTakeProfitInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const atr = A(ta.atr(bars, cfg.atrLength));
  const isLong = cfg.tradeType === 'Long';

  const plot0 = bars.map((b, i) => {
    const sl = atr[i] * cfg.slMultiplier;
    return { time: b.time, value: isLong ? b.close - sl : b.close + sl, color: color.red };
  });
  const plot1 = bars.map((b, i) => {
    const tp = atr[i] * cfg.tpMultiplier;
    return { time: b.time, value: isLong ? b.close + tp : b.close - tp, color: color.lime };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1 },
  };
}

export const DynamicStopLossTakeProfit = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
