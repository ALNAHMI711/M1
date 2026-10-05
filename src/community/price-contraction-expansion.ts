/**
 * Price Contraction / Expansion
 *
 * The body |close - open| is compared with its SMA times a threshold multiplier: a smaller body is a contraction, a
 * larger or equal body an expansion. The volume is compared with its SMA times a high and a low multiplier. Bar
 * colours: contraction with high volume yellow, other contraction blue, expansion with low volume blue, bullish
 * expansion green, bearish expansion red. A bar that matches none of these keeps the previous colour.
 *
 * Reference: "Price Contraction / Expansion" by destrobr0685
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface PriceContractionExpansionInputs {
  /** Body average period */
  lenRange: number;
  /** Threshold multiplier */
  multThresh: number;
  /** Volume average period */
  volPeriod: number;
  /** High volume multiplier */
  volThresh: number;
  /** Low volume multiplier */
  lowVolThresh: number;
}

export const defaultInputs: PriceContractionExpansionInputs = {
  lenRange: 20,
  multThresh: 0.8,
  volPeriod: 20,
  volThresh: 1.5,
  lowVolThresh: 0.7,
};

export const inputConfig: InputConfig[] = [
  { id: 'lenRange', type: 'int', title: 'Body average period', defval: 20 },
  { id: 'multThresh', type: 'float', title: 'Threshold multiplier', defval: 0.8, step: 0.1 },
  { id: 'volPeriod', type: 'int', title: 'Volume average period', defval: 20 },
  { id: 'volThresh', type: 'float', title: 'High volume multiplier', defval: 1.5, step: 0.1 },
  { id: 'lowVolThresh', type: 'float', title: 'Low volume multiplier', defval: 0.7, step: 0.1 },
];

// Only bar colours (barcolor): no line plots
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Price Contraction / Expansion',
  shortTitle: 'Price Contraction / Expansion',
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
  inputs: Partial<PriceContractionExpansionInputs> = {},
): IndicatorResult & { barColors: BarColorData[] } {
  const { lenRange, multThresh, volPeriod, volThresh, lowVolThresh } = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  const bodySize = bars.map((b) => Math.abs(b.close - b.open));
  const avgBody = A(ta.sma(Series.fromArray(bars, bodySize), lenRange));
  const volume = bars.map((b) => b.volume ?? NaN);
  const avgVol = A(ta.sma(Series.fromArray(bars, volume), volPeriod));

  const yellow = String(color.new(color.yellow, 0));
  const blue = String(color.new(color.blue, 0));
  const green = String(color.new(color.green, 0));
  const red = String(color.new(color.red, 0));

  const barColors: BarColorData[] = [];
  // var color barColor = na
  let barColor: string | null = null;
  for (let i = 0; i < bars.length; i++) {
    const { open, close, time } = bars[i];
    const thresh = avgBody[i] * multThresh;
    const isHighVol = ge(volume[i], avgVol[i] * volThresh);
    const isLowVol = le(volume[i], avgVol[i] * lowVolThresh);
    const isContraction = lt(bodySize[i], thresh);
    const isExpansion = ge(bodySize[i], thresh);
    const isBull = gt(close, open);
    const isBear = lt(close, open);

    if (isContraction && isHighVol) barColor = yellow;
    else if (isContraction) barColor = blue;
    else if (isExpansion && isLowVol) barColor = blue;
    else if (isExpansion && isBull) barColor = green;
    else if (isExpansion && isBear) barColor = red;

    // barcolor(barColor)
    if (barColor !== null) barColors.push({ time, color: barColor });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    barColors,
  };
}

export const PriceContractionExpansion = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
