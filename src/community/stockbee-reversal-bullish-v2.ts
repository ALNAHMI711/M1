/**
 * Stockbee Reversal Bullish v2
 *
 * A bullish reversal screen on the previous bar: close >= 20, 20-bar average volume >= 200,000, close above the
 * 150-bar SMA of the close, 5-bar ATR >= 1, a down bar (close < open), close more than 6 % under the highest close
 * of the 6 bars before, and 2-bar RSI <= 30 (all values taken one bar ago). The histogram is 1 when all conditions
 * are true, else 0.
 *
 * Reference: "Stockbee Reversal Bullish v2" by traderabhi81
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © traderabhi81
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface StockbeeReversalBullishV2Inputs {}

export const defaultInputs: StockbeeReversalBullishV2Inputs = {};

export const inputConfig: InputConfig[] = [];

const PLOT_COL = '#2962FF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Plot', color: PLOT_COL, lineWidth: 1, style: 'histogram' },
];

export const metadata = {
  title: 'Reversal Bullish v2',
  shortTitle: 'Reversal Bullish v2',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => ge(b, a);

export function calculate(bars: Bar[], _inputs: Partial<StockbeeReversalBullishV2Inputs> = {}): IndicatorResult {
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const close = S(bars.map((b) => b.close));

  const avgv20 = A(ta.sma(S(bars.map((b) => b.volume ?? NaN)), 20));
  const avgc150 = A(ta.sma(close, 150));
  const atr5 = A(ta.atr(bars, 5));
  const maxc6 = A(ta.highest(close, 6));
  const wrsi2 = A(ta.rsi(close, 2));

  const plot0 = bars.map((b, i) => {
    // All values one bar ago ([1]); na on bar 0 makes the condition false
    const p = i - 1;
    const c1 = p >= 0 ? bars[p].close : NaN;
    const o1 = p >= 0 ? bars[p].open : NaN;
    const at = (a: number[]) => (p >= 0 ? a[p] : NaN);
    const cond = ge(c1, 20)
      && ge(at(avgv20), 200000)
      && gt(c1, at(avgc150))
      && ge(at(atr5), 1)
      && lt(c1, o1)
      && lt(c1, 0.94 * at(maxc6))
      && le(at(wrsi2), 30);
    return { time: b.time, value: cond ? 1 : 0, color: PLOT_COL };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
  };
}

export const StockbeeReversalBullishV2 = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
