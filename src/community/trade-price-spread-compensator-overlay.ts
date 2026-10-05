/**
 * Trade Price - Spread Compensator
 *
 * Ask and bid candles shifted from the chart prices by a spread: spread = spread (pips) / decimal units. The ask
 * candle is (close, high + spread, low + spread, close + spread), the bid candle (close, high - spread, low - spread,
 * close - spread); both open at the close, as the original script. The anchor mode shows the ask candle, the bid
 * candle or both.
 *
 * Reference: "Trade Price – Spread Compensator" by The_Forex_Steward
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';

export interface TradePriceSpreadCompensatorOverlayInputs {
  /** Spread in pips */
  spreadPips: number;
  /** Candles shown: Ask, Bid or Both */
  anchorMode: 'Ask' | 'Bid' | 'Both';
  /** Decimal units (pips per price unit) */
  decUnit: number;
}

export const defaultInputs: TradePriceSpreadCompensatorOverlayInputs = {
  spreadPips: 2.0,
  anchorMode: 'Both',
  decUnit: 10000,
};

export const inputConfig: InputConfig[] = [
  { id: 'spreadPips', type: 'float', title: 'Spread (pips)', defval: 2.0, step: 0.1 },
  { id: 'anchorMode', type: 'string', title: 'Anchor Mode', defval: 'Both', options: ['Ask', 'Bid', 'Both'] },
  { id: 'decUnit', type: 'int', title: 'Decimal Units', defval: 10000, min: 1, max: 100000 }, // Pine options = [1, 10, 100, 1000, 10000, 100000]
];

// No plot(): the outputs are two plotcandle series
export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [
  { id: 'ask', title: 'Ask Candle' },
  { id: 'bid', title: 'Bid Candle' },
];

export const metadata = {
  title: 'Trade Price – Spread Compensator',
  shortTitle: 'Trade Price – Spread Compensator',
  overlay: true,
};

export function calculate(
  bars: Bar[],
  inputs: Partial<TradePriceSpreadCompensatorOverlayInputs> = {},
): IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const pipValue = 1.0 / cfg.decUnit;
  const spread = cfg.spreadPips * pipValue;
  // askColor = bidColor = color.new(color.orange, 25) on every bar
  const col = String(color.new(color.orange, 25));
  // display = showAsk / showBid ? display.all : display.none: a hidden candle series has no output
  const showAsk = cfg.anchorMode === 'Ask' || cfg.anchorMode === 'Both';
  const showBid = cfg.anchorMode === 'Bid' || cfg.anchorMode === 'Both';

  const ask: PlotCandleData[] = [];
  const bid: PlotCandleData[] = [];
  for (const b of bars) {
    if (showAsk) {
      ask.push({ time: b.time, open: b.close, high: b.high + spread, low: b.low + spread, close: b.close + spread,
        color: col, wickColor: col, borderColor: col });
    }
    if (showBid) {
      bid.push({ time: b.time, open: b.close, high: b.high - spread, low: b.low - spread, close: b.close - spread,
        color: col, wickColor: col, borderColor: col });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    plotCandles: { ask, bid },
  };
}

export const TradePriceSpreadCompensatorOverlay = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig,
};
