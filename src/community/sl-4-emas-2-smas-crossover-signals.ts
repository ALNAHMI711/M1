/**
 * SL - 4 EMAs, 2 SMAs & Crossover Signals
 *
 * Four EMAs and two SMAs of the source. A BUY label marks a crossover of EMA 1 above EMA 2 when the four EMAs are in
 * rising order (EMA 1 > EMA 2 > EMA 3 > EMA 4), the close is above SMA 2, the RSI is above 50, every EMA is above its
 * previous value and the volume is above its 20-bar SMA. A SELL label marks the mirror case (crossunder, falling
 * order, close below SMA 2, RSI below 50, every EMA below its previous value, the same volume filter).
 *
 * Reference: "Enhanced 4EMA, 2SMA with Filters" by MVP202020205
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, Series, color, getSourceSeries,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface Sl4Emas2SmasCrossoverSignalsInputs {
  ema1Length: number;
  ema2Length: number;
  ema3Length: number;
  ema4Length: number;
  sma1Length: number;
  sma2Length: number;
  rsiPeriod: number;
  /** Source of the EMAs, SMAs and RSI */
  priceSource: SourceType;
}

export const defaultInputs: Sl4Emas2SmasCrossoverSignalsInputs = {
  ema1Length: 10,
  ema2Length: 21,
  ema3Length: 50,
  ema4Length: 100,
  sma1Length: 20,
  sma2Length: 200,
  rsiPeriod: 14,
  priceSource: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'ema1Length', type: 'int', title: 'EMA 1 Length', defval: 10, min: 1 },
  { id: 'ema2Length', type: 'int', title: 'EMA 2 Length', defval: 21, min: 1 },
  { id: 'ema3Length', type: 'int', title: 'EMA 3 Length', defval: 50, min: 1 },
  { id: 'ema4Length', type: 'int', title: 'EMA 4 Length', defval: 100, min: 1 },
  { id: 'sma1Length', type: 'int', title: 'SMA 1 Length', defval: 20, min: 1 },
  { id: 'sma2Length', type: 'int', title: 'SMA 2 Length', defval: 200, min: 1 },
  { id: 'rsiPeriod', type: 'int', title: 'RSI Period', defval: 14 },
  { id: 'priceSource', type: 'source', title: 'Price Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA 1', color: color.blue, lineWidth: 2 },
  { id: 'plot1', title: 'EMA 2', color: color.green, lineWidth: 2 },
  { id: 'plot2', title: 'EMA 3', color: color.red, lineWidth: 2 },
  { id: 'plot3', title: 'EMA 4', color: color.orange, lineWidth: 2 },
  { id: 'plot4', title: 'SMA 1', color: color.purple, lineWidth: 3 },
  { id: 'plot5', title: 'SMA 2', color: color.white, lineWidth: 3 },
];

export const metadata = {
  title: 'Enhanced 4EMA, 2SMA with Filters',
  shortTitle: '4EMA2SMA+F',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<Sl4Emas2SmasCrossoverSignalsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => (v === null || v === undefined ? NaN : v));
  const src = getSourceSeries(bars, cfg.priceSource);

  const ema1S = ta.ema(src, cfg.ema1Length);
  const ema2S = ta.ema(src, cfg.ema2Length);
  const ema1 = A(ema1S);
  const ema2 = A(ema2S);
  const ema3 = A(ta.ema(src, cfg.ema3Length));
  const ema4 = A(ta.ema(src, cfg.ema4Length));
  const sma1 = A(ta.sma(src, cfg.sma1Length));
  const sma2 = A(ta.sma(src, cfg.sma2Length));
  const rsiValue = A(ta.rsi(src, cfg.rsiPeriod));
  const volSma = A(ta.sma(Series.fromArray(bars, bars.map((b) => b.volume ?? NaN)), 20));
  // ta.crossover / ta.crossunder (exact comparisons, with the last bar where both values were not na)
  const crossUp = A(ta.crossover(ema1S, ema2S));
  const crossDown = A(ta.crossunder(ema1S, ema2S));

  const markers: MarkerData[] = [];
  const prev = (a: number[], i: number) => (i > 0 ? a[i - 1] : NaN);
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const isBullishTrend = gt(ema1[i], ema2[i]) && gt(ema2[i], ema3[i]) && gt(ema3[i], ema4[i]);
    const isBearishTrend = lt(ema1[i], ema2[i]) && lt(ema2[i], ema3[i]) && lt(ema3[i], ema4[i]);
    const priceAboveLongTerm = gt(b.close, sma2[i]);
    const priceBelowLongTerm = lt(b.close, sma2[i]);
    const rsiBullish = gt(rsiValue[i], 50);
    const rsiBearish = lt(rsiValue[i], 50);
    const allSlopesUp = gt(ema1[i], prev(ema1, i)) && gt(ema2[i], prev(ema2, i))
      && gt(ema3[i], prev(ema3, i)) && gt(ema4[i], prev(ema4, i));
    const allSlopesDn = lt(ema1[i], prev(ema1, i)) && lt(ema2[i], prev(ema2, i))
      && lt(ema3[i], prev(ema3, i)) && lt(ema4[i], prev(ema4, i));
    const volumeFilter = gt(b.volume ?? NaN, volSma[i]);
    const buySignal = crossUp[i] === 1 && isBullishTrend && priceAboveLongTerm && rsiBullish && allSlopesUp && volumeFilter;
    const sellSignal = crossDown[i] === 1 && isBearishTrend && priceBelowLongTerm && rsiBearish && allSlopesDn && volumeFilter;
    // plotshape(buySignal, "Buy Signal", location.belowbar, color.lime, shape.labelup, text = "BUY",
    //   textcolor = color.black, size = size.small)
    if (buySignal) {
      markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: color.lime, text: 'BUY',
        textColor: color.black, size: 'small' });
    }
    // plotshape(sellSignal, "Sell Signal", location.abovebar, color.red, shape.labeldown, text = "SELL",
    //   textcolor = color.white, size = size.small)
    if (sellSignal) {
      markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL',
        textColor: color.white, size: 'small' });
    }
  }

  const line = (a: number[]) => bars.map((b, i) => ({ time: b.time, value: a[i] }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: line(ema1),
      plot1: line(ema2),
      plot2: line(ema3),
      plot3: line(ema4),
      plot4: line(sma1),
      plot5: line(sma2),
    },
    markers,
  };
}

export const Sl4Emas2SmasCrossoverSignals = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
