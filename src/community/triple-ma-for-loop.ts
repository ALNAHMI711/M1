/**
 * Triple MA For Loop
 *
 * Triple moving average of the source: TMA = 3 * (ma1 - ma2) + ma3, with ma2 the MA of ma1 and ma3 the MA of ma2
 * (one MA type and length). The score sums +1 / -1 for i = Loop Start to Loop End: +1 when the source is above the
 * TMA i bars ago, else -1. The trend colour turns bull when the score is above the uptrend threshold and bear when it
 * is below the downtrend threshold (it keeps its last value in between). The score line, an SMA(14) of the close
 * and its value 2 bars ago (with a fill between them, on the price pane) and optionally the candles take the trend
 * colour. Labels on the price pane mark the changes to the up / down state of the score (7.5 % below / above the
 * SMA).
 *
 * Reference: "Triple MA For Loop [SeerQuant]" by SeerQuant
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © SeerQuant
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

export type TripleMaForLoopMaType = 'SMA' | 'EMA' | 'SMMA' | 'WMA' | 'VWMA' | 'LSMA' | 'HMA' | 'ALMA';
export type TripleMaForLoopColorScheme = 'Default' | 'Modern' | 'Cool' | 'Alternate' | 'Bright';

export interface TripleMaForLoopInputs {
  /** MA length */
  maLen: number;
  /** MA source */
  src: SourceType;
  /** MA type */
  maType: TripleMaForLoopMaType;
  /** Loop start */
  sl: number;
  /** Loop end */
  el: number;
  /** Threshold uptrend */
  thrUp: number;
  /** Threshold downtrend */
  thrDown: number;
  /** Colour the candles */
  paint: boolean;
  colScheme: TripleMaForLoopColorScheme;
}

export const defaultInputs: TripleMaForLoopInputs = {
  maLen: 45,
  src: 'close',
  maType: 'EMA',
  sl: 5,
  el: 55,
  thrUp: 45,
  thrDown: 0,
  paint: false,
  colScheme: 'Default',
};

export const inputConfig: InputConfig[] = [
  { id: 'maLen', type: 'int', title: 'MA Length', defval: 45 },
  { id: 'src', type: 'source', title: 'MA Source', defval: 'close' },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA', options: ['SMA', 'EMA', 'SMMA', 'WMA', 'VWMA', 'LSMA', 'HMA', 'ALMA'] },
  { id: 'sl', type: 'int', title: 'Loop Start', defval: 5 },
  { id: 'el', type: 'int', title: 'Loop End', defval: 55 },
  { id: 'thrUp', type: 'float', title: 'Threshold Uptrend', defval: 45 },
  { id: 'thrDown', type: 'float', title: 'Threshold Downtrend', defval: 0 },
  { id: 'paint', type: 'bool', title: 'Colour Candles?', defval: false },
  { id: 'colScheme', type: 'string', title: 'Color Scheme', defval: 'Default', options: ['Default', 'Modern', 'Cool', 'Alternate', 'Bright'] },
];

/** [bull, bear] per colour scheme (the Pine neutral colour is not used) */
const SCHEMES: Record<TripleMaForLoopColorScheme, [string, string]> = {
  Default: ['#00ff73', '#ff0040'],
  Modern: ['#23d7e4', '#e11179'],
  Cool: ['#00ffcc', '#1600db'],
  Alternate: ['#00ff80', '#ff6600'],
  Bright: ['#e8ec00', '#f200fa'],
};

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'FL Histogram', color: '#00ff73', lineWidth: 3 },
  { id: 'plot1', title: 'Threshold Uptrend', color: String(color.new('#00ff73', 50)), lineWidth: 2 },
  { id: 'plot2', title: 'Threshold Downtrend', color: String(color.new('#ff0040', 50)), lineWidth: 2 },
  // Pine force_overlay = true: the two SMA plots (and so their fill) are drawn on the price pane
  { id: 'plot3', title: 'SMA', color: '#00ff73', lineWidth: 2, forceOverlay: true },
  { id: 'plot4', title: 'SMA [2]', color: '#00ff73', lineWidth: 2, forceOverlay: true },
];

