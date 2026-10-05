/**
 * Heikin Ashi Colored Regular OHLC Candles
 *
 * Draws the regular OHLC candles coloured by the Heikin Ashi direction. HA close = (open + high + low + close) / 4,
 * HA open = (previous HA open + previous HA close) / 2 (first bar: (open + close) / 2). Lime when HA close > HA open,
 * red when HA close < HA open, gray when they are equal. Body, wick and border use the same colour.
 *
 * Reference: "Heikin Ashi Colored Regular OHLC Candles" by LuxmiAI
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxmiAI
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';

export type HeikinAshiColoredRegularOhlcCandlesInputs = Record<string, never>;

export const defaultInputs: HeikinAshiColoredRegularOhlcCandlesInputs = {};

export const inputConfig: InputConfig[] = [];

// Only candles (plotcandle): no line plots
export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [
  { id: 'candles', title: 'HA Colored Candles' },
];

export const metadata = {
  title: 'Heikin Ashi Colored Regular OHLC Candles',
  shortTitle: 'Heikin Ashi Colored Regular OHLC Candles',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  _inputs: Partial<HeikinAshiColoredRegularOhlcCandlesInputs> = {},
): Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]> } {
  const candles: PlotCandleData[] = [];
  let prevHaOpen = NaN;
  let prevHaClose = NaN;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const haClose = (b.open + b.high + b.low + b.close) / 4;
    // var float haOpen = na; haOpen := na(haOpen[1]) ? (open + close) / 2 : (haOpen[1] + haClose[1]) / 2
    const haOpen = isNaN(prevHaOpen) ? (b.open + b.close) / 2 : (prevHaOpen + prevHaClose) / 2;
    const isBull = gt(haClose, haOpen);
    const isBear = lt(haClose, haOpen);
    const candleColor = isBull ? color.lime : isBear ? color.red : color.gray;
    // plotcandle(open, high, low, close, color = candleColor, wickcolor = candleColor, bordercolor = candleColor)
    candles.push({
      time: b.time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      color: candleColor,
      wickColor: candleColor,
      borderColor: candleColor,
    });
    prevHaOpen = haOpen;
    prevHaClose = haClose;
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    plotCandles: { candles },
  };
}

export const HeikinAshiColoredRegularOhlcCandles = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  plotCandleConfig,
};
