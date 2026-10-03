/**
 * Ghost EMA Cloud
 *
 * EMAs of the close with lengths 9, 14, 12 and 5 (the 12 and 5 EMAs are hidden by default). The area between the
 * 9 EMA and the 14 EMA is green when the 9 EMA is above the 14 EMA, red otherwise.
 *
 * Reference: "Gho$t EMA Cloud" by Ghostmlt
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

// The Pine script has no inputs
export interface GhostEmaCloudInputs {}

export const defaultInputs: GhostEmaCloudInputs = {};

export const inputConfig: InputConfig[] = [];

const C9 = String(color.new('#9c9c9c', 0));
const C14 = String(color.new('#ffffff', 0));
const C12 = String(color.new('#d1d417', 0));
const C5 = String(color.new('#e4a42d', 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '9 EMA', color: C9, lineWidth: 1 },
  { id: 'plot1', title: '14 EMA', color: C14, lineWidth: 1 },
  { id: 'plot2', title: '12 EMA', color: C12, lineWidth: 1, display: 'none' },
  { id: 'plot3', title: '5 EMA', color: C5, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Ghost EMA Cloud',
  shortTitle: 'Ghost EMA Cloud',
  overlay: true,
};

/** Pine a > b: a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;

export function calculate(bars: Bar[], _inputs: Partial<GhostEmaCloudInputs> = {}): IndicatorResult {
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const close = Series.fromArray(bars, bars.map((b) => b.close));
  const e9 = A(ta.ema(close, 9));
  const e14 = A(ta.ema(close, 14));
  const e5 = A(ta.ema(close, 5));
  const e12 = A(ta.ema(close, 12));

  // bullishColor = color.new(#66bb6a, 55), bearishColor = color.new(#f23645, 55)
  const bullish = String(color.new('#66bb6a', 55));
  const bearish = String(color.new('#f23645', 55));
  const line = (v: number[], c: string) => bars.map((b, i) => ({ time: b.time, value: v[i], color: c }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: line(e9, C9),
      plot1: line(e14, C14),
      plot2: line(e12, C12),
      plot3: line(e5, C5),
    },
    fills: [
      // fill(plot9, plot14, color = e9 > e14 ? bullishColor : bearishColor)
      { plot1: 'plot0', plot2: 'plot1', options: { title: 'Plots Background' },
        colors: bars.map((_b, i) => (gt(e9[i], e14[i]) ? bullish : bearish)) },
    ],
  };
}

export const GhostEmaCloud = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
