/**
 * FVG Positioning Average
 *
 * Identifies Fair Value Gaps (bullish: low > high[2], bearish: high < low[2])
 * and computes weighted averages of recent FVG levels. ATR filter for minimum gap size.
 * Tracks arrays of bullish/bearish gaps within a lookback and plots their averages.
 *
 * Reference: "FVG Positioning Average [LuxAlgo]" by LuxAlgo
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BoxData } from '../types';

export interface FvgPositioningAverageInputs {
  lookback: number;
  lookbackType: string;
  atrMultiplier: number;
}

export const defaultInputs: FvgPositioningAverageInputs = {
  lookback: 30,
  lookbackType: 'Bar Count',
  atrMultiplier: 0.25,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'FVG Lookback', defval: 30, min: 1 },
  { id: 'lookbackType', type: 'string', title: 'Lookback Type', defval: 'Bar Count', options: ['Bar Count', 'FVG Count'] },
  { id: 'atrMultiplier', type: 'float', title: 'ATR Multiplier', defval: 0.25, min: 0, step: 0.25 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bull Average', color: '#089981', lineWidth: 2 },
  { id: 'plot1', title: 'Bear Average', color: '#f23645', lineWidth: 2 },
  { id: 'ul', title: 'Plot', color: 'transparent', lineWidth: 0, display: 'none' },
  { id: 'dl', title: 'Plot', color: 'transparent', lineWidth: 0, display: 'none' },
];

export const metadata = {
  title: 'FVG Positioning Average',
  shortTitle: 'FVG Pos Avg',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<FvgPositioningAverageInputs> = {}): Omit<IndicatorResult, 'markers'> & { boxes: BoxData[] } {
  const { lookback, lookbackType, atrMultiplier } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // ATR(200)
  const atrArr = ta.atr(bars, 200).toArray();

  // Highest(5) and Lowest(5) for display visibility
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);
  const hstArr = ta.highest(highSeries, 5).toArray();
  const lstArr = ta.lowest(lowSeries, 5).toArray();

  // Cumulative (high-low) for fallback ATR
  const cumHl: number[] = new Array(n);
  let cumSum = 0;
  for (let i = 0; i < n; i++) {
    cumSum += bars[i].high - bars[i].low;
    cumHl[i] = cumSum / (i + 1);
  }

  // Track FVG arrays: store { barIndex, value } for bullish (bottom of gap) and bearish (top of gap)
  const upFvgs: { barIdx: number; value: number }[] = [];
  const downFvgs: { barIdx: number; value: number }[] = [];

  const plot0: { time: number; value: number; color?: string }[] = [];
  const plot1: { time: number; value: number; color?: string }[] = [];

  const upAvgArr: number[] = new Array(n);
  const downAvgArr: number[] = new Array(n);
  const boxes: BoxData[] = [];

  for (let i = 0; i < n; i++) {
    // ATR with fallback
    const atr = !isNaN(atrArr[i]) && atrArr[i] !== 0 ? atrArr[i] * atrMultiplier : cumHl[i] * atrMultiplier;

    // FVG Detection (need at least 3 bars)
    if (i >= 2) {
      const low0 = bars[i].low;
      const high2 = bars[i - 2].high;
      const close1 = bars[i - 1].close;
      const high0 = bars[i].high;
      const low2 = bars[i - 2].low;

      // Bullish FVG: low > high[2] and close[1] > high[2] and gap > atr
      if (low0 > high2 && close1 > high2 && (low0 - high2) > atr) {
        upFvgs.push({ barIdx: i, value: high2 }); // bottom of gap = high[2]
        // Box: left=bar[2], top=current low, right=current bar, bottom=high[2]
        boxes.push({
          time1: bars[i - 2].time, price1: low0,
          time2: bars[i].time, price2: high2,
          bgColor: 'rgba(8,153,129,0.50)', borderColor: 'rgba(8,153,129,0.50)',
        });
      }

      // Bearish FVG: high < low[2] and close[1] < low[2] and gap > atr
      if (high0 < low2 && close1 < low2 && (low2 - high0) > atr) {
        downFvgs.push({ barIdx: i, value: high0 }); // top of gap = high[0]
        // Box: left=bar[2], top=low[2], right=current bar, bottom=current high
        boxes.push({
          time1: bars[i - 2].time, price1: low2,
          time2: bars[i].time, price2: high0,
          bgColor: 'rgba(242,54,69,0.50)', borderColor: 'rgba(242,54,69,0.50)',
        });
      }
    }

    // Array size management
    if (lookbackType === 'FVG Count') {
      while (upFvgs.length > lookback) upFvgs.shift();
      while (downFvgs.length > lookback) downFvgs.shift();
    } else {
      // Bar Count: remove FVGs older than lookback bars
      while (upFvgs.length > 0 && upFvgs[0].barIdx < i - lookback) upFvgs.shift();
      while (downFvgs.length > 0 && downFvgs[0].barIdx < i - lookback) downFvgs.shift();
    }

    // Compute averages
    let upAvg = NaN;
    if (upFvgs.length > 0) {
      let sum = 0;
      for (let j = 0; j < upFvgs.length; j++) sum += upFvgs[j].value;
      upAvg = sum / upFvgs.length;
    }

    let downAvg = NaN;
    if (downFvgs.length > 0) {
      let sum = 0;
      for (let j = 0; j < downFvgs.length; j++) sum += downFvgs[j].value;
      downAvg = sum / downFvgs.length;
    }

    // Pine: plot up_avg only if hst >= up_avg (transparent otherwise)
    const hst = hstArr[i] ?? bars[i].high;
    const lst = lstArr[i] ?? bars[i].low;

    const upVisible = !isNaN(upAvg) && hst >= upAvg;
    const downVisible = !isNaN(downAvg) && lst <= downAvg;

    plot0.push({
      time: bars[i].time,
      value: upAvg,
      color: upVisible ? '#089981' : 'transparent',
    });

    plot1.push({
      time: bars[i].time,
      value: downAvg,
      color: downVisible ? '#f23645' : 'transparent',
    });

    upAvgArr[i] = upAvg;
    downAvgArr[i] = downAvg;
  }

  // Pine: c_mid_h = math.max(math.avg(open,close),up_avg); c_mid_l = math.min(math.avg(open,close),down_avg)
  const cMidH = bars.map((b, i) => Math.max((b.open + b.close) / 2, upAvgArr[i]));
  const cMidL = bars.map((b, i) => Math.min((b.open + b.close) / 2, downAvgArr[i]));
  const upSma = ta.sma(Series.fromArray(bars, upAvgArr), 10).toArray();
  const downSma = ta.sma(Series.fromArray(bars, downAvgArr), 10).toArray();
  const invis = '#00000000'; // Pine: color.rgb(0,0,0,100); also color.new(chart.bg_color,100)
  const greenFill = color.new_color('#089981', 50) as string;
  const redFill = color.new_color('#f23645', 50) as string;

  // Pine: fill(ua, ul, c_mid_h, math.min(ta.sma(up_avg,10),up_avg), color.new(chart.bg_color,100),
  //   c_mid_h<=up_avg?invis:color.new(green,50))
  const upGradient = {
    topValue: cMidH.slice(),
    bottomValue: upAvgArr.map((v, i) => Math.min(upSma[i], v)),
    topColor: cMidH.map((): string | null => invis),
    bottomColor: cMidH.map((v, i): string | null => (v <= upAvgArr[i] ? invis : greenFill)),
  };
  // Pine: fill(da, dl, math.max(ta.sma(down_avg,10),down_avg), c_mid_l,
  //   c_mid_l>=down_avg?invis:color.new(red,50), color.new(chart.bg_color,100))
  const downGradient = {
    topValue: downAvgArr.map((v, i) => Math.max(downSma[i], v)),
    bottomValue: cMidL.slice(),
    topColor: cMidL.map((v, i): string | null => (v >= downAvgArr[i] ? invis : redFill)),
    bottomColor: cMidL.map((): string | null => invis),
  };

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'plot0': plot0,
      'plot1': plot1,
      // Pine: ul = plot(c_mid_h,display = display.none, editable = false)
      'ul': cMidH.map((v, i) => ({ time: bars[i].time, value: v })),
      // Pine: dl = plot(c_mid_l,display = display.none, editable = false)
      'dl': cMidL.map((v, i) => ({ time: bars[i].time, value: v })),
    },
    fills: [
      { plot1: 'plot0', plot2: 'ul', gradient: upGradient },
      { plot1: 'plot1', plot2: 'dl', gradient: downGradient },
    ],
    boxes,
  };
}

export const FvgPositioningAverage = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
