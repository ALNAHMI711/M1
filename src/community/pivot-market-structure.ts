/**
 * Pivot Market Structure
 *
 * Pivot lines: the high / low of the last pivot high / low (`Pivot Length` bars on each side, of the high / low or
 * of the source) is kept as a circle line from the confirmation bar on (optionally only while the close is below /
 * above it, and optionally drawn back to the pivot bar). High / low trail: a close above the highest high of the
 * last `Step Size` bars (before this bar) or below the lowest low starts a new leg; the upper tail is the highest
 * high (`Length` bars) as it was on the last close below the lowest low, drawn while the close is below it, and the
 * lower tail is the lowest low as it was on the last close above the highest high, drawn while the close is above
 * it. Gradient fills between the close and the tails (transparent unless Filling is on).
 *
 * Reference: "Pivot Market Structure" by Daniel_Ge
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Daniel_Ge
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { barInterval, barTime } from '../bar-time';

export interface PivotMarketStructureInputs {
  /** Calculation source (not used when useHlValues is on) */
  src: SourceType;
  /** Use the high / low instead of the source */
  useHlValues: boolean;
  /** Length of the highest / lowest the close is compared with */
  stepLength: number;
  /** Length of the highest high / lowest low of the tails */
  hlLength: number;
  /** Gradient filling between the close and the tails */
  useFilling: boolean;
  /** Pivot length (left and right bars) */
  pivotLength: number;
  showPivotPoint: boolean;
  /** Draw the pivot lines back to the pivot bar */
  extendLeft: boolean;
  /** Pivot lines only while the close is below the pivot high / above the pivot low */
  lineBreak: boolean;
}

export const defaultInputs: PivotMarketStructureInputs = {
  src: 'close',
  useHlValues: true,
  stepLength: 1,
  hlLength: 10,
  useFilling: false,
  pivotLength: 5,
  showPivotPoint: false,
  extendLeft: false,
  lineBreak: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close', group: 'Source',
    tooltip: "Used calculation source. No effect if 'Use High/Low values instead of source' is used." },
  { id: 'useHlValues', type: 'bool', title: 'Use High/Low values instead of source', defval: true, group: 'Source',
    tooltip: "Use High/Low values for calculation. If unchecked 'Source' will be used." },
  { id: 'stepLength', type: 'int', title: 'Step Size', defval: 1, min: 1, group: 'High Low Trail',
    tooltip: 'Length used to compare the current price against the last highest high/lowest low.' },
  { id: 'hlLength', type: 'int', title: 'Length', defval: 10, min: 1, group: 'High Low Trail',
    tooltip: 'Length used to determine the last highest high/lowest low.' },
  { id: 'useFilling', type: 'bool', title: 'Filling', defval: false, group: 'High Low Trail', tooltip: 'Use Gradient Filling' },
  { id: 'pivotLength', type: 'int', title: 'Pivot Length', defval: 5, group: 'Pivot' },
  { id: 'showPivotPoint', type: 'bool', title: 'Show Pivot Points', defval: false, group: 'Pivot' },
  { id: 'extendLeft', type: 'bool', title: 'Extend Left', defval: false, group: 'Pivot',
    tooltip: 'Extend pivot line to the left until it reaches the pivot point' },
  { id: 'lineBreak', type: 'bool', title: 'Line Break', defval: false, group: 'Pivot', tooltip: 'Breaks the line at close' },
];

