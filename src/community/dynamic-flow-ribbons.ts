/**
 * Dynamic Flow Ribbons
 *
 * Supertrend-like bands around EMA(15) of hlc3: EMA +/- factor * SMA(high - low, 200). The lower band only rises
 * and the upper band only falls, unless the previous source crossed them. The trend is up (direction -1) when the
 * source closes above the upper band and down (direction 1) when it closes below the lower band. The trend line is
 * the average of both bands (a thick line and a wide glow). Five ribbon lines around the active band (band +/- 0.5
 * and 1 SMA range) fade from the band outwards; the lines of the other band are fully transparent. The candles are
 * redrawn in the trend colour at transparency 50.
 *
 * Reference: "Dynamic Flow Ribbons [BigBeluga]" by BigBeluga
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';

export interface DynamicFlowRibbonsInputs {
  /** Band width in SMA(high - low, 200) units (Pine title "Length") */
  factor: number;
  /** Uptrend colour */
  colUp: string;
  /** Downtrend colour */
  colDn: string;
}

export const defaultInputs: DynamicFlowRibbonsInputs = {
  factor: 3,
  colUp: '#1ADD7F',
  colDn: '#E79314',
};

export const inputConfig: InputConfig[] = [
  { id: 'factor', type: 'float', title: 'Length', defval: 3, step: 0.01 },
  { id: 'colUp', type: 'color', title: 'Up Color', defval: '#1ADD7F' },
  { id: 'colDn', type: 'color', title: 'Down Color', defval: '#E79314' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'TrendLine', color: '#1add7f', lineWidth: 4 },
  { id: 'plot1', title: 'TrendLine Glow', color: '#1add7f', lineWidth: 10 },
  { id: 'plot2', title: 'LowerBand1', color: '#1add7f', lineWidth: 1 },
  { id: 'plot3', title: 'LowerBand2', color: '#1add7f', lineWidth: 1 },
  { id: 'plot4', title: 'LowerBand3', color: '#1add7f', lineWidth: 1 },
  { id: 'plot5', title: 'LowerBand4', color: '#1add7f', lineWidth: 1 },
  { id: 'plot6', title: 'LowerBand5', color: '#1add7f', lineWidth: 1 },
  { id: 'plot7', title: 'UpperBand5', color: '#e79314', lineWidth: 1 },
  { id: 'plot8', title: 'UpperBand4', color: '#e79314', lineWidth: 1 },
  { id: 'plot9', title: 'UpperBand3', color: '#e79314', lineWidth: 1 },
  { id: 'plot10', title: 'UpperBand2', color: '#e79314', lineWidth: 1 },
  { id: 'plot11', title: 'UpperBand1', color: '#e79314', lineWidth: 1 },
];

export const metadata = {
  title: 'Dynamic Flow Ribbons',
  shortTitle: 'Dynamic Flow Ribbons',
  overlay: true,
};

/** Pine float comparison: a > b only when a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;
/** Pine a == b: |a - b| <= 1e-10 (false with na) */
const eq = (a: number, b: number) => Math.abs(a - b) <= 1e-10;
const nz = (v: number) => (isNaN(v) ? 0 : v);

export function calculate(
  bars: Bar[],
  inputs: Partial<DynamicFlowRibbonsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const { factor, colUp, colDn } = cfg;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  // dist = ta.sma(high - low, 200); src = hlc3; basis = ta.ema(src, 15)
  const dist = A(ta.sma(S(bars.map((b) => b.high - b.low)), 200));
  const src = bars.map((b) => (b.high + b.low + b.close) / 3);
  const basis = A(ta.ema(S(src), 15));

  const lower: number[] = new Array(n);
  const upper: number[] = new Array(n);
  const direction: number[] = new Array(n);
  let prevTrendLine = NaN;
  for (let i = 0; i < n; i++) {
    let lowerBand = basis[i] - factor * dist[i];
    let upperBand = basis[i] + factor * dist[i];
    const prevLowerBand = nz(i > 0 ? lower[i - 1] : NaN);
    const prevUpperBand = nz(i > 0 ? upper[i - 1] : NaN);
    const prevSrc = i > 0 ? src[i - 1] : NaN;
    // lowerBand := lowerBand > prevLowerBand or src[1] < prevLowerBand ? lowerBand : prevLowerBand
    lowerBand = gt(lowerBand, prevLowerBand) || gt(prevLowerBand, prevSrc) ? lowerBand : prevLowerBand;
    // upperBand := upperBand < prevUpperBand or src[1] > prevUpperBand ? upperBand : prevUpperBand
    upperBand = gt(prevUpperBand, upperBand) || gt(prevSrc, prevUpperBand) ? upperBand : prevUpperBand;
    let dir: number;
    if (i === 0 || isNaN(dist[i - 1])) dir = 1;
    else if (eq(prevTrendLine, prevUpperBand)) dir = gt(src[i], upperBand) ? -1 : 1;
    else dir = gt(lowerBand, src[i]) ? 1 : -1;
    // trend_line := _direction == -1 ? lowerBand : upperBand
    prevTrendLine = dir === -1 ? lowerBand : upperBand;
    lower[i] = lowerBand;
    upper[i] = upperBand;
    direction[i] = dir;
  }

  const c = (col: string, transp: number) => String(color.new(col, transp));
  type Point = { time: number; value: number; color: string };
  const plots: Point[][] = Array.from({ length: 12 }, () => []);
  const candles: PlotCandleData[] = [];
  // ribbon lines: [plot index, band, dist multiplier, transparency when active]
  const ribbons: [number, 'lower' | 'upper', number, number][] = [
    [2, 'lower', 1, 80], [3, 'lower', 0.5, 60], [4, 'lower', 0, 40], [5, 'lower', -0.5, 20], [6, 'lower', -1, 0],
    [7, 'upper', 1, 0], [8, 'upper', 0.5, 20], [9, 'upper', 0, 40], [10, 'upper', -0.5, 60], [11, 'upper', -1, 80],
  ];
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const t = b.time;
    const dir = direction[i];
    // t_col = _direction == 1 ? col_dn : col_up; line_ = math.avg(lowerBand, upperBand)
    const tCol = dir === 1 ? colDn : colUp;
    const line = (lower[i] + upper[i]) / 2;
    plots[0].push({ time: t, value: line, color: c(tCol, 0) });
    plots[1].push({ time: t, value: line, color: c(tCol, 80) });
    for (const [k, band, mult, transp] of ribbons) {
      const active = band === 'lower' ? dir === -1 : dir === 1;
      const base = band === 'lower' ? lower[i] : upper[i];
      plots[k].push({ time: t, value: mult === 0 ? base : base + dist[i] * mult, color: c(tCol, active ? transp : 100) });
    }
    // plotcandle(open, high, low, close, color / wickcolor / bordercolor = color.new(t_col, 50))
    const candleCol = c(tCol, 50);
    candles.push({ time: t, open: b.open, high: b.high, low: b.low, close: b.close, color: candleCol, wickColor: candleCol, borderColor: candleCol });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: Object.fromEntries(plots.map((p, k) => [`plot${k}`, p])),
    plotCandles: { candleStickColoring: candles },
  };
}

export const DynamicFlowRibbons = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
