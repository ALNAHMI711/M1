/**
 * FxShare - CC Reversal
 *
 * Counts consecutive candles in the same direction whose body (|close - open|) is at least the minimum body. A BUY
 * label is drawn when at least `minCount` such bearish candles are followed by a bullish candle that closes above
 * the EMA of the close; a SELL label when at least `minCount` such bullish candles are followed by a bearish candle
 * that closes below the EMA. The EMA is plotted.
 *
 * Reference: "FxShare - CC Reversal" by FxShareRobots
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface FxShareCcReversalInputs {
  /** Minimum number of consecutive candles */
  minCount: number;
  /** Minimum candle body (price points) */
  minBody: number;
  /** EMA length */
  emaLen: number;
}

export const defaultInputs: FxShareCcReversalInputs = {
  minCount: 4,
  minBody: 20,
  emaLen: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'minCount', type: 'int', title: 'Min consecutive candles', defval: 4, min: 2 },
  { id: 'minBody', type: 'float', title: 'Min candle body (points)', defval: 20, step: 0.1 },
  { id: 'emaLen', type: 'int', title: 'EMA length', defval: 2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA', color: color.gray, lineWidth: 1 },
];

export const metadata = {
  title: 'FxShare - CC Reversal',
  shortTitle: 'FxShare - CC Reversal',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

export function calculate(
  bars: Bar[],
  inputs: Partial<FxShareCcReversalInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const ema = ta.ema(Series.fromArray(bars, bars.map((b) => b.close)), cfg.emaLen).toArray().map((v) => v ?? NaN);

  const markers: MarkerData[] = [];
  const buyColor = String(color.new(color.green, 0));
  const sellColor = String(color.new(color.red, 0));
  let bullCount = 0; // var int bullCount = 0
  let bearCount = 0;
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const valid = ge(Math.abs(b.close - b.open), cfg.minBody);
    const isBull = gt(b.close, b.open);
    const isBear = lt(b.close, b.open);
    // bullCount[1] / bearCount[1]: na on bar 0 (compares false)
    const prevBull = i > 0 ? bullCount : NaN;
    const prevBear = i > 0 ? bearCount : NaN;
    bullCount = valid && isBull ? bullCount + 1 : 0;
    bearCount = valid && isBear ? bearCount + 1 : 0;
    const sellCond = ge(prevBull, cfg.minCount) && isBear && lt(b.close, ema[i]);
    const buyCond = ge(prevBear, cfg.minCount) && isBull && gt(b.close, ema[i]);
    // plotshape(buyCond, "BUY", shape.labelup, location.belowbar, text = "BUY", size.small, textcolor = color.white)
    if (buyCond) {
      markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: buyColor, text: 'BUY',
        textColor: color.white, size: 'small' });
    }
    if (sellCond) {
      markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: sellColor, text: 'SELL',
        textColor: color.white, size: 'small' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: bars.map((b, i) => ({ time: b.time, value: ema[i], color: color.gray })) },
    markers,
  };
}

export const FxShareCcReversal = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
