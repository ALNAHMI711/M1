/**
 * PAFT (Price Action Follow-Through)
 *
 * A column score of the follow-through after a cross of the close and its EMA. A bar where the close crosses over
 * the EMA (and closes above it) sets the score to +1; a cross under (close below) sets it to -1. On the other bars
 * the score adds +1 for an up candle, -1 for a down candle and 0 when the close equals the open or the EMA. Before
 * the EMA warm-up (bar index < EMA length) the score is 0. After a cross, the columns can stay hidden until the score
 * first reaches +2 (up cross) or -2 (down cross). The column is green when the close is above the EMA, red below it,
 * gray on it.
 *
 * Reference: "PAFT — Price Action Follow-Through" by TREESinvest
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface PaftInputs {
  /** EMA length */
  emaLen: number;
  /** Score 0 while bar_index < EMA length */
  useWarmup: boolean;
  /** Hide the columns after a cross until the score reaches +2 / -2 */
  hideWeakAfterCross: boolean;
  /** Column colour when the close is above the EMA */
  colAboveEma: string;
  /** Column colour when the close is below the EMA */
  colBelowEma: string;
}

export const defaultInputs: PaftInputs = {
  emaLen: 20,
  useWarmup: true,
  hideWeakAfterCross: true,
  colAboveEma: color.green,
  colBelowEma: color.red,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaLen', type: 'int', title: 'EMA length', defval: 20, min: 1 },
  { id: 'useWarmup', type: 'bool', title: 'Wait for EMA warm-up before scoring', defval: true },
  { id: 'hideWeakAfterCross', type: 'bool', title: 'Hide until ±2 confirm (up: <2 to >=2 / down: >-2 to <=-2)', defval: true },
  { id: 'colAboveEma', type: 'color', title: 'Close above EMA', defval: color.green },
  { id: 'colBelowEma', type: 'color', title: 'Close below EMA', defval: color.red },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Score', color: color.green, lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'PAFT — Price Action Follow-Through',
  shortTitle: 'PAFT',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

export function calculate(bars: Bar[], inputs: Partial<PaftInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const closeS = Series.fromArray(bars, bars.map((b) => b.close));

  const emaS = ta.ema(closeS, cfg.emaLen);
  const ema = A(emaS);
  // ta.crossover / ta.crossunder compare exactly
  const crossUp = ta.crossover(closeS, emaS).toArray().map((v) => !!v);
  const crossDown = ta.crossunder(closeS, emaS).toArray().map((v) => !!v);
  const gray = String(color.new(color.gray, 45));

  let score = 0.0;
  let maskAboveEarly = false;
  let maskBelowEarly = false;
  const plot0 = [];
  for (let i = 0; i < n; i++) {
    const { open, close } = bars[i];
    const resetBar = (crossUp[i] && gt(close, ema[i])) || (crossDown[i] && lt(close, ema[i]));
    const ready = !cfg.useWarmup || i >= cfg.emaLen;
    if (!ready) {
      score = 0.0;
      maskAboveEarly = false;
      maskBelowEarly = false;
    } else if (resetBar) {
      if (crossUp[i]) {
        score = 1.0;
        maskAboveEarly = true;
        maskBelowEarly = false;
      } else if (crossDown[i]) {
        score = -1.0;
        maskBelowEarly = true;
        maskAboveEarly = false;
      }
    } else {
      const candleDelta = eq(close, open) || eq(close, ema[i]) ? 0.0 : lt(close, open) ? -1.0 : 1.0;
      score = score + candleDelta;
    }
    if (ready) {
      if (maskAboveEarly && ge(score, 2.0)) maskAboveEarly = false;
      if (maskBelowEarly && le(score, -2.0)) maskBelowEarly = false;
    }
    const weakHidden = cfg.hideWeakAfterCross && ready
      && ((maskAboveEarly && lt(score, 2.0)) || (maskBelowEarly && gt(score, -2.0)));
    const c = gt(close, ema[i]) ? cfg.colAboveEma : lt(close, ema[i]) ? cfg.colBelowEma : gray;
    plot0.push({ time: bars[i].time, value: weakHidden ? NaN : score, color: c });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
    hlines: [{ value: 0, options: { title: 'Zero', color: String(color.new(color.gray, 50)), linestyle: 'dotted' } }],
  };
}

export const Paft = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
