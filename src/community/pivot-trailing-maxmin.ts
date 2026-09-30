/**
 * Pivot Based Trailing Maxima & Minima [LuxAlgo]
 *
 * Tracks trailing maximum and minimum levels using pivot detection.
 * When a pivot high or low is detected, max/min reset to the bar's
 * high/low at the pivot offset. Between pivots, max ratchets up and
 * min ratchets down. An average line is plotted between the two.
 * On the pivot bars Pine gives the plots and the fill an na colour.
 *
 * backpaint (Pine input, default false): offset = length. The plots and labels are drawn `length` bars back and, on
 * the last bar, lines rebuild the trailing max / min / average over the last `length` bars.
 *
 * Reference: "Pivot Based Trailing Maxima & Minima [LuxAlgo]" by LuxAlgo
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, LineDrawingData } from '../types';

export interface PivotTrailingMaxMinInputs {
  length: number;
  backpaint: boolean;
  maxCss: string;
  minCss: string;
  avgCss: string;
  bullFill: string;
  bearFill: string;
}

export const defaultInputs: PivotTrailingMaxMinInputs = {
  length: 24,
  backpaint: false,
  maxCss: '#00897B',
  minCss: '#FF5252',
  avgCss: '#ff5d00',
  bullFill: 'rgba(0,137,123,0.2)',
  bearFill: 'rgba(255,82,82,0.2)',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 24, min: 2, max: 500 },
  { id: 'backpaint', type: 'bool', title: 'backpaint', defval: false },
  { id: 'maxCss', type: 'color', title: 'Trailing Maximum Color', defval: '#00897B' },
  { id: 'minCss', type: 'color', title: 'Trailing Minimum Color', defval: '#FF5252' },
  // Pine uses the title 'Trailing Maximum Color' for the average colour too
  { id: 'avgCss', type: 'color', title: 'Trailing Maximum Color', defval: '#ff5d00' },
  { id: 'bullFill', type: 'color', title: 'Uptrend Area', defval: 'rgba(0,137,123,0.2)' },
  { id: 'bearFill', type: 'color', title: 'Downtrend Area', defval: 'rgba(255,82,82,0.2)' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trailing Maximum', color: '#00897B', lineWidth: 1 },
  { id: 'plot1', title: 'Trailing Minimum', color: '#FF5252', lineWidth: 1 },
  { id: 'plot2', title: 'Average', color: '#ff5d00', lineWidth: 1 },
];

export const metadata = {
  title: 'Pivot Based Trailing Maxima & Minima',
  shortTitle: 'Pivot Trail MaxMin',
  overlay: true,
};

// Pine: indicator(..., max_lines_count = 500)
const MAX_LINES = 500;

export function calculate(bars: Bar[], inputs: Partial<PivotTrailingMaxMinInputs> = {}): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; lines: LineDrawingData[] } {
  const { length, backpaint, maxCss, minCss, avgCss, bullFill, bearFill } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const offset = backpaint ? length : 0;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const phArr = ta.pivothigh(highSeries, length, length).toArray();
  const plArr = ta.pivotlow(lowSeries, length, length).toArray();
  // Pine `if ph or pl`: a float is true when it is not na and not 0
  const isOn = (v: number | undefined) => v != null && !isNaN(v) && v !== 0;

  const maxArr: number[] = new Array(n);
  const minArr: number[] = new Array(n);
  const avgArr: number[] = new Array(n);
  const pivotBar: boolean[] = new Array(n);
  const fillCss: (string | null)[] = new Array(n);

  let trailMax = NaN;
  let trailMin = NaN;
  let lastFill: string | null = null;

  for (let i = 0; i < n; i++) {
    const ph = isOn(phArr[i]);
    const pl = isOn(plArr[i]);
    pivotBar[i] = ph || pl;

    if (ph || pl) {
      trailMax = bars[i - length].high;
      trailMin = bars[i - length].low;
    }
    // max := math.max(high[offset], max) (na stays na)
    const hOff = i - offset >= 0 ? bars[i - offset].high : NaN;
    const lOff = i - offset >= 0 ? bars[i - offset].low : NaN;
    trailMax = isNaN(trailMax) || isNaN(hOff) ? NaN : Math.max(hOff, trailMax);
    trailMin = isNaN(trailMin) || isNaN(lOff) ? NaN : Math.min(lOff, trailMin);

    maxArr[i] = trailMax;
    minArr[i] = trailMin;
    avgArr[i] = (trailMax + trailMin) / 2;

    // fill_css = fixnan(ph ? bearFill : pl ? bullFill : na)
    if (ph) lastFill = bearFill;
    else if (pl) lastFill = bullFill;
    fillCss[i] = lastFill;
  }

  // Plots: plot(max, color = ph or pl ? na : maxCss, offset = -offset): the value of bar i is drawn on bar i - offset
  const plotOf = (arr: number[], css: string) =>
    bars.map((b, j) => {
      const i = j + offset;
      if (i >= n || isNaN(arr[i])) return { time: b.time, value: NaN };
      return { time: b.time, value: arr[i], color: pivotBar[i] ? 'transparent' : css };
    });
  const plot0 = plotOf(maxArr, maxCss);
  const plot1 = plotOf(minArr, minCss);
  const plot2 = plotOf(avgArr, avgCss);

  // fill(plot1, plot2, ph or pl ? na : fill_css), drawn with the plots
  const fillColors: string[] = bars.map((_b, j) => {
    const i = j + offset;
    if (i >= n || pivotBar[i] || fillCss[i] == null) return 'transparent';
    return fillCss[i]!;
  });

  // Labels: plotshape(pl ? pl : na, "Pivot High", shape.labelup, location.absolute, maxCss, -offset, text = "▲",
  // textcolor = color.white, size = size.tiny) and plotshape(ph ? ph : na, "Pivot Low", shape.labeldown,
  // location.absolute, minCss, -offset, text = "▼", textcolor = color.white, size = size.tiny).
  // location.absolute at the pivot price: labelup hangs below the price, labeldown stands above it.
  const markers: MarkerData[] = [];
  for (let i = offset; i < n; i++) {
    if (isOn(plArr[i])) {
      markers.push({
        time: bars[i - offset].time, position: 'atPriceBottom', price: plArr[i]!, shape: 'labelUp',
        color: maxCss, text: '▲', textColor: '#FFFFFF', size: 'tiny',
      });
    }
    if (isOn(phArr[i])) {
      markers.push({
        time: bars[i - offset].time, position: 'atPriceTop', price: phArr[i]!, shape: 'labelDown',
        color: minCss, text: '▼', textColor: '#FFFFFF', size: 'tiny',
      });
    }
  }

  // backpaint, last bar: lines over the last `length` bars (Pine loop i = 0 to length - 1).
  // linefill.new(line1, line2, color.new(fill_css, 80)) has no output type in the port and is not drawn.
  let lines: LineDrawingData[] = [];
  if (backpaint && n > length) {
    const last = n - 1;
    let maxPrev = maxArr[last];
    let minPrev = minArr[last];
    let avgPrev = avgArr[last];
    for (let i = 0; i <= length - 1; i++) {
      const k = last - (length - 1 - i); // high[length - 1 - i]
      const max2 = isNaN(maxPrev) ? NaN : Math.max(bars[k].high, maxPrev);
      const min2 = isNaN(minPrev) ? NaN : Math.min(bars[k].low, minPrev);
      const avg2 = (max2 + min2) / 2;
      const t1 = bars[last - (length - i)].time;
      const t2 = bars[last - (length - 1 - i)].time;
      lines.push({ time1: t1, price1: maxPrev, time2: t2, price2: max2, color: maxCss, width: 1, style: 'solid' });
      lines.push({ time1: t1, price1: minPrev, time2: t2, price2: min2, color: minCss, width: 1, style: 'solid' });
      lines.push({ time1: t1, price1: avgPrev, time2: t2, price2: avg2, color: avgCss, width: 1, style: 'solid' });
      maxPrev = max2;
      minPrev = min2;
      avgPrev = avg2;
    }
    // max_lines_count = 500: the oldest lines are deleted
    if (lines.length > MAX_LINES) lines = lines.slice(lines.length - MAX_LINES);
    lines = lines.filter((l) => !isNaN(l.price1) && !isNaN(l.price2));
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
    fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: bullFill }, colors: fillColors }],
    markers,
    lines,
  };
}

export const PivotTrailingMaxMin = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
