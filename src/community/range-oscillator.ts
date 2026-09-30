/**
 * Range Oscillator (Zeiierman)
 *
 * A moving average of the close weighted by the relative bar-to-bar change over `length` bars; the oscillator is
 * 100 * (close - ma) / (ATR * multiplier), with ATR(2000) (ATR(200) while ATR(2000) is na). The trend is the side of
 * the close to the ma. The oscillator colour comes from a heat map: its last 100 values are split in `levels` levels
 * between their lowest and highest value, each level coloured by its touch count (gradient from the weak trend colour
 * at transparency 80 - count to the weak trend colour), and the level nearest to the oscillator gives the colour.
 * The transition colour is used on a trend flip or without a heat colour; strong colours when the close leaves
 * the range (ma +/- ATR * multiplier). Gradient fills between the oscillator and zero.
 *
 * Reference: "Range Oscillator (Zeiierman)" by Zeiierman
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface RangeOscillatorInputs {
  /** Minimum range length */
  length: number;
  /** Range width multiplier */
  mult: number;
  /** Number of heat levels (2..100) */
  levels: number;
  /** Minimum touches per level */
  heatThresh: number;
  strongBullish: string;
  strongBearish: string;
  weakBearish: string;
  weakBullish: string;
  /** Transition colour */
  transitionZone: string;
}

