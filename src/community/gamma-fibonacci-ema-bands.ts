/**
 * Gamma + Fibonacci EMA Bands
 *
 * Three fast gamma EMAs: ema = gamma * src + (1 - gamma) * ema[1], started at gamma * src on the first bar (the
 * previous value is na, read as 0). Six slow EMAs of the source with the Fibonacci lengths 34, 55, 89, 144, 233
 * and 377.
 *
 * Reference: "Gamma + Fibonacci EMA Bands" by ky_yule1010
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface GammaFibonacciEmaBandsInputs {
  /** Source */
  src: SourceType;
  /** Weight of the current source in gamma EMA 1 */
  gamma1: number;
  /** Weight of the current source in gamma EMA 2 */
  gamma2: number;
  /** Weight of the current source in gamma EMA 3 */
  gamma3: number;
}

export const defaultInputs: GammaFibonacciEmaBandsInputs = {
  src: 'close',
  gamma1: 0.2,
  gamma2: 0.5,
  gamma3: 0.8,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'gamma1', type: 'float', title: 'Gamma 1', defval: 0.2, step: 0.01 },
  { id: 'gamma2', type: 'float', title: 'Gamma 2', defval: 0.5, step: 0.01 },
  { id: 'gamma3', type: 'float', title: 'Gamma 3', defval: 0.8, step: 0.01 },
];

const COLORS = [
  String(color.new('#a8457a', 0)),
  String(color.new('#af7ab8', 0)),
  String(color.new('#edd6f5', 0)),
  String(color.new(color.orange, 0)),
  String(color.new('#7e4b00', 0)),
  String(color.new(color.red, 0)),
  String(color.new('#c53333', 0)),
  String(color.new('#7e1010', 0)),
  String(color.new('#350101', 0)),
];
const TITLES = ['GAMMA EMA 1', 'GAMMA EMA 2', 'GAMMA EMA 3', 'EMA 34', 'EMA 55', 'EMA 89', 'EMA 144', 'EMA 233', 'EMA 377'];
const FIB_LENGTHS = [34, 55, 89, 144, 233, 377];

export const plotConfig: PlotConfig[] = TITLES.map((title, k) => ({ id: `plot${k}`, title, color: COLORS[k], lineWidth: 1 }));

export const metadata = {
  title: 'Gamma + Fibonacci EMA Bands',
  shortTitle: 'Gamma + Fibonacci EMA Bands',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<GammaFibonacciEmaBandsInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const src = getSourceSeries(bars, cfg.src);
  const s = src.toArray().map((v) => v ?? NaN);

  // calcGEMA(_src, g): if barstate.isfirst: _ema := _src; then _ema := g * _src + (1 - g) * nz(_ema[1])
  const gema = (g: number): number[] => {
    const out: number[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const prev = i > 0 && !isNaN(out[i - 1]) ? out[i - 1] : 0; // nz(_ema[1])
      out[i] = g * s[i] + (1 - g) * prev;
    }
    return out;
  };

  const series: number[][] = [
    gema(cfg.gamma1),
    gema(cfg.gamma2),
    gema(cfg.gamma3),
    ...FIB_LENGTHS.map((len) => ta.ema(src, len).toArray().map((v) => v ?? NaN)),
  ];

  const plots: Record<string, Array<{ time: number; value: number; color: string }>> = {};
  series.forEach((vals, k) => {
    plots[`plot${k}`] = bars.map((b, i) => ({ time: b.time, value: vals[i], color: COLORS[k] }));
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
  };
}

export const GammaFibonacciEmaBands = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
