/**
 * CHAKRA RISS ENGULFING CANDLESTICK STRATEGY
 *
 * An RSI of `len` bars (RMA of the gains and of the losses) colours the bars green above the up level and red below
 * the down level. BUY when the RSI moves above the up level with the close above the SMA 50 of the close; SELL when it
 * moves below the down level with the close below the SMA 50. A signal opens a trade when none is open (entry price =
 * close); the trade closes when the close reaches the previous low / high or 3 % from the entry price. While a trade
 * is open, the long and short stop loss (previous low / high) and take profit (entry +3 % / -3 %) levels are drawn.
 *
 * Reference: "CHAKRA RISS ENGULFING CANDLESTICK STRATEGY" by Tradewith_Riss
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, MarkerData } from '../types';

export interface ChakraRissEngulfingCandlestickStrategyInputs {
  /** RSI length */
  len: number;
  /** RSI up level */
  len1: number;
  /** RSI down level */
  len2: number;
}

export const defaultInputs: ChakraRissEngulfingCandlestickStrategyInputs = {
  len: 8,
  len1: 50,
  len2: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Length', defval: 8, min: 1 },
  { id: 'len1', type: 'int', title: 'UpLevel', defval: 50 },
  { id: 'len2', type: 'int', title: 'DownLevel', defval: 50 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA', color: color.black, lineWidth: 3 },
  { id: 'plot1', title: 'Stop Loss (Long)', color: color.red, lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'Take Profit (Long)', color: color.green, lineWidth: 1, style: 'linebr' },
  { id: 'plot3', title: 'Stop Loss (Short)', color: color.green, lineWidth: 1, style: 'linebr' },
  { id: 'plot4', title: 'Take Profit (Short)', color: color.red, lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'CHAKRA RISS ENGULFING CANDLESTICK STRATEGY',
  shortTitle: 'CHAKRA RISS',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

export function calculate(
  bars: Bar[],
  inputs: Partial<ChakraRissEngulfingCandlestickStrategyInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const close = bars.map((b) => b.close);

  // up = ta.rma(math.max(ta.change(close), 0), len); down = ta.rma(-math.min(ta.change(close), 0), len)
  // (math.max / math.min of na are na)
  const change = close.map((c, i) => (i > 0 ? c - close[i - 1] : NaN));
  const up = A(ta.rma(S(change.map((d) => (isNaN(d) ? NaN : Math.max(d, 0)))), cfg.len));
  const down = A(ta.rma(S(change.map((d) => (isNaN(d) ? NaN : -Math.min(d, 0)))), cfg.len));
  // rsi = 100 - (100 / (1 + up / down)): plain divisions (down = 0 gives 100, 0 / 0 gives na)
  const rsi = up.map((u, i) => 100 - 100 / (1 + u / down[i]));
  const out = A(ta.sma(S(close), 50));

  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];
  const sl: number[] = new Array(n).fill(NaN);
  const tpL: number[] = new Array(n).fill(NaN);
  const ssl: number[] = new Array(n).fill(NaN);
  const tpS: number[] = new Array(n).fill(NaN);
  let entryPrice = NaN; // var float entryPrice = na
  let inTrade = false; // var bool inTrade = false
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const isGreen = gt(rsi[i], cfg.len1);
    const isRed = lt(rsi[i], cfg.len2);
    if (isGreen) barColors.push({ time: b.time, color: color.green });
    else if (isRed) barColors.push({ time: b.time, color: color.red });

    const prevRsi = i > 0 ? rsi[i - 1] : NaN;
    const buySignal = isGreen && le(prevRsi, cfg.len1) && gt(b.close, out[i]);
    const sellSignal = isRed && ge(prevRsi, cfg.len2) && lt(b.close, out[i]);
    // plotshape(buySignal, style = shape.labelup, location = location.belowbar, color = color.green, text = "BUY")
    if (buySignal) {
      markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'BUY',
        textColor: '#2962FF', size: 'auto' });
    }
    if (sellSignal) {
      markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL',
        textColor: '#2962FF', size: 'auto' });
    }

    // Levels use the entry price of the previous bar (computed before the entry update)
    const longStopLoss = i > 0 ? bars[i - 1].low : NaN;
    const longTakeProfit = entryPrice * 1.03;
    const shortStopLoss = i > 0 ? bars[i - 1].high : NaN;
    const shortTakeProfit = entryPrice * 0.97;

    if (buySignal && !inTrade) {
      entryPrice = b.close;
      inTrade = true;
    }
    if (sellSignal && !inTrade) {
      entryPrice = b.close;
      inTrade = true;
    }
    const longExit = le(b.close, longStopLoss) || ge(b.close, longTakeProfit);
    const shortExit = ge(b.close, shortStopLoss) || le(b.close, shortTakeProfit);
    if (longExit || shortExit) inTrade = false;

    if (inTrade && !isNaN(entryPrice)) {
      sl[i] = longStopLoss;
      tpL[i] = longTakeProfit;
      ssl[i] = shortStopLoss;
      tpS[i] = shortTakeProfit;
    }
  }

  const line = (arr: number[], col: string) => bars.map((b, i) => ({ time: b.time, value: arr[i], color: col }));
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: line(out, color.black),
      plot1: line(sl, color.red),
      plot2: line(tpL, color.green),
      plot3: line(ssl, color.green),
      plot4: line(tpS, color.red),
    },
    markers,
    barColors,
  };
}

export const ChakraRissEngulfingCandlestickStrategy = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