const PH_COL = String(color.new('#ff0099', 50));
const PL_COL = String(color.new('#00c3ff', 50));
const LEFT_COL = String(color.new('#b2b5be', 50));
const PPH_COL = String(color.new('#ff0099', 70));
const PPL_COL = String(color.new('#00c3ff', 70));
const UPPER_COL = String(color.new('#ff0099', 60));
const LOWER_COL = String(color.new('#00c3ff', 60));
const MID_COL = '#d1d4dc';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Pivot High (Right)', color: PH_COL, lineWidth: 1, style: 'circles' },
  { id: 'plot1', title: 'Pivot Low (Right)', color: PL_COL, lineWidth: 1, style: 'circles' },
  { id: 'plot2', title: 'Pivot High (Left)', color: LEFT_COL, lineWidth: 1, style: 'circles' },
  { id: 'plot3', title: 'Pivot Low (Left)', color: LEFT_COL, lineWidth: 1, style: 'circles' },
  { id: 'plot4', title: 'Tail Upper Line', color: UPPER_COL, lineWidth: 1, style: 'linebr' },
  { id: 'plot5', title: 'Tail Mid Line', color: MID_COL, lineWidth: 1, display: 'none' },
  { id: 'plot6', title: 'Tail Lower Line', color: LOWER_COL, lineWidth: 1, style: 'linebr' },
  { id: 'plot7', title: 'Close', color: color.blue, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Pivot Market Structure',
  shortTitle: 'Pivot Market Structure',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** ta.barssince(cond): bars since cond was last true, na before the first true */
function barssince(cond: boolean[]): number[] {
  let last = -1;
  return cond.map((c, i) => {
    if (c) last = i;
    return last < 0 ? NaN : i - last;
  });
}

export function calculate(
  bars: Bar[],
  inputs: Partial<PivotMarketStructureInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const L = cfg.pivotLength;
  const close = bars.map((b) => b.close);
  const src = A(getSourceSeries(bars, cfg.src));
  const hiSrc = cfg.useHlValues ? bars.map((b) => b.high) : src;
  const loSrc = cfg.useHlValues ? bars.map((b) => b.low) : src;
  /**
   * x[k]: na before the first bar. An na offset reads the current bar (x[na] = x[0] in Pine: before the first pivot,
   * high[pivot_length + na] is the high of the bar)
   */
  const hist = (x: number[], i: number, k: number) => {
    const off = isNaN(k) ? 0 : k;
    return i - off < 0 ? NaN : x[i - off];
  };

  // Pivot points (ta.pivothigh(pivot_length, pivot_length) uses the high, ta.pivotlow the low)
  const ph = A(ta.pivothigh(S(hiSrc), L, L));
  const pl = A(ta.pivotlow(S(loSrc), L, L));
  // ta.barssince(bool(ph)): bool(na) and bool(0) are false
  const phBarssince = barssince(ph.map((v) => !isNaN(v) && v !== 0));
  const plBarssince = barssince(pl.map((v) => !isNaN(v) && v !== 0));
  const phHigh = bars.map((_b, i) => hist(hiSrc, i, L + phBarssince[i]));
  const plLow = bars.map((_b, i) => hist(loSrc, i, L + plBarssince[i]));

  // High / low trail
  const hiStep = A(ta.highest(S(hiSrc), cfg.stepLength));
  const loStep = A(ta.lowest(S(loSrc), cfg.stepLength));
  const isHighest = bars.map((_b, i) => gt(close[i], hist(hiStep, i, 1)));
  const isLowest = bars.map((_b, i) => lt(close[i], hist(loStep, i, 1)));
  const highestBarssince = barssince(isLowest);
  const lowestBarssince = barssince(isHighest);
  const hiLen = A(ta.highest(S(hiSrc), cfg.hlLength));
  const loLen = A(ta.lowest(S(loSrc), cfg.hlLength));
  const highestSinceX = bars.map((_b, i) => hist(hiLen, i, highestBarssince[i]));
  const lowestSinceX = bars.map((_b, i) => hist(loLen, i, lowestBarssince[i]));
  const upperLine = bars.map((_b, i) => (lt(close[i], highestSinceX[i]) ? highestSinceX[i] : NaN));
  const lowerLine = bars.map((_b, i) => (gt(close[i], lowestSinceX[i]) ? lowestSinceX[i] : NaN));
  const midLine = bars.map((_b, i) => (highestSinceX[i] + lowestSinceX[i]) / 2);

  const interval = barInterval(bars);
  const line = (values: number[], col: string) => bars.map((b, i) => ({ time: b.time, value: values[i], color: col }));
  // plot(..., offset = -pivot_length): the value of bar i is drawn on bar i - pivot_length
  const leftLine = (values: number[], barssinceArr: number[]) => {
    const out: Array<{ time: number; value: number; color: string }> = [];
    for (let i = 0; i < n; i++) {
      if (i - L < 0) continue;
      out.push({ time: barTime(bars, i - L, interval), value: cfg.extendLeft && gt(L, barssinceArr[i]) ? values[i] : NaN, color: LEFT_COL });
    }
    return out;
  };

  const plots = {
    plot0: line(bars.map((_b, i) => (cfg.lineBreak ? (lt(close[i], phHigh[i]) ? phHigh[i] : NaN) : phHigh[i])), PH_COL),
    plot1: line(bars.map((_b, i) => (cfg.lineBreak ? (gt(close[i], plLow[i]) ? plLow[i] : NaN) : plLow[i])), PL_COL),
    plot2: leftLine(phHigh, phBarssince),
    plot3: leftLine(plLow, plBarssince),
    plot4: line(upperLine, UPPER_COL),
    plot5: line(midLine, MID_COL),
    plot6: line(lowerLine, LOWER_COL),
    plot7: bars.map((b) => ({ time: b.time, value: b.close })),
  };

  // plotshape(show_pivot_point ? ph : na, shape.circle, location.abovebar / belowbar, offset = -pivot_length)
  const markers: MarkerData[] = [];
  if (cfg.showPivotPoint) {
    for (let i = L; i < n; i++) {
      if (!isNaN(ph[i]) && ph[i] !== 0) {
        markers.push({ time: barTime(bars, i - L, interval), position: 'aboveBar', shape: 'circle', color: PPH_COL, size: 'auto' });
      }
      if (!isNaN(pl[i]) && pl[i] !== 0) {
        markers.push({ time: barTime(bars, i - L, interval), position: 'belowBar', shape: 'circle', color: PPL_COL, size: 'auto' });
      }
    }
  }

  // fill(p_close, p_upper / p_lower, close, upper_line / lower_line, na, use_filling ? color.new(c, 97) : color.new(c, 100))
  const upperFill = String(color.new('#ff0099', cfg.useFilling ? 97 : 100));
  const lowerFill = String(color.new('#00c3ff', cfg.useFilling ? 97 : 100));
  const none = new Array<string | null>(n).fill(null);
  const fills = [
    { plot1: 'plot7', plot2: 'plot4', options: { title: 'Upper Gradient Filling' },
      gradient: { topValue: close.slice(), bottomValue: upperLine, topColor: none, bottomColor: new Array<string | null>(n).fill(upperFill) } },
    { plot1: 'plot7', plot2: 'plot6', options: { title: 'Lower Gradient Filling' },
      gradient: { topValue: close.slice(), bottomValue: lowerLine, topColor: none.slice(), bottomColor: new Array<string | null>(n).fill(lowerFill) } },
  ];

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    markers,
    fills,
  };
}

export const PivotMarketStructure = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
