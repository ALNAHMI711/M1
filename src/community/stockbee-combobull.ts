/**
 * Stockbee ComboBull
 *
 * Histogram of 1 on the bars with a Stockbee "combo bull" breakout, 0 otherwise. Common condition: volume above
 * 100,000 and close[1] / close[2] <= 1.02. Dollar breakout: close - open >= 0.90 and a body larger than the
 * previous body. Four percent breakout: close / close[1] >= 1.04 and a volume above the previous volume. The bar
 * also needs a close above 3 and a close in the top 30 % of the bar range.
 *
 * Reference: "Stockbee ComboBull" by traderabhi81
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © traderabhi81
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

// The Pine script has no inputs
export interface StockbeeComboBullInputs {}

export const defaultInputs: StockbeeComboBullInputs = {};

export const inputConfig: InputConfig[] = [];

/** Pine default plot colour */
const DEFAULT_COLOR = '#2962FF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ComboBull', color: DEFAULT_COLOR, lineWidth: 1, style: 'histogram' },
];

export const metadata = {
  title: 'ComboBull',
  shortTitle: 'ComboBull',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

export function calculate(bars: Bar[], _inputs: Partial<StockbeeComboBullInputs> = {}): IndicatorResult {
  const close = (i: number) => (i >= 0 ? bars[i].close : NaN);
  const open = (i: number) => (i >= 0 ? bars[i].open : NaN);
  const volume = (i: number) => (i >= 0 ? bars[i].volume ?? NaN : NaN);

  const plot0 = bars.map((b, i) => {
    // comboCommonCond = (volume > 100000) and (close[1] / close[2] <= 1.02)
    const common = gt(volume(i), 100000) && le(close(i - 1) / close(i - 2), 1.02);
    // dollarBO = (close - open >= 0.90) and (close[1] - open[1] < close - open) and comboCommonCond
    const dollarBO = ge(b.close - b.open, 0.9) && lt(close(i - 1) - open(i - 1), b.close - b.open) && common;
    // fourPerBO = (close / close[1] >= 1.04) and volume > volume[1] and comboCommonCond
    const fourPerBO = ge(b.close / close(i - 1), 1.04) && gt(volume(i), volume(i - 1)) && common;
    // comboBullCond = (dollarBO or fourPerBO) and close > 3 and ((close - low) / (high - low) >= 0.7)
    // (a plain division: x / 0 is +infinity, 0 / 0 is na)
    const cond = (dollarBO || fourPerBO) && gt(b.close, 3) && ge((b.close - b.low) / (b.high - b.low), 0.7);
    // plot(comboBullCond ? 1 : 0, style = plot.style_histogram)
    return { time: b.time, value: cond ? 1 : 0, color: DEFAULT_COLOR };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
  };
}

export const StockbeeComboBull = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
