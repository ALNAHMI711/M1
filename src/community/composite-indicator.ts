/**
 * Composite Indicator (CCI + ATR)
 *
 * Buy when the CCI of hlc3 crosses over -threshold while the ATR is above its SMA times the buy multiplier; sell
 * when the CCI crosses under +threshold while the ATR is above its SMA times the sell multiplier. On a signal bar a
 * stop loss point is drawn: low - ATR * stop multiplier (buy) or high + ATR * stop multiplier (sell).
 *
 * Reference: "Composite Indicator (CCI + ATR)" by CharLi0t
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Charlie_Cai
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface CompositeIndicatorInputs {
  /** CCI length */
  cciLength: number;
  /** CCI threshold (buy: cross over -threshold, sell: cross under +threshold) */
  cciThreshold: number;
  /** ATR length (also the length of the ATR SMA) */
  atrLength: number;
  /** ATR multiplier of the buy filter */
  atrBuyMultiplier: number;
  /** ATR multiplier of the sell filter */
  atrSellMultiplier: number;
  /** ATR multiplier of the stop loss */
  atrMultiplier: number;
}

export const defaultInputs: CompositeIndicatorInputs = {
  cciLength: 20,
  cciThreshold: 100,
  atrLength: 14,
  atrBuyMultiplier: 1.0,
  atrSellMultiplier: 0.95,
  atrMultiplier: 1.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'cciLength', type: 'int', title: 'CCI Length', defval: 20 },
  { id: 'cciThreshold', type: 'int', title: 'CCI Threshold', defval: 100 },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14 },
  { id: 'atrBuyMultiplier', type: 'float', title: 'ATR Multiplier for Buy Signal', defval: 1.0 },
  { id: 'atrSellMultiplier', type: 'float', title: 'ATR Multiplier for Sell Signal', defval: 0.95 },
  { id: 'atrMultiplier', type: 'float', title: 'ATR Multiplier for Stop Loss', defval: 1.5 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Long Stop Loss', color: color.green, lineWidth: 1 },
  { id: 'plot1', title: 'Short Stop Loss', color: color.red, lineWidth: 1 },
];

export const metadata = {
  title: 'Composite Indicator (CCI + ATR)',
  shortTitle: 'Composite Indicator (CCI + ATR)',
  overlay: true,
};

/** Pine float comparison: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;

export function calculate(
  bars: Bar[],
  inputs: Partial<CompositeIndicatorInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  // cciSource = (high + low + close) / 3
  const cciSource = Series.fromArray(bars, bars.map((b) => (b.high + b.low + b.close) / 3));
  const cci = A(ta.cci(cciSource, cfg.cciLength));
  const atr = A(ta.atr(bars, cfg.atrLength));
  const atrSma = A(ta.sma(Series.fromArray(bars, atr), cfg.atrLength));

  const lower = -cfg.cciThreshold;
  const upper = cfg.cciThreshold;
  const markers: MarkerData[] = [];
  const longStop: { time: number; value: number }[] = [];
  const shortStop: { time: number; value: number }[] = [];
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    // ta.crossover / ta.crossunder compare exactly (na compares false)
    const crossUp = i > 0 && cci[i] > lower && cci[i - 1] <= lower;
    const crossDown = i > 0 && cci[i] < upper && cci[i - 1] >= upper;
    const buySignal = crossUp && gt(atr[i], cfg.atrBuyMultiplier * atrSma[i]);
    const sellSignal = crossDown && gt(atr[i], cfg.atrSellMultiplier * atrSma[i]);
    if (buySignal) {
      markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'B',
        textColor: color.white });
    }
    if (sellSignal) {
      markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'S',
        textColor: color.white });
    }
    // plot(buySignal ? low - atr * atr_multiplier : na), plot(sellSignal ? high + atr * atr_multiplier : na)
    longStop.push({ time: b.time, value: buySignal ? b.low - atr[i] * cfg.atrMultiplier : NaN });
    shortStop.push({ time: b.time, value: sellSignal ? b.high + atr[i] * cfg.atrMultiplier : NaN });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: longStop, plot1: shortStop },
    markers,
  };
}

export const CompositeIndicator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