export const metadata = {
  title: 'Triple MA For Loop [SeerQuant]',
  shortTitle: 'TMA FL',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;

export function calculate(
  bars: Bar[],
  inputs: Partial<TripleMaForLoopInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const [bull, bear] = SCHEMES[cfg.colScheme] ?? SCHEMES.Default;
  const volume = S(bars.map((b) => b.volume ?? NaN));

  // ma(source, length, type)
  const ma = (source: number[], length: number): number[] => {
    const s = S(source);
    switch (cfg.maType) {
      case 'SMA': return A(ta.sma(s, length));
      case 'SMMA': return A(ta.rma(s, length));
      case 'WMA': return A(ta.wma(s, length));
      case 'VWMA': return A(ta.vwma(s, length, volume));
      case 'LSMA': return A(ta.linreg(s, length, 0));
      case 'HMA': {
        const wma1 = A(ta.wma(s, Math.floor(length / 2)));
        const wma2 = A(ta.wma(s, length));
        return A(ta.wma(S(wma1.map((v, i) => 2 * v - wma2[i])), Math.floor(Math.sqrt(length))));
      }
      case 'ALMA': return A(ta.alma(s, length, 0.85, 6));
      case 'EMA':
      default: return A(ta.ema(s, length));
    }
  };

  const src = A(getSourceSeries(bars, cfg.src));
  const ma1 = ma(src, cfg.maLen);
  const ma2 = ma(ma1, cfg.maLen);
  const ma3 = ma(ma2, cfg.maLen);
  const tma = ma1.map((v, i) => 3 * (v - ma2[i]) + ma3[i]);
  const sma = A(ta.sma(S(bars.map((b) => b.close)), 14));

  const fl: number[] = new Array(n);
  const col: (string | null)[] = new Array(n);
  const markers: MarkerData[] = [];
  let c: string | null = null; // var color col = na
  let prevTrendState = 0; // var int prevTrendState = 0
  for (let b = 0; b < n; b++) {
    // fl(s, e, val): sum of (src > val[i] ? 1 : -1) for i = s to e (val[i] before bar 0 is na: -1)
    let sum = 0;
    const step = cfg.sl <= cfg.el ? 1 : -1;
    for (let i = cfg.sl; step > 0 ? i <= cfg.el : i >= cfg.el; i += step) {
      const past = b - i >= 0 && b - i < n ? tma[b - i] : NaN;
      sum += gt(src[b], past) ? 1 : -1;
    }
    fl[b] = sum;

    if (gt(sum, cfg.thrUp)) c = bull;
    if (lt(sum, cfg.thrDown)) c = bear;
    col[b] = c;

    const current = gt(sum, cfg.thrUp) ? 1 : lt(sum, cfg.thrDown) ? -1 : 0;
    const bullishTransition = prevTrendState !== 1 && current === 1;
    const bearishTransition = prevTrendState !== -1 && current === -1;
    if (bullishTransition || bearishTransition) prevTrendState = current;

    const t = bars[b].time;
    // plotshape(bullishTransition ? sma - sma * 0.075 : na, shape.labelup, location.absolute, color = bull,
    //   text = "▲", textcolor = #000000, size.small, force_overlay = true)
    const lo = sma[b] - sma[b] * 0.075;
    if (bullishTransition && !isNaN(lo)) {
      markers.push({ time: t, position: 'atPriceBottom', price: lo, shape: 'labelUp', color: bull, text: '▲',
        textColor: '#000000', size: 'small', forceOverlay: true });
    }
    // plotshape(bearishTransition ? sma + sma * 0.075 : na, shape.labeldown, ..., color = bear, text = "▼")
    const hi = sma[b] + sma[b] * 0.075;
    if (bearishTransition && !isNaN(hi)) {
      markers.push({ time: t, position: 'atPriceTop', price: hi, shape: 'labelDown', color: bear, text: '▼',
        textColor: '#000000', size: 'small', forceOverlay: true });
    }
  }

  const upCol = String(color.new(bull, 50));
  const downCol = String(color.new(bear, 50));
  const lineCol = (i: number) => col[i] ?? 'transparent';
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      // plot(fl, color = col, linewidth = 3, title = "FL Histogram")
      plot0: bars.map((b, i) => ({ time: b.time, value: fl[i], color: lineCol(i) })),
      plot1: bars.map((b) => ({ time: b.time, value: cfg.thrUp, color: upCol })),
      plot2: bars.map((b) => ({ time: b.time, value: cfg.thrDown, color: downCol })),
      // a = plot(sma, color = col, linewidth = 2, force_overlay = true)
      plot3: bars.map((b, i) => ({ time: b.time, value: sma[i], color: lineCol(i) })),
      // b = plot(sma[2], color = col, linewidth = 2, force_overlay = true)
      plot4: bars.map((b, i) => ({ time: b.time, value: i >= 2 ? sma[i - 2] : NaN, color: lineCol(i) })),
    },
    // fill(a, b, color.new(col, 70)): color.new(na, 70) is black with transparency 70
    fills: [{ plot1: 'plot3', plot2: 'plot4', colors: col.map((x) => String(color.new(x as string, 70))) }],
    markers,
    // barcolor(paint ? col : na): no bar colour while col is na
    barColors: cfg.paint
      ? bars.flatMap((b, i) => (col[i] === null ? [] : [{ time: b.time, color: col[i] as string }]))
      : [],
  };
}

export const TripleMaForLoop = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
