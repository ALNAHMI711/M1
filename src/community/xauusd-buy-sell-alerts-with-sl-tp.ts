/**
 * XAUUSD Buy/Sell Alerts with SL & TP
 *
 * Fast and slow EMAs of the close. Buy: the fast EMA crosses over the slow EMA while RSI < 60. Sell: the fast EMA
 * crosses under the slow EMA while RSI > 40. The Pine script also sends alert() messages with the entry, the stop
 * loss (close -/+ stopLossPips * 0.01) and the take profit (close +/- takeProfitPips * 0.01); alerts have no chart
 * output, so the two pip inputs only take part in the alert text.
 *
 * Reference: "XAUUSD Buy/Sell Alerts with SL & TP" by alexandrossolomou1
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface XauusdBuySellAlertsWithSlTpInputs {
  emaFastLen: number;
  emaSlowLen: number;
  rsiLen: number;
  /** Stop loss in pips of 0.01 (alert text only) */
  stopLossPips: number;
  /** Take profit in pips of 0.01 (alert text only) */
  takeProfitPips: number;
}

export const defaultInputs: XauusdBuySellAlertsWithSlTpInputs = {
  emaFastLen: 9,
  emaSlowLen: 21,
  rsiLen: 14,
  stopLossPips: 300,
  takeProfitPips: 1000,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaFastLen', type: 'int', title: 'Fast EMA Length', defval: 9 },
  { id: 'emaSlowLen', type: 'int', title: 'Slow EMA Length', defval: 21 },
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14 },
  { id: 'stopLossPips', type: 'int', title: 'Stop Loss (pips)', defval: 300 },
  { id: 'takeProfitPips', type: 'int', title: 'Take Profit (pips)', defval: 1000 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast EMA', color: color.green, lineWidth: 1 },
  { id: 'plot1', title: 'Slow EMA', color: color.red, lineWidth: 1 },
];

export const metadata = {
  title: 'XAUUSD Buy/Sell Alerts with SL & TP',
  shortTitle: 'XAUUSD Buy/Sell Alerts with SL & TP',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<XauusdBuySellAlertsWithSlTpInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const close = Series.fromArray(bars, bars.map((b) => b.close));
  const emaFast = A(ta.ema(close, cfg.emaFastLen));
  const emaSlow = A(ta.ema(close, cfg.emaSlowLen));
  const rsi = A(ta.rsi(close, cfg.rsiLen));

  const markers: MarkerData[] = [];
  for (let i = 1; i < n; i++) {
    // ta.crossover / ta.crossunder: exact comparisons (no tolerance), a tie on the previous bar counts
    const crossUp = emaFast[i] > emaSlow[i] && emaFast[i - 1] <= emaSlow[i - 1];
    const crossDown = emaFast[i] < emaSlow[i] && emaFast[i - 1] >= emaSlow[i - 1];
    // plotshape(buySignal, "Buy Signal", location.belowbar, color.green, shape.labelup, text = "BUY")
    if (crossUp && lt(rsi[i], 60)) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'BUY', textColor: color.blue });
    }
    // plotshape(sellSignal, "Sell Signal", location.abovebar, color.red, shape.labeldown, text = "SELL")
    if (crossDown && gt(rsi[i], 40)) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL', textColor: color.blue });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: emaFast[i] })),
      plot1: bars.map((b, i) => ({ time: b.time, value: emaSlow[i] })),
    },
    markers,
  };
}

export const XauusdBuySellAlertsWithSlTp = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
