/**
 * CMO For Loop | QuantLapse
 *
 * Chande Momentum Oscillator: 100 * (up - down) / (up + down), with up / down the sums over `length` bars of the
 * positive / negative changes of the source. The trend turns long when the CMO is above the long threshold and short
 * when it is below the short threshold; it colours the CMO histogram and the price candles. Triangles on the price
 * pane mark a change of trend; the two thresholds are drawn as lines with a fill between them.
 *
 * Reference: "CMO For Loop | QuantLapse" by QuantLapse
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Chande Momentum Oscillator script may be freely distributed under the MIT license.
 * Creds to Alex Orekhov (everget)
 */

import { ta, Series, math, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';

export interface CmoForLoopQuantlapseInputs {
  /** CMO length */
  length: number;
  /** Source */
  src: SourceType;
  /** Long threshold */
  LongThreshold: number;
  /** Short threshold */
  ShortThreshold: number;
}

export const defaultInputs: CmoForLoopQuantlapseInputs = {
  length: 14,
  src: 'close',
  LongThreshold: 25,
  ShortThreshold: -25,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'LongThreshold', type: 'int', title: 'Long Threshold', defval: 25 },
  { id: 'ShortThreshold', type: 'int', title: 'Short Threshold', defval: -25 },
];

const LONG_COL = '#0dfb84';
const SHORT_COL = '#f8274a';
const FILL_COL = String(color.new(color.purple, 90));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Overbought Level', color: color.white, lineWidth: 1 },
  { id: 'plot1', title: 'Oversold Level', color: color.white, lineWidth: 1 },
  { id: 'plot2', title: 'CMO For Loop', color: color.gray, lineWidth: 2, style: 'histogram' },
];

export const metadata = {
  title: 'CMO For Loop | QuantLapse',
  shortTitle: 'CMO For Loop ✧˚ | QuantLapse',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<CmoForLoopQuantlapseInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, LongThreshold, ShortThreshold } = cfg;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  const momentum = A(ta.change(getSourceSeries(bars, cfg.src)));
  // math.max(na, 0) / math.min(na, 0) are na
  const ups = momentum.map((m) => (isNaN(m) ? NaN : Math.max(m, 0)));
  const downs = momentum.map((m) => (isNaN(m) ? NaN : -Math.min(m, 0)));
  const mathSUMUP = A(math.sum(S(ups), length) as Series);
  const mathSUMDOWN = A(math.sum(S(downs), length) as Series);

  const plot0 = [];
  const plot1 = [];
  const plot2 = [];
  const markers: MarkerData[] = [];
  const candles: PlotCandleData[] = [];
  let trendCMO = 0; // var trend_CMO = 0
  let prevSignalL = false;
  let prevSignalS = false;
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const time = b.time;
    // plain division: 0 / 0 is na
    const cmo = (100 * (mathSUMUP[i] - mathSUMDOWN[i])) / (mathSUMUP[i] + mathSUMDOWN[i]);
    const longCondition1 = gt(cmo, LongThreshold);
    const shortCondition1 = lt(cmo, ShortThreshold);
    if (longCondition1 && !shortCondition1) trendCMO = 1;
    else if (shortCondition1) trendCMO = -1;
    const signalL = trendCMO === 1;
    const signalS = trendCMO === -1;
    // signalS[1] / signalL[1]: false on bar 0 (na history)
    const signalL1 = signalL && i > 0 && prevSignalS;
    const signalS1 = signalS && i > 0 && prevSignalL;
    prevSignalL = signalL;
    prevSignalS = signalS;

    const trendcolor = trendCMO === 1 ? LONG_COL : trendCMO === -1 ? SHORT_COL : color.gray;
    plot0.push({ time, value: LongThreshold, color: color.white });
    plot1.push({ time, value: ShortThreshold, color: color.white });
    plot2.push({ time, value: Number.isFinite(cmo) ? cmo : NaN, color: trendcolor });
    // plotshape(signalL1, color = #0dfb84, style = shape.triangleup, location = location.belowbar, force_overlay = true, size = size.small)
    if (signalL1) markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: LONG_COL, size: 'small', forceOverlay: true });
    if (signalS1) markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: SHORT_COL, size: 'small', forceOverlay: true });
    // plotcandle(open, high, low, close, "Color", color = trendcolor, wickcolor = trendcolor, bordercolor = trendcolor, force_overlay = true)
    candles.push({ time, open: b.open, high: b.high, low: b.low, close: b.close,
      color: trendcolor, wickColor: trendcolor, borderColor: trendcolor, forceOverlay: true });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2 },
    // hline(0, title = 'Zero Level', linestyle = hline.style_dotted): Pine default colour #787B86
    hlines: [{ value: 0, options: { title: 'Zero Level', color: '#787B86', linestyle: 'dotted' } }],
    // fill(plotLong, plotShort, color = color.new(color.purple, 90))
    fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'Plots Background', color: FILL_COL } }],
    markers,
    plotCandles: { cmoCandles: candles },
  };
}

export const CmoForLoopQuantlapse = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
