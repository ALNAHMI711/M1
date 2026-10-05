/**
 * Custom Buy and Sell Signal with Body Ratio, RSI, and Dynamic Volume Condition
 *
 * BUY: a bull bar after a bear bar, with a body between 0.9 and 9 times the previous body, RSI < 40 and a volume
 * above coef x the mean of the highest and lowest volume of the 24 previous bars. SELL: a bear bar after a bull bar
 * with the same body and volume rules and 60 < RSI < 100. (The Pine signal is `cond1 or cond2`, where cond1 is cond2
 * plus a wick rule, so the wick rule has no effect.) BUY / SELL labels below / above the bar.
 *
 * Reference: "Custom Buy and Sell Signal with Body Ratio, RSI, and Dynamic Volume Condition" by am-solaris
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface CustomBuySellBodyRatioRsiInputs {
  rsiLength: number;
  /** Volume coefficient */
  coefVolume: number;
}

export const defaultInputs: CustomBuySellBodyRatioRsiInputs = {
  rsiLength: 14,
  coefVolume: 1.05,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14 },
  { id: 'coefVolume', type: 'float', title: 'Volume Coefficient', defval: 1.05, min: 0.1, step: 0.1 },
];

/** No plot(): the outputs are the two plotshape labels */
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Custom Buy and Sell Signal with Body Ratio, RSI, and Dynamic Volume Condition',
  shortTitle: 'Custom Buy and Sell Signal with Body Ratio, RSI, and Dynamic Volume Condition',
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
  inputs: Partial<CustomBuySellBodyRatioRsiInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  const rsi = A(ta.rsi(S(bars.map((b) => b.close)), cfg.rsiLength));
  // volume[1]
  const volume = bars.map((b) => b.volume ?? NaN);
  const volPrev = volume.map((_v, i) => (i > 0 ? volume[i - 1] : NaN));
  const highVol = A(ta.highest(S(volPrev), 24));
  const lowVol = A(ta.lowest(S(volPrev), 24));

  const markers: MarkerData[] = [];
  for (let i = 1; i < n; i++) {
    const { open, close, time } = bars[i];
    const prev = bars[i - 1];
    const bearish = lt(close, open);
    const bullish = gt(close, open);
    const prevBearish = lt(prev.close, prev.open);
    const prevBullish = gt(prev.close, prev.open);
    const bearBody = open - close;
    const bullBody = close - open;
    const prevBearBody = prev.open - prev.close;
    const prevBullBody = prev.close - prev.open;
    const bodyValidBuy = ge(bullBody, 0.9 * prevBearBody) && le(bullBody, 9 * prevBearBody);
    const bodyValidSell = ge(bearBody, 0.9 * prevBullBody) && le(bearBody, 9 * prevBullBody);
    const rsiBuy = lt(rsi[i], 40);
    const rsiSell = gt(rsi[i], 60) && lt(rsi[i], 100);
    const limit = ((highVol[i] + lowVol[i]) / 2) * cfg.coefVolume;
    const volumeValid = gt(volume[i], limit);
    // buy_condition_1 or buy_condition_2: condition 2 (condition 1 is condition 2 and the wick rule)
    const buy = prevBearish && bullish && bodyValidBuy && rsiBuy && volumeValid;
    const sell = prevBullish && bearish && bodyValidSell && rsiSell && volumeValid;
    // plotshape(buy ? 1 : na, location.belowbar, color.green, shape.labelup, text = "BUY"): no textcolor, the Pine
    // default text colour (color.blue)
    if (buy) markers.push({ time, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'BUY', textColor: color.blue });
    if (sell) markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL', textColor: color.blue });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
  };
}

export const CustomBuySellBodyRatioRsi = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
