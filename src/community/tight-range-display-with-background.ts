/**
 * Tight Range Display with Background
 *
 * Range of the last `lookback` bars in percent of the lowest low: (highest high - lowest low) / lowest low x 100.
 * When it is below the Tight Range % the background is blue, with a transparency of round(92 - intensity x 20), where
 * intensity = range % / (Wide Range % when the range is above it, else Tight Range %).
 * The lookback is max(10, min(50, round(atr / max(avgAtr, 0.0001) x 20))) from the bar `atrPeriod` on, else 10. The
 * Pine script declares atr = ta.atr(atrPeriod) and avgAtr = ta.sma(atr, atrPeriod) with `var`: both are computed on
 * the first bar only (then na -> 0 for atr and na -> 1 for avgAtr), so the lookback stays constant after bar
 * `atrPeriod` (10 with the default ATR period 5).
 *
 * Reference: "Tight Range Display with Background" by rakeshhelva
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, math, color, str, callsite, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';

export interface TightRangeDisplayInputs {
  /** ATR Period for Dynamic Lookback */
  atrPeriod: number;
  /** Tight Range % */
  tightRangePct: string;
  /** Wide Range % */
  wideRangePct: string;
}

export const defaultInputs: TightRangeDisplayInputs = {
  atrPeriod: 5,
  tightRangePct: '10.0',
  wideRangePct: '10.0',
};

export const inputConfig: InputConfig[] = [
  { id: 'atrPeriod', type: 'int', title: 'ATR Period for Dynamic Lookback', defval: 5, min: 1 },
  {
    id: 'tightRangePct', type: 'string', title: 'Tight Range %', defval: '10.0',
    options: ['1.0', '1.5', '2.0', '2.5', '3.0', '4.0', '5.0', '6.0', '7.0', '8.0', '10.0', '20.0'],
  },
  {
    id: 'wideRangePct', type: 'string', title: 'Wide Range %', defval: '10.0',
    options: ['8.0', '10.0', '12.0', '15.0', '20.0'],
  },
];

/** No plot(): the output is the bgcolor "Tight Range" */
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Tight Range Display with Background',
  shortTitle: 'Tight Range Display with Background',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const nz = (x: number, r: number) => (Number.isFinite(x) ? x : r);

export function calculate(
  bars: Bar[],
  inputs: Partial<TightRangeDisplayInputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const tightRangePct = str.tonumber(cfg.tightRangePct) ?? NaN;
  const wideRangePct = str.tonumber(cfg.wideRangePct) ?? NaN;
  const blue = '#2962FF'; // color.blue
  const bgColors: BgColorData[] = [];
  if (n === 0) {
    return { metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay }, plots: {}, bgColors };
  }

  // var float atr = ta.atr(atrPeriod); var float avgAtr = ta.sma(atr, atrPeriod): the initialisers run on the
  // first bar only (both calls are made once, on bar 0, where they only see that bar)
  const first = [bars[0]];
  const atr0 = ta.atr(first, cfg.atrPeriod).toArray()[0] ?? NaN;
  const avgAtr0 = ta.sma(Series.fromArray(first, [atr0]), cfg.atrPeriod).toArray()[0] ?? NaN;
  // avgAtr := nz(avgAtr, 1.0); atr := nz(atr, 0.0) on every bar: the values stay those of bar 0
  const avgAtr = nz(avgAtr0, 1.0);
  const atr = nz(atr0, 0.0);

  const highestSite = callsite.highest();
  const lowestSite = callsite.lowest();
  let lookback = 10; // var int lookback = 10
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    if (i >= cfg.atrPeriod) {
      lookback = Math.max(10, Math.min(50, math.round((atr / Math.max(avgAtr, 0.0001)) * 20)));
    }
    const recentHigh = highestSite(b.high, lookback);
    const recentLow = lowestSite(b.low, lookback);
    const rangePct = ((recentHigh - recentLow) / recentLow) * 100;

    const tightRange = lt(rangePct, tightRangePct);
    const wideRange = gt(rangePct, wideRangePct);
    const rangeIntensity = rangePct / (wideRange ? wideRangePct : tightRangePct);
    const tightRangeTransp = math.round(92 - rangeIntensity * 20);

    // bgcolor(tightRange ? color.new(color.blue, tightRangeTransp) : na, title = "Tight Range")
    if (tightRange) bgColors.push({ time: b.time, color: String(color.new(blue, tightRangeTransp)) });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    bgColors,
  };
}

export const TightRangeDisplay = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
