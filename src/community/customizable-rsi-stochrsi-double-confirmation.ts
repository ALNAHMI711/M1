/**
 * Customizable RSI/StochRSI Double Confirmation
 *
 * RSI of the source and a Stochastic RSI (K = SMA of 100 * (rsi - lowest rsi) / (highest rsi - lowest rsi)). Labels
 * mark the RSI crossing above the buy threshold or below the sell threshold, the StochRSI K crossing above its buy
 * threshold or below its sell threshold, and the bars where both RSI and StochRSI give the same signal (double buy /
 * double sell). Horizontal lines at 80 and 20 on the price pane.
 *
 * Reference: "Customizable RSI/StochRSI Double Confirmation" by smile_bad_day
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, Series, getSourceSeries, color,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface CustomizableRsiStochRsiDoubleConfirmationInputs {
  rsiLength: number;
  rsiSource: SourceType;
  stochLength: number;
  smoothK: number;
  /** StochRSI Smooth D (stochD is computed but not drawn) */
  smoothD: number;
  rsiBuyThreshold: number;
  rsiSellThreshold: number;
  stochRsiBuyThreshold: number;
  stochRsiSellThreshold: number;
}

export const defaultInputs: CustomizableRsiStochRsiDoubleConfirmationInputs = {
  rsiLength: 7,
  rsiSource: 'close',
  stochLength: 5,
  smoothK: 3,
  smoothD: 3,
  rsiBuyThreshold: 20,
  rsiSellThreshold: 80,
  stochRsiBuyThreshold: 20,
  stochRsiSellThreshold: 80,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 7, min: 1 },
  { id: 'rsiSource', type: 'source', title: 'RSI Source', defval: 'close' },
  { id: 'stochLength', type: 'int', title: 'StochRSI Length', defval: 5, min: 1 },
  { id: 'smoothK', type: 'int', title: 'StochRSI Smooth K', defval: 3, min: 1 },
  { id: 'smoothD', type: 'int', title: 'StochRSI Smooth D', defval: 3, min: 1 },
  { id: 'rsiBuyThreshold', type: 'float', title: 'RSI Buy Threshold', defval: 20, min: 0, max: 100 },
  { id: 'rsiSellThreshold', type: 'float', title: 'RSI Sell Threshold', defval: 80, min: 0, max: 100 },
  { id: 'stochRsiBuyThreshold', type: 'float', title: 'StochRSI Buy Threshold', defval: 20, min: 0, max: 100 },
  { id: 'stochRsiSellThreshold', type: 'float', title: 'StochRSI Sell Threshold', defval: 80, min: 0, max: 100 },
];

// No plot(): the outputs are six plotshape labels and two hlines
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Customizable RSI/StochRSI Double Confirmation',
  shortTitle: 'Customizable RSI/StochRSI Double Confirmation',
  overlay: true,
};

export function calculate(
  bars: Bar[],
  inputs: Partial<CustomizableRsiStochRsiDoubleConfirmationInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const { rsiLength, stochLength, smoothK, smoothD } = cfg;
  const { rsiBuyThreshold, rsiSellThreshold, stochRsiBuyThreshold, stochRsiSellThreshold } = cfg;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  const rsi = ta.rsi(getSourceSeries(bars, cfg.rsiSource), rsiLength);
  const rsiHighest = A(ta.highest(rsi, stochLength));
  const rsiLowest = A(ta.lowest(rsi, stochLength));
  const rsiArr = A(rsi);
  // A plain division: x / 0 is +-infinity, 0 / 0 NaN; ta.sma skips the infinite values as Pine
  const stochKRaw = rsiArr.map((r, i) => (100 * (r - rsiLowest[i])) / (rsiHighest[i] - rsiLowest[i]));
  const stochK = ta.sma(Series.fromArray(bars, stochKRaw), smoothK);
  // stochD = ta.sma(stochK, smoothD): computed in Pine, not used by any output
  void ta.sma(stochK, smoothD);

  const rsiBuySignal = A(ta.crossover(rsi, rsiBuyThreshold));
  const rsiSellSignal = A(ta.crossunder(rsi, rsiSellThreshold));
  const stochRsiBuySignal = A(ta.crossover(stochK, stochRsiBuyThreshold));
  const stochRsiSellSignal = A(ta.crossunder(stochK, stochRsiSellThreshold));

  const blue = color.blue; // Pine default plotshape text colour
  const markers: MarkerData[] = [];
  for (let i = 0; i < bars.length; i++) {
    const time = bars[i].time;
    const rsiBuy = rsiBuySignal[i] === 1;
    const rsiSell = rsiSellSignal[i] === 1;
    const stochBuy = stochRsiBuySignal[i] === 1;
    const stochSell = stochRsiSellSignal[i] === 1;
    const buyBoth = rsiBuy && stochBuy;
    const sellBoth = rsiSell && stochSell;

    if (rsiBuy) markers.push({ time, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'RSI Buy', textColor: blue });
    if (rsiSell) markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'RSI Sell', textColor: blue });
    if (stochBuy) markers.push({ time, position: 'belowBar', shape: 'labelUp', color: color.yellow, text: 'StochRSI Buy', textColor: blue });
    if (stochSell) markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: color.fuchsia, text: 'StochRSI Sell', textColor: blue });
    if (buyBoth) markers.push({ time, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'Double Buy', textColor: blue });
    if (sellBoth) markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'Double Sell', textColor: blue });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    hlines: [
      { value: 80, options: { title: 'Overbought', color: color.red, linestyle: 'dashed' } },
      { value: 20, options: { title: 'Oversold', color: color.green, linestyle: 'dashed' } },
    ],
  };
}

export const CustomizableRsiStochRsiDoubleConfirmation = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
