/**
 * Key_TDI
 *
 * Traders Dynamic Index lines: the RSI of the close, its SMA over the band length (centre line, orange), bands at
 * the centre +- 1.6185 * the standard deviation of the RSI over the band length (gray), and a fast SMA of the RSI
 * (gray). Dashed levels at 32 and 68. The "Lengthtradesl" input feeds a hidden calculation with no output.
 *
 * Reference: "Key_TDI" by Fibonacci_Code
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface KeyTdiInputs {
  /** RSI length */
  rsiLen: number;
  /** Band (SMA / stdev) length */
  bandLen: number;
  /** Fast SMA length of the RSI */
  rsiPlLen: number;
  /** Length of the hidden trade signal line (no output) */
  trSlLen: number;
}

export const defaultInputs: KeyTdiInputs = {
  rsiLen: 13,
  bandLen: 34,
  rsiPlLen: 2,
  trSlLen: 7,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'Lengthrsi', defval: 13 },
  { id: 'bandLen', type: 'int', title: 'Lengthband', defval: 34 },
  { id: 'rsiPlLen', type: 'int', title: 'Lengthrsipl', defval: 2 },
  { id: 'trSlLen', type: 'int', title: 'Lengthtradesl', defval: 7 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Plot 1', color: color.gray, lineWidth: 1 },
  { id: 'plot1', title: 'Plot 2', color: color.gray, lineWidth: 1 },
  { id: 'plot2', title: 'Plot 3', color: color.orange, lineWidth: 1 },
  { id: 'plot3', title: 'Plot 4', color: color.gray, lineWidth: 1 },
];

export const metadata = {
  title: 'Key_TDI',
  shortTitle: 'Key_TDI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<KeyTdiInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const closeS = Series.fromArray(bars, bars.map((b) => b.close));

  const rawRsi = ta.rsi(closeS, cfg.rsiLen);
  const baseSma = A(ta.sma(rawRsi, cfg.bandLen));
  const sd = A(ta.stdev(rawRsi, cfg.bandLen));
  const fast = A(ta.sma(rawRsi, cfg.rsiPlLen));
  const dev = sd.map((v) => v * 1.6185);

  const P = (f: (i: number) => number, c: string) => bars.map((b, i) => ({ time: b.time, value: f(i), color: c }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: P((i) => baseSma[i] + dev[i], color.gray),
      plot1: P((i) => baseSma[i] - dev[i], color.gray),
      plot2: P((i) => baseSma[i], color.orange),
      plot3: P((i) => fast[i], color.gray),
    },
    hlines: [
      { value: 32, options: { title: 'Level 32', color: color.gray, linestyle: 'dashed' } },
      { value: 68, options: { title: 'Level 68', color: color.gray, linestyle: 'dashed' } },
    ],
  };
}

export const KeyTdi = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
