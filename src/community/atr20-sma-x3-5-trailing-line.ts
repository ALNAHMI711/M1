/**
 * ATR20 SMA x3.5 Trailing Line
 *
 * True range tr = max(high - low, |high - close[1]|, |low - close[1]|) (na on the first bar), averaged with an SMA
 * of `atrLen` bars. The line is the highest high of `lookbackHighLen` bars minus `atrMult` times this average.
 *
 * Reference: "ATR20 SMA x3.5 Trailing Line" by hibinomasakazu1991
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © hibinomasakazu1991
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface Atr20SmaX35TrailingLineInputs {
  /** SMA length of the true range */
  atrLen: number;
  /** Multiplier of the average true range */
  atrMult: number;
  /** Length of the highest high */
  lookbackHighLen: number;
}

export const defaultInputs: Atr20SmaX35TrailingLineInputs = {
  atrLen: 20,
  atrMult: 3.5,
  lookbackHighLen: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 20, min: 1 },
  { id: 'atrMult', type: 'float', title: 'ATR Multiplier', defval: 3.5, min: 0.1, step: 0.1 },
  { id: 'lookbackHighLen', type: 'int', title: 'High Lookback', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ATR20 SMA x3.5 Line', color: color.red, lineWidth: 2 },
];

export const metadata = {
  title: 'ATR20 SMA x3.5 Trailing Line',
  shortTitle: 'ATR20 SMA x3.5 Trailing Line',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<Atr20SmaX35TrailingLineInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  // tr = math.max(high - low, math.max(math.abs(high - close[1]), math.abs(low - close[1]))): na on bar 0
  const tr = bars.map((b, i) => {
    const prevClose = i > 0 ? bars[i - 1].close : NaN;
    return Math.max(b.high - b.low, Math.max(Math.abs(b.high - prevClose), Math.abs(b.low - prevClose)));
  });
  const atrSma = A(ta.sma(S(tr), cfg.atrLen));
  const hh = A(ta.highest(S(bars.map((b) => b.high)), cfg.lookbackHighLen));

  const plot0 = bars.map((b, i) => {
    const v = hh[i] - cfg.atrMult * atrSma[i];
    return { time: b.time, value: Number.isFinite(v) ? v : NaN };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
  };
}

export const Atr20SmaX35TrailingLine = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
