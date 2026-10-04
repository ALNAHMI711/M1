/**
 * LTF MA Stack Breakout (Ultra Filtered, ADX tuple fix)
 *
 * Five SMAs of the close (100, 48, 36, 24, 12). A BUY triangle is drawn when the close is above all five SMAs and
 * every filter passes: ATR(14) above 0.8 times its 100-bar SMA, a body larger than 35 % of the range, volume above
 * 0.8 times its 50-bar SMA, a range larger than 0.4 ATR, a distance of more than 0.2 ATR from every SMA,
 * RSI(14) above 55 and ADX(14, 14) above 20. A SELL triangle is the mirror (close below all SMAs, RSI below 45).
 * After a signal, the next one needs more than 10 bars.
 *
 * Reference: "LTF MA Stack Breakout (Ultra Filtered, ADX tuple fix)" by jonesdaniel2112
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface AllInOneMaStackScalperInputs {}

export const defaultInputs: AllInOneMaStackScalperInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA 100', color: color.blue, lineWidth: 2 },
  { id: 'plot1', title: 'MA 48', color: color.orange, lineWidth: 2 },
  { id: 'plot2', title: 'MA 36', color: color.purple, lineWidth: 2 },
  { id: 'plot3', title: 'MA 24', color: color.green, lineWidth: 2 },
  { id: 'plot4', title: 'MA 12', color: color.red, lineWidth: 2 },
];

export const metadata = {
  title: 'LTF MA Stack Breakout (Ultra Filtered, ADX tuple fix)',
  shortTitle: 'LTF MA Stack Breakout (Ultra Filtered, ADX tuple fix)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  _inputs: Partial<AllInOneMaStackScalperInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const close = S(bars.map((b) => b.close));

  const ma100 = A(ta.sma(close, 100));
  const ma48 = A(ta.sma(close, 48));
  const ma36 = A(ta.sma(close, 36));
  const ma24 = A(ta.sma(close, 24));
  const ma12 = A(ta.sma(close, 12));
  const mas = [ma100, ma48, ma36, ma24, ma12];

  // ATR filter
  const atrS = ta.atr(bars, 14);
  const atr = A(atrS);
  const atrAvg = A(ta.sma(atrS, 100));
  // Volume filter: vol = na(volume) ? 1 : volume
  const vol = bars.map((b) => (b.volume === undefined || b.volume === null || isNaN(b.volume) ? 1 : b.volume));
  const volMA = A(ta.sma(S(vol), 50));
  const rsi = A(ta.rsi(close, 14));
  const [, , adxS] = ta.dmi(bars, 14, 14);
  const adx = A(adxS);

  const markers: MarkerData[] = [];
  let lastSignalBar = NaN; // var int lastSignalBar = na
  const minBars = 10;
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const validATR = gt(atr[i], atrAvg[i] * 0.8);
    const body = Math.abs(b.close - b.open);
    const candleRange = b.high - b.low;
    // A plain division: a zero range is skipped by the left side of the lazy `and`
    const isStrongCandle = gt(candleRange, 0) && gt(body / candleRange, 0.35);
    const validVol = gt(vol[i], volMA[i] * 0.8);
    const isBigCandle = gt(candleRange, atr[i] * 0.4);
    const aboveAll = mas.every((m) => gt(b.close, m[i]));
    const belowAll = mas.every((m) => lt(b.close, m[i]));
    const minDist = atr[i] * 0.2;
    const farFromAllMAs = mas.every((m) => gt(Math.abs(b.close - m[i]), minDist));
    const rsiBuy = gt(rsi[i], 55);
    const rsiSell = lt(rsi[i], 45);
    const trendActive = gt(adx[i], 20);
    // bar_index - lastSignalBar > minBars: integers (the bar_index origin does not change the difference)
    const spaced = isNaN(lastSignalBar) || i - lastSignalBar > minBars;
    const common = validATR && isStrongCandle && validVol && isBigCandle && farFromAllMAs && trendActive && spaced;
    const buySignal = aboveAll && common && rsiBuy;
    const sellSignal = belowAll && common && rsiSell;
    if (buySignal || sellSignal) lastSignalBar = i;

    if (buySignal) {
      markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'small',
        text: 'BUY', textColor: '#2962FF' });
    }
    if (sellSignal) {
      markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'small',
        text: 'SELL', textColor: '#2962FF' });
    }
  }

  const P = (m: number[], c: string) => bars.map((b, i) => ({ time: b.time, value: m[i], color: c }));
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: P(ma100, color.blue),
      plot1: P(ma48, color.orange),
      plot2: P(ma36, color.purple),
      plot3: P(ma24, color.green),
      plot4: P(ma12, color.red),
    },
    markers,
  };
}

export const AllInOneMaStackScalper = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
