/**
 * Z-Score STDEMA Bands
 *
 * Z-score of the source: (source - sma(source, length)) / stdev(source, length). Bands around the z-score:
 * ema(z, stdEmaLength) +- stdev(z, stdEmaLength). Horizontal lines at 0 and +-1, +-2, +-3. The bars turn blue when
 * the z-score is above 0 and above the upper band, and yellow when it is below 0 and below the lower band; the colour
 * stays until the other condition comes.
 *
 * Reference: "Z-Score STDEMA Bands" by TiagoTF
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
  type SourceType,
} from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface ZScoreStdemaBandsInputs {
  source: SourceType;
  /** Z-score length */
  length: number;
  /** EMA / stdev length of the bands */
  stdEmaLength: number;
  /** Not used by the computation (Pine input "STD length") */
  stdLengh: number;
}

export const defaultInputs: ZScoreStdemaBandsInputs = {
  source: 'close',
  length: 50,
  stdEmaLength: 28,
  stdLengh: 1.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'length', type: 'int', title: 'Z-Score Length', defval: 50 },
  { id: 'stdEmaLength', type: 'int', title: 'STDEMA Length', defval: 28 },
  { id: 'stdLengh', type: 'float', title: 'STD length', defval: 1.0 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Z-Score', color: color.orange, lineWidth: 2 },
  { id: 'plot1', title: 'STDEMA Upper Band', color: color.green, lineWidth: 1 },
  { id: 'plot2', title: 'STDEMA Lower Band', color: color.red, lineWidth: 1 },
];

export const metadata = {
  title: 'Z-Score STDEMA Bands',
  shortTitle: 'Z-Score STDEMA Bands',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<ZScoreStdemaBandsInputs> = {},
): IndicatorResult & { barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  const srcSeries = getSourceSeries(bars, cfg.source);
  const src = A(srcSeries);
  const mean = A(ta.sma(srcSeries, cfg.length));
  const std = A(ta.stdev(srcSeries, cfg.length));
  // A plain division: x / 0 is +-infinity (0 / 0 NaN); ta.ema / ta.stdev skip the infinite value like na, the
  // comparisons use it, the plot shows na
  const z = src.map((v, i) => (v - mean[i]) / std[i]);
  const zEma = A(ta.ema(S(z), cfg.stdEmaLength));
  const zStd = A(ta.stdev(S(z), cfg.stdEmaLength));
  const up = zEma.map((e, i) => e + zStd[i]);
  const down = zEma.map((e, i) => e - zStd[i]);

  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const barColors: BarColorData[] = [];
  let col: string | null = null; // var color color = na
  for (let i = 0; i < n; i++) {
    if (gt(z[i], 0) && gt(z[i], up[i])) col = color.blue;
    if (lt(z[i], 0) && lt(z[i], down[i])) col = color.yellow;
    if (col !== null) barColors.push({ time: bars[i].time as number, color: col });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: fin(z[i]), color: color.orange })),
      plot1: bars.map((b, i) => ({ time: b.time, value: fin(up[i]), color: color.green })),
      plot2: bars.map((b, i) => ({ time: b.time, value: fin(down[i]), color: color.red })),
    },
    hlines: [
      { value: 0, options: { title: 'Zero Line', color: color.gray, linestyle: 'dashed', linewidth: 1 } },
      { value: 1, options: { title: '+1 SD', color: color.gray, linestyle: 'dotted' } },
      { value: 2, options: { title: '+2 SD', color: color.gray, linestyle: 'dotted' } },
      { value: 3, options: { title: '+3 SD', color: color.gray, linestyle: 'dotted' } },
      { value: -1, options: { title: '-1 SD', color: color.gray, linestyle: 'dotted' } },
      { value: -2, options: { title: '-2 SD', color: color.gray, linestyle: 'dotted' } },
      { value: -3, options: { title: '-3 SD', color: color.gray, linestyle: 'dotted' } },
    ],
    barColors,
  };
}

export const ZScoreStdemaBands = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
