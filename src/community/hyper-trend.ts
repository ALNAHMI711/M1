/**
 * HyperTrend [LuxAlgo]
 *
 * ATR-based adaptive trend following indicator with upper/lower bands.
 * Uses a multiplicative factor to detect trend changes, then builds
 * an average line that drifts in trend direction. Bands are drawn
 * around the average at a configurable width percentage.
 *
 * Reference: "HyperTrend [LuxAlgo]" by LuxAlgo
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface HyperTrendInputs {
  mult: number;
  slope: number;
  widthPct: number;
}

export const defaultInputs: HyperTrendInputs = {
  mult: 5,
  slope: 14,
  widthPct: 80,
};

export const inputConfig: InputConfig[] = [
  { id: 'mult', type: 'float', title: 'Multiplicative Factor', defval: 5, min: 0, step: 0.5 },
  { id: 'slope', type: 'float', title: 'Slope', defval: 14, min: 0, step: 1 },
  { id: 'widthPct', type: 'float', title: 'Width %', defval: 80, min: 0, max: 100, step: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'upper', title: 'Upper', color: 'transparent', lineWidth: 1 },
  { id: 'avg', title: 'Average', color: '#26A69A', lineWidth: 2 },
  { id: 'lower', title: 'Lower', color: 'transparent', lineWidth: 1 },
];

export const metadata = {
  title: 'HyperTrend [LuxAlgo]',
  shortTitle: 'HyperTrend',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<HyperTrendInputs> = {}): IndicatorResult {
  const { mult, slope, widthPct } = { ...defaultInputs, ...inputs };
  const width = widthPct / 100;
  const n = bars.length;

  const closeSeries = new Series(bars, (b) => b.close);
  const atrArr = ta.atr(bars, 200).toArray();

  const avg: number[] = new Array(n);
  const upper: number[] = new Array(n);
  const lower: number[] = new Array(n);
  const os: number[] = new Array(n);
  const hold: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const close = bars[i].close;
    const atr = (atrArr[i] ?? 0) * mult;
    const prevAvg = i > 0 ? avg[i - 1] : close;
    const prevOs = i > 0 ? os[i - 1] : 1;
    const prevHold = i > 0 ? hold[i - 1] : 0;

    // Average: if price moved beyond ATR band, snap to midpoint; else drift
    if (Math.abs(close - prevAvg) > atr) {
      avg[i] = (close + prevAvg) / 2;
    } else {
      avg[i] = prevAvg + prevOs * (prevHold / mult / slope);
    }

    // Direction
    os[i] = avg[i] > prevAvg ? 1 : avg[i] < prevAvg ? -1 : prevOs;

    // Hold: reset on direction change, otherwise carry forward
    hold[i] = os[i] !== prevOs ? atr : prevHold;

    // Bands
    upper[i] = avg[i] + width * hold[i];
    lower[i] = avg[i] - width * hold[i];
  }

  const warmup = 200;
  const bullCss = '#26A69A';
  const bearCss = '#EF5350';

  const plotUpper = upper.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : v }));
  const plotAvg = avg.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (i > 0 && os[i] !== os[i - 1]) ? NaN : v,
    color: os[i] === 1 ? bullCss : bearCss,
  }));
  const plotLower = lower.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : v }));

  // Pine (area = 'Gradient'): upper_topcol := upperCss, upper_btmcol := color.new(chart.bg_color, 100),
  //   lower_topcol := color.new(chart.bg_color, 100), lower_btmcol := lowerCss
  const upperCss = '#FF52524C'; // color.new(color.red, 70), v5 palette
  const lowerCss = '#00897B4C'; // color.new(color.teal, 70), v5 palette
  const bgTransparent = '#00000000'; // color.new(chart.bg_color, 100)
  // top_color = os != os[1] ? na : ..., bottom_color = os != os[1] ? na : ...
  const flip = (i: number) => i > 0 && os[i] !== os[i - 1];
  const colorWhen = (c: string) => os.map((_, i) => (flip(i) ? null : c));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'upper': plotUpper, 'avg': plotAvg, 'lower': plotLower },
    fills: [
      // fill(plot_upper, plot_avg, top_color, bottom_color, top_value = upper, bottom_value = avg)
      {
        plot1: 'upper', plot2: 'avg',
        gradient: { topValue: upper.slice(), bottomValue: avg.slice(), topColor: colorWhen(upperCss), bottomColor: colorWhen(bgTransparent) },
      },
      // fill(plot_avg, plot_lower, top_color, bottom_color, top_value = avg, bottom_value = lower)
      {
        plot1: 'avg', plot2: 'lower',
        gradient: { topValue: avg.slice(), bottomValue: lower.slice(), topColor: colorWhen(bgTransparent), bottomColor: colorWhen(lowerCss) },
      },
    ],
  };
}

export const HyperTrend = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