export const defaultInputs: RangeOscillatorInputs = {
  length: 50,
  mult: 2.0,
  levels: 2,
  heatThresh: 1,
  strongBullish: '#09ff00',
  strongBearish: '#FF0000',
  weakBearish: color.maroon,
  weakBullish: color.green,
  transitionZone: color.blue,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Minimum Range Length', defval: 50, min: 1, step: 1 },
  { id: 'mult', type: 'float', title: 'Range Width Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'levels', type: 'int', title: 'Number of Heat Levels', defval: 2, min: 2, max: 100 },
  { id: 'heatThresh', type: 'int', title: 'Minimum Touches per Level', defval: 1, min: 1 },
  { id: 'strongBullish', type: 'color', title: 'Strong Bullish Color', defval: '#09ff00' },
  { id: 'strongBearish', type: 'color', title: 'Strong Bearish Color', defval: '#FF0000' },
  { id: 'weakBearish', type: 'color', title: 'Weak Bearish Color', defval: color.maroon },
  { id: 'weakBullish', type: 'color', title: 'Weak Bullish Color', defval: color.green },
  { id: 'transitionZone', type: 'color', title: 'Transition Color', defval: color.blue },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Range Oscillator', color: color.blue, lineWidth: 2 },
  { id: 'plot1', title: 'Zero', color: 'transparent', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Range Oscillator (Zeiierman)',
  shortTitle: 'Range Oscillator',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<RangeOscillatorInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, mult, levels, heatThresh } = cfg;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const close = bars.map((b) => b.close);

  // atrRaw = nz(ta.atr(2000), ta.atr(200)); rangeATR = atrRaw * mult
  const atr2000 = A(ta.atr(bars, 2000));
  const atr200 = A(ta.atr(bars, 200));
  const rangeATR = atr2000.map((v, i) => (isNaN(v) ? atr200[i] : v) * mult);

  const ma: number[] = new Array(n);
  const osc: number[] = new Array(n);
  const trendDir: number[] = new Array(n);
  let dir = 0; // var int trendDir = 0
  for (let i = 0; i < n; i++) {
    // weights: w = |close[k] - close[k + 1]| / close[k + 1], k = 0..length - 1 (na when a close is before bar 0)
    let sumWC = 0;
    let sumW = 0;
    for (let k = 0; k < length; k++) {
      const c0 = i - k >= 0 ? close[i - k] : NaN;
      const c1 = i - k - 1 >= 0 ? close[i - k - 1] : NaN;
      const w = Math.abs(c0 - c1) / c1;
      sumWC += c0 * w;
      sumW += w;
    }
    // ma = sumWeights != 0 ? sumWeightedClose / sumWeights : na (na != 0 is false)
    ma[i] = !isNaN(sumW) && sumW !== 0 ? sumWC / sumW : NaN;
    // trendDir := close > ma ? 1 : close < ma ? -1 : nz(trendDir[1])
    dir = close[i] > ma[i] ? 1 : close[i] < ma[i] ? -1 : dir;
    trendDir[i] = dir;
    // osc = rangeATR != 0 ? 100 * (close - ma) / rangeATR : na
    osc[i] = !isNaN(rangeATR[i]) && rangeATR[i] !== 0 ? (100 * (close[i] - ma[i])) / rangeATR[i] : NaN;
  }

  // getHeatColor(osc, trendDir, ..., high_ser = osc, low_ser = osc, pointMode = true)
  const oscSeries = Series.fromArray(bars, osc);
  const hi = A(ta.highest(oscSeries, 100));
  const lo = A(ta.lowest(oscSeries, 100));
  const heatColor = (i: number): string | null => {
    const rng = hi[i] - lo[i];
    const step = rng > 0 ? rng / levels : NaN;
    if (isNaN(step) || step === 0) return null;
    const weak = trendDir[i] === 1 ? cfg.weakBullish : cfg.weakBearish;
    let minD = 1e10;
    let best: string | null = null;
    for (let l = 0; l < levels; l++) {
      const lvl = lo[i] + step * (l + 0.5);
      // touches: osc[j] in [lvl - step / 2, lvl + step / 2) over the last 100 bars (na never touches);
      // Pine float comparisons: a < b only when b - a > 1e-10, a >= b otherwise
      let cnt = 0;
      for (let j = 0; j < 100; j++) {
        const v = i - j >= 0 ? osc[i - j] : NaN;
        if (!(lvl - step / 2 - v > 1e-10) && lvl + step / 2 - v > 1e-10) cnt++;
      }
      // color.from_gradient(cnt, heatThresh, heatThresh + 10, color.new(cold, 80 - cnt), hot)
      const col = String(color.from_gradient(cnt, heatThresh, heatThresh + 10, color.new(weak, 80 - cnt), weak));
      const d = Math.abs(osc[i] - lvl);
      if (d < minD) {
        minD = d;
        best = col;
      }
    }
    return best;
  };

  const oscPlot: { time: number; value: number; color: string }[] = [];
  const oscColors: (string | null)[] = [];
  for (let i = 0; i < n; i++) {
    const heat = heatColor(i);
    // noColorOnFlip = trendDir != trendDir[1]
    const flip = i > 0 && trendDir[i] !== trendDir[i - 1];
    let oscColor = heat === null || flip ? cfg.transitionZone : heat;
    // breakUp = close > ma + rangeATR; breakDn = close < ma - rangeATR
    if (close[i] > ma[i] + rangeATR[i]) oscColor = cfg.strongBullish;
    else if (close[i] < ma[i] - rangeATR[i]) oscColor = cfg.strongBearish;
    oscPlot.push({ time: bars[i].time, value: osc[i], color: oscColor });
    oscColors.push(oscColor);
  }

  const none = new Array<string | null>(n).fill(null);
  const zeros = new Array<number>(n).fill(0);
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: oscPlot,
      plot1: bars.map((b) => ({ time: b.time, value: 0 })),
    },
    hlines: [
      { value: 100, options: { title: 'Upper Bound', color: color.gray, linestyle: 'dotted' } },
      { value: 0, options: { title: 'Zero', color: color.gray, linestyle: 'dotted' } },
      { value: -100, options: { title: 'Lower Bound', color: color.gray, linestyle: 'dotted' } },
    ],
    fills: [
      // fill(osc_, zero_, ta.highest(osc, 100), 0, oscColor, color(na))
      { plot1: 'plot0', plot2: 'plot1', gradient: { topValue: hi, bottomValue: zeros, topColor: oscColors, bottomColor: none } },
      // fill(osc_, zero_, 0, ta.lowest(osc, 100), color(na), oscColor)
      { plot1: 'plot0', plot2: 'plot1', gradient: { topValue: zeros, bottomValue: lo, topColor: none, bottomColor: oscColors } },
    ],
  };
}

export const RangeOscillator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
