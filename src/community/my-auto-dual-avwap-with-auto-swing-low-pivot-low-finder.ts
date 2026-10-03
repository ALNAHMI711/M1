/**
 * My dual avwap swing low/pivot low finder
 *
 * Two pairs of anchored VWAPs (sum(src * volume) / sum(volume)), each pair with its own start / end time and two
 * sources. A pair starts on the first bar at or after the start time. Between the start and the end time, a bar
 * whose source is lower than the previous source and equal to the lowest source of the range so far (a new swing
 * low) starts the sums again from that bar. After the end time the sums keep growing.
 * Optional "first handoff" lines: a VWAP of the same source anchored to the last bar where the low crossed under
 * the pair VWAP, shown while the high is above it.
 *
 * Reference: "My dual avwap swing low/pivot low finder" by doqkhanh
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © doqkhanh
 */

import { callsite, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface MyAutoDualAvwapInputs {
  /** Start of the first range (UNIX ms, Pine input.time) */
  startTime: number;
  /** End of the first range (UNIX ms) */
  endTime: number;
  /** Source of the first VWAP of the first pair */
  inputData: SourceType;
  /** Source of the second VWAP of the first pair */
  inputData2: SourceType;
  /** Start of the second range (UNIX ms) */
  secondStartTime: number;
  /** End of the second range (UNIX ms) */
  secondEndTime: number;
  secondInputData: SourceType;
  secondInputData2: SourceType;
  /** Show the VWAPs anchored to the last cross under (first handoff) */
  isShowTheLastTouchArchoredVWAP: boolean;
}

/** timestamp('01 Oct 2022 00:00 +0300') ... */
export const defaultInputs: MyAutoDualAvwapInputs = {
  startTime: Date.UTC(2022, 8, 30, 21, 0),
  endTime: Date.UTC(2023, 2, 31, 21, 0),
  inputData: 'high',
  inputData2: 'low',
  secondStartTime: Date.UTC(2023, 9, 31, 21, 0),
  secondEndTime: Date.UTC(2024, 7, 31, 21, 0),
  secondInputData: 'high',
  secondInputData2: 'low',
  isShowTheLastTouchArchoredVWAP: false,
};

const G1 = 'First vwap line';
const G2 = 'Second vwap line';
const G3 = 'The First Handoff';

export const inputConfig: InputConfig[] = [
  { id: 'startTime', type: 'time', title: 'Start Time (First VWAP)', defval: defaultInputs.startTime, group: G1 },
  { id: 'endTime', type: 'time', title: 'End Time (First VWAP)', defval: defaultInputs.endTime, group: G1 },
  { id: 'inputData', type: 'source', title: 'Source Low (First VWAP)', defval: 'high', group: G1 },
  { id: 'inputData2', type: 'source', title: 'Source High (First VWAP)', defval: 'low', group: G1 },
  { id: 'secondStartTime', type: 'time', title: 'Start Time (Second VWAP)', defval: defaultInputs.secondStartTime, group: G2 },
  { id: 'secondEndTime', type: 'time', title: 'End Time (Second VWAP)', defval: defaultInputs.secondEndTime, group: G2 },
  { id: 'secondInputData', type: 'source', title: 'Source Low (Second VWAP)', defval: 'high', group: G2 },
  { id: 'secondInputData2', type: 'source', title: 'Source High (Second VWAP)', defval: 'low', group: G2 },
  {
    id: 'isShowTheLastTouchArchoredVWAP', type: 'bool',
    title: 'Show the VWAP anchored to the last TOUCH, aka The first handoff', defval: false, group: G3,
  },
];

const FIRST_COLOR = '#DF40FB80';
const SECOND_COLOR = String(color.rgb(188, 29, 8, 80));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'AVWAP Low (First)', color: FIRST_COLOR, lineWidth: 12 },
  { id: 'plot1', title: 'AVWAP High (First)', color: FIRST_COLOR, lineWidth: 12 },
  { id: 'plot2', title: 'AVWAP Low (Second)', color: SECOND_COLOR, lineWidth: 12 },
  { id: 'plot3', title: 'AVWAP High (Second)', color: SECOND_COLOR, lineWidth: 12 },
  { id: 'plot4', title: 'First Handoff AVWAP (First Pair)', color: color.red, lineWidth: 6, style: 'linebr' },
  { id: 'plot5', title: 'First Handoff AVWAP (First Pair)', color: color.red, lineWidth: 6, style: 'linebr' },
  { id: 'plot6', title: 'First Handoff AVWAP (Second Pair)', color: color.blue, lineWidth: 6, style: 'linebr' },
  { id: 'plot7', title: 'First Handoff AVWAP (Second Pair)', color: color.blue, lineWidth: 6, style: 'linebr' },
];

