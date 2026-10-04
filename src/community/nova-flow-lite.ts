/**
 * Nova Flow Lite
 *
 * Flow line: EMA(close, 34), teal when it is above EMA(close, 55) and red otherwise, drawn twice (a wide glow at 80 %
 * transparency and the line) with a fill between them. Equilibrium zone: SMA(close, 34) +- one standard deviation
 * of 34 bars, drawn as two light grey lines with a grey fill.
 *
 * Reference: "Nova Flow Lite (Free)" by NovaQuantX
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © NovaQuantX
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

// The Pine script has no inputs
export type NovaFlowLiteInputs = Record<string, never>;

export const defaultInputs: NovaFlowLiteInputs = {};

export const inputConfig: InputConfig[] = [];

const COL_UP = String(color.new(color.teal, 0));
const COL_DOWN = String(color.new(color.red, 0));
const ZONE_LINE = String(color.new(color.gray, 90));
const ZONE_FILL = String(color.new(color.gray, 94));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Flow Glow', color: String(color.new(COL_UP, 80)), lineWidth: 8 },
  { id: 'plot1', title: 'Flow Line', color: COL_UP, lineWidth: 3 },
  // Untitled in Pine (title "")
  { id: 'plot2', title: 'Upper Band', color: ZONE_LINE, lineWidth: 1 },
  { id: 'plot3', title: 'Lower Band', color: ZONE_LINE, lineWidth: 1 },
];

export const metadata = {
  title: 'Nova Flow Free v2.1',
  shortTitle: 'Nova Flow Free',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(bars: Bar[], _inputs: Partial<NovaFlowLiteInputs> = {}): IndicatorResult {
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const close = Series.fromArray(bars, bars.map((b) => b.close));
  const fast = A(ta.ema(close, 34));
  const slow = A(ta.ema(close, 55));
  const basis = A(ta.sma(close, 34));
  const dev = A(ta.stdev(close, 34));
  const val = (v: number) => (Number.isFinite(v) ? v : NaN);

  // trendUp = fast > slow; flowColor = trendUp ? colUp : colDown
  const flowColor = bars.map((_b, i) => (gt(fast[i], slow[i]) ? COL_UP : COL_DOWN));
  const plot0 = bars.map((b, i) => ({ time: b.time, value: val(fast[i]), color: String(color.new(flowColor[i], 80)) }));
  const plot1 = bars.map((b, i) => ({ time: b.time, value: val(fast[i]), color: flowColor[i] }));
  const plot2 = bars.map((b, i) => ({ time: b.time, value: val(basis[i] + dev[i]), color: ZONE_LINE }));
  const plot3 = bars.map((b, i) => ({ time: b.time, value: val(basis[i] - dev[i]), color: ZONE_LINE }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2, plot3 },
    fills: [
      { plot1: 'plot0', plot2: 'plot1', colors: flowColor.map((c) => String(color.new(c, 90))) },
      { plot1: 'plot2', plot2: 'plot3', options: { color: ZONE_FILL } },
    ],
  };
}

export const NovaFlowLite = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
