/**
 * Beep Boop (Original)
 *
 * A MACD histogram (fast MA - slow MA minus its signal MA; EMA or SMA) reduced to its sign: 0.1 when positive, 0.09
 * when negative, 0 otherwise, drawn as columns. A positive column is teal when close, open and low are all above
 * the EMA trend line of close, white otherwise; a negative column is red when close, open and high are all below
 * it, white otherwise.
 *
 * Reference: "Beep Boop (Original)" by OBSIDE
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, Series, color, getSourceSeries,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';

export interface BeepBoopInputs {
  /** Fast MA length */
  fastLength: number;
  /** Slow MA length */
  slowLength: number;
  /** EMA length of the trend line */
  emaTrend: number;
  /** Source of the MACD */
  src: SourceType;
  /** Signal MA length */
  signalLength: number;
  /** SMA (true) or EMA (false) for the fast and slow MAs */
  smaSource: boolean;
  /** SMA (true) or EMA (false) for the signal line */
  smaSignal: boolean;
}

export const defaultInputs: BeepBoopInputs = {
  fastLength: 12,
  slowLength: 26,
  emaTrend: 50,
  src: 'close',
  signalLength: 9,
  smaSource: false,
  smaSignal: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26 },
  { id: 'emaTrend', type: 'int', title: 'EMA Trend', defval: 50 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'signalLength', type: 'int', title: 'Signal Smoothing', defval: 9, min: 1, max: 50 },
  { id: 'smaSource', type: 'bool', title: 'Simple MA (Oscillator)', defval: false },
  { id: 'smaSignal', type: 'bool', title: 'Simple MA (Signal Line)', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Histogram', color: '#26A69A', lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'Beep Boop (Original)',
  shortTitle: 'Beep Boop (Original)',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

export function calculate(bars: Bar[], inputs: Partial<BeepBoopInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  const src = getSourceSeries(bars, cfg.src);
  // The ternaries select a constant input: only the selected MA runs, on every bar
  const fastMa = A(cfg.smaSource ? ta.sma(src, cfg.fastLength) : ta.ema(src, cfg.fastLength));
  const slowMa = A(cfg.smaSource ? ta.sma(src, cfg.slowLength) : ta.ema(src, cfg.slowLength));
  const macd = fastMa.map((f, i) => f - slowMa[i]);
  const signal = A(cfg.smaSignal ? ta.sma(S(macd), cfg.signalLength) : ta.ema(S(macd), cfg.signalLength));
  const trend = A(ta.ema(S(bars.map((b) => b.close)), cfg.emaTrend));

  const colGrowAbove = String(color.new('#26A69A', 0));
  const colGrowBelow = String(color.new('#FF0000', 0));
  const colFallAbove = String(color.new('#FFFFFF', 0));
  const colFallBelow = String(color.new('#FFFFFF', 0));

  const plot0 = bars.map((b, i) => {
    const raw = macd[i] - signal[i];
    // hist := hist > 0 ? 0.1 : hist < 0 ? 0.09 : 0 (na gives 0)
    const hist = gt(raw, 0) ? 0.1 : lt(raw, 0) ? 0.09 : 0;
    const t = trend[i];
    const c = eq(hist, 0.1)
      ? (gt(b.close, t) && gt(b.open, t) && gt(b.low, t) ? colGrowAbove : colFallAbove)
      : eq(hist, 0.09)
        ? (lt(b.close, t) && lt(b.open, t) && lt(b.high, t) ? colGrowBelow : colFallBelow)
        : undefined;
    return { time: b.time, value: hist, ...(c !== undefined ? { color: c } : {}) };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
  };
}

export const BeepBoop = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
