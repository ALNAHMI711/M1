/**
 * True High/Low RSI for Divergence
 *
 * Two RSI lines: the RSI of the high and the RSI of the low (RMA of the up and down changes; 100 when the down
 * average is 0, 0 when the up average is 0). The High RSI line becomes more opaque from 50 up to 70 (transparency
 * (70 - RSI) * 2, invisible at or below 50); the Low RSI line becomes more opaque from 50 down to 30.
 *
 * Reference: "True High/Low RSI for Divergence" by Lakt_
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface TrueHighLowRsiForDivergenceInputs {
  /** Colour of the High RSI line */
  highRsiColor: string;
  /** Colour of the Low RSI line */
  lowRsiColor: string;
  /** RSI length */
  rsiLength: number;
  /** Source of the High RSI */
  rsiSourceHigh: SourceType;
  /** Source of the Low RSI */
  rsiSourceLow: SourceType;
}

export const defaultInputs: TrueHighLowRsiForDivergenceInputs = {
  highRsiColor: color.blue,
  lowRsiColor: color.red,
  rsiLength: 14,
  rsiSourceHigh: 'high',
  rsiSourceLow: 'low',
};

export const inputConfig: InputConfig[] = [
  { id: 'highRsiColor', type: 'color', title: 'High RSI Color', defval: color.blue },
  { id: 'lowRsiColor', type: 'color', title: 'Low RSI Color', defval: color.red },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'rsiSourceHigh', type: 'source', title: 'High RSI Source', defval: 'high' },
  { id: 'rsiSourceLow', type: 'source', title: 'Low RSI Source', defval: 'low' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'High RSI', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'Low RSI', color: color.red, lineWidth: 1 },
];

export const metadata = {
  title: 'True High/Low RSI for Divergence',
  shortTitle: 'RSI',
  overlay: false,
  precision: 2,
  format: 'price',
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

export function calculate(bars: Bar[], inputs: Partial<TrueHighLowRsiForDivergenceInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  const rsiOf = (src: Series) => {
    const ch = A(ta.change(src));
    // math.max(na, 0) and math.min(na, 0) are na
    const up = A(ta.rma(S(ch.map((c) => Math.max(c, 0))), cfg.rsiLength));
    const down = A(ta.rma(S(ch.map((c) => -Math.min(c, 0))), cfg.rsiLength));
    return up.map((u, i) => {
      const d = down[i];
      return eq(d, 0) ? 100 : eq(u, 0) ? 0 : 100 - 100 / (1 + u / d);
    });
  };
  const rsiHigh = rsiOf(getSourceSeries(bars, cfg.rsiSourceHigh));
  const rsiLow = rsiOf(getSourceSeries(bars, cfg.rsiSourceLow));

  const plot0 = bars.map((b, i) => {
    const r = rsiHigh[i];
    const transparency = gt(r, 50) ? Math.max(0, (70 - r) * 2) : 100;
    return { time: b.time, value: r, color: String(color.new(cfg.highRsiColor, transparency)) };
  });
  const plot1 = bars.map((b, i) => {
    const r = rsiLow[i];
    const transparency = lt(r, 50) ? Math.max(0, (r - 30) * 2) : 100;
    return { time: b.time, value: r, color: String(color.new(cfg.lowRsiColor, transparency)) };
  });

  return {
    metadata: {
      title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay,
      precision: metadata.precision, format: metadata.format,
    },
    plots: { plot0, plot1 },
  };
}

export const TrueHighLowRsiForDivergence = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