export const metadata = {
  title: 'My dual avwap swing low/pivot low finder',
  shortTitle: 'Dual avwap with auto swing finder',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

/** f_calculate_vwap(src1st, src2nd, _startTime, _endTime): one call site (its own var state and history) */
function swingVwap(bars: Bar[], src1: number[], src2: number[], start: number, end: number): [number[], number[]] {
  const n = bars.length;
  const out1: number[] = new Array(n);
  const out2: number[] = new Array(n);
  let low1 = 10e10; // var float currentSwingLowSrc1st = 10e10
  let low2 = 10e10;
  let sumpv1 = NaN; // sumpv1st[1] ... (na before the first value)
  let sumv1 = NaN;
  let sumpv2 = NaN;
  let sumv2 = NaN;
  for (let i = 0; i < n; i++) {
    const t = bars[i].time * 1000;
    const v = bars[i].volume ?? NaN;
    const inTimeRange = t >= start && t <= end;
    // time[1] < _startTime: time[1] is na on the first bar
    const startTimeRange = t >= start && i > 0 && bars[i - 1].time * 1000 < start;
    if (lt(src1[i], low1) && inTimeRange) low1 = src1[i];
    if (lt(src2[i], low2) && inTimeRange) low2 = src2[i];

    const prev1 = i > 0 ? src1[i - 1] : NaN;
    if (lt(src1[i], prev1) && eq(src1[i], low1) && (inTimeRange || startTimeRange)) {
      sumpv1 = src1[i] * v;
      sumv1 = v;
    } else {
      sumpv1 = startTimeRange ? src1[i] * v : sumpv1 + src1[i] * v;
      sumv1 = startTimeRange ? v : sumv1 + v;
    }
    out1[i] = sumpv1 / sumv1;

    const prev2 = i > 0 ? src2[i - 1] : NaN;
    if (lt(src2[i], prev2) && eq(src2[i], low2) && (inTimeRange || startTimeRange)) {
      sumpv2 = src2[i] * v;
      sumv2 = v;
    } else {
      sumpv2 = startTimeRange ? src2[i] * v : sumpv2 + src2[i] * v;
      sumv2 = startTimeRange ? v : sumv2 + v;
    }
    out2[i] = sumpv2 / sumv2;
  }
  return [out1, out2];
}

/**
 * f_calculate_the_first_handoffs_anchored_avwap(src1st, src2nd, priceData, avwap_low, avwap_high): one call site.
 * Returns [lastAvwap1st, lastAvwap2nd, lastCrossTime1st, lastCrossTime2nd] per bar.
 */
function handoffVwap(
  bars: Bar[], src1: number[], src2: number[], price: number[], avwapLow: number[], avwapHigh: number[],
): [number[], number[], number[], number[]] {
  const n = bars.length;
  const r1: number[] = new Array(n);
  const r2: number[] = new Array(n);
  const ct1: number[] = new Array(n);
  const ct2: number[] = new Array(n);
  // ta.crossunder (exact comparisons; the infinite value of a division by 0 counts)
  const crossLow = callsite.crossunder();
  const crossHigh = callsite.crossunder();
  let crossTime1 = NaN;
  let crossTime2 = NaN;
  let avwap1 = NaN;
  let avwap2 = NaN;
  let sumpv1 = NaN;
  let sumv1 = NaN;
  let sumpv2 = NaN;
  let sumv2 = NaN;
  for (let i = 0; i < n; i++) {
    const t = bars[i].time * 1000;
    const v = bars[i].volume ?? NaN;
    const crossUnderLow = crossLow(price[i], avwapLow[i]);
    const crossUnderHigh = crossHigh(price[i], avwapHigh[i]);
    if (crossUnderLow) crossTime1 = t;
    if (crossUnderHigh) crossTime2 = t;
    if (!isNaN(crossTime1)) {
      if (crossUnderLow) {
        sumpv1 = src1[i] * v;
        sumv1 = v;
      } else {
        sumpv1 = sumpv1 + src1[i] * v;
        sumv1 = sumv1 + v;
      }
      if (gt(sumv1, 0)) avwap1 = sumpv1 / sumv1;
    }
    if (!isNaN(crossTime2)) {
      if (crossUnderHigh) {
        sumpv2 = src2[i] * v;
        sumv2 = v;
      } else {
        sumpv2 = sumpv2 + src2[i] * v;
        sumv2 = sumv2 + v;
      }
      if (gt(sumv2, 0)) avwap2 = sumpv2 / sumv2;
    }
    r1[i] = avwap1;
    r2[i] = avwap2;
    ct1[i] = crossTime1;
    ct2[i] = crossTime2;
  }
  return [r1, r2, ct1, ct2];
}

export function calculate(bars: Bar[], inputs: Partial<MyAutoDualAvwapInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const src = (s: SourceType) => getSourceSeries(bars, s).toArray().map((v) => v ?? NaN);
  const low = bars.map((b) => b.low);

  // Error handling of the script: swap start and end times when endTime <= startTime
  let { startTime, endTime, secondStartTime, secondEndTime } = cfg;
  if (endTime <= startTime) [startTime, endTime] = [endTime, startTime];
  if (secondEndTime <= secondStartTime) [secondStartTime, secondEndTime] = [secondEndTime, secondStartTime];

  const in1 = src(cfg.inputData);
  const in2 = src(cfg.inputData2);
  const sin1 = src(cfg.secondInputData);
  const sin2 = src(cfg.secondInputData2);
  const [avwapLow, avwapHigh] = swingVwap(bars, in1, in2, startTime, endTime);
  const [secAvwapLow, secAvwapHigh] = swingVwap(bars, sin1, sin2, secondStartTime, secondEndTime);
  const [aFirstLow, aFirstHigh, tFirst1, tFirst2] = handoffVwap(bars, in1, in2, low, avwapLow, avwapHigh);
  const [aSecLow, aSecHigh, tSec1, tSec2] = handoffVwap(bars, sin1, sin2, low, secAvwapLow, secAvwapHigh);

  // plot(not na(x) ? x : na): na() is true for +-infinity, the plot shows na
  const fin = (x: number) => (Number.isFinite(x) ? x : NaN);
  const line = (vals: number[], c: string) => bars.map((b, i) => ({ time: b.time, value: fin(vals[i]), color: c }));
  // plot(show and not na(a) and time > anchorTime and high > a ? a : na, style = plot.style_linebr)
  const handoff = (vals: number[], anchor: number[], c: string) => bars.map((b, i) => {
    const a = vals[i];
    const shown = cfg.isShowTheLastTouchArchoredVWAP && Number.isFinite(a) && b.time * 1000 > anchor[i]
      && gt(b.high, a);
    return { time: b.time, value: shown ? a : NaN, color: c };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: line(avwapLow, FIRST_COLOR),
      plot1: line(avwapHigh, FIRST_COLOR),
      plot2: line(secAvwapLow, SECOND_COLOR),
      plot3: line(secAvwapHigh, SECOND_COLOR),
      plot4: handoff(aFirstLow, tFirst1, color.red),
      plot5: handoff(aFirstHigh, tFirst2, color.red),
      plot6: handoff(aSecLow, tSec1, color.blue),
      plot7: handoff(aSecHigh, tSec2, color.blue),
    },
  };
}

export const MyAutoDualAvwapWithAutoSwingLowPivotLowFinder = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
