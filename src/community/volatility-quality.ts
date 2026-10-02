/**
 * Volatility Quality [Alpha Extract]
 *
 * Volatility quality index: the true range signed by the candle direction (+1 up, -1 down, 0 doji), smoothed by an
 * EMA of `vqiLen` and an EMA of `vqiSmoothingLen`. Standard deviation bands (1, 2, 3 x the stdev of the smoothed
 * line over `vqiLen`) are drawn around it. The line and the bands are normalised to -100..100 with the highest and
 * the lowest smoothed value over `normalizationLength` bars (when that range is positive). The line is lime at or
 * above 0, red below. Optional candles on the price pane coloured by the sign; overbought / oversold characters when
 * the normalised 3-stdev band reaches +200 / -200.
 *
 * Reference: "Volatility Quality [Alpha Extract]" by AlphaExtract
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';

export interface VolatilityQualityInputs {
  vqiLen: number;
  vqiSmoothingLen: number;
  stdevMultiplier1: number;
  stdevMultiplier2: number;
  stdevMultiplier3: number;
  normalizationLength: number;
  /** Histogram style for the main line (the plot style of the configuration stays a line) */
  displayAsColumns: boolean;
  showCandles: boolean;
}

export const defaultInputs: VolatilityQualityInputs = {
  vqiLen: 14,
  vqiSmoothingLen: 5,
  stdevMultiplier1: 1.0,
  stdevMultiplier2: 2.0,
  stdevMultiplier3: 3.0,
  normalizationLength: 200,
  displayAsColumns: false,
  showCandles: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'vqiLen', type: 'int', title: 'VQI Length', defval: 14 },
  { id: 'vqiSmoothingLen', type: 'int', title: 'VQI Smoothing Length', defval: 5 },
  { id: 'stdevMultiplier1', type: 'float', title: 'Stdev Multiplier #1', defval: 1.0 },
  { id: 'stdevMultiplier2', type: 'float', title: 'Stdev Multiplier #2', defval: 2.0 },
  { id: 'stdevMultiplier3', type: 'float', title: 'Stdev Multiplier #3', defval: 3.0 },
  { id: 'normalizationLength', type: 'int', title: 'Normalization Lookback', defval: 200, min: 50 },
  { id: 'displayAsColumns', type: 'bool', title: 'Display as Columns?', defval: false },
  { id: 'showCandles', type: 'bool', title: 'Show Candles', defval: false },
];

const UP_COL = color.lime;
const DOWN_COL = String(color.rgb(255, 0, 0));
const U1 = String(color.new(color.teal, 0));
const U2 = String(color.new(color.teal, 30));
const U3 = String(color.new(color.teal, 60));
const L1 = String(color.new('#ffffff', 0));
const L2 = String(color.new('#a8a8a8', 30));
const L3 = String(color.new('#353434', 35));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'AVQ', color: UP_COL, lineWidth: 2 },
  { id: 'plot1', title: 'Upper 1 stdev', color: U1, lineWidth: 1 },
  { id: 'plot2', title: 'Upper 2 stdev', color: U2, lineWidth: 1 },
  { id: 'plot3', title: 'Upper 3 stdev', color: U3, lineWidth: 1 },
  { id: 'plot4', title: 'Lower 1 stdev', color: L1, lineWidth: 1 },
  { id: 'plot5', title: 'Lower 2 stdev', color: L2, lineWidth: 1 },
  { id: 'plot6', title: 'Lower 3 stdev', color: L3, lineWidth: 1 },
];

export const metadata = {
  title: 'Volatility Quality [Alpha Extract]',
  shortTitle: 'Volatility Quality [Alpha Extract]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

export function calculate(
  bars: Bar[],
  inputs: Partial<VolatilityQualityInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const normalizeVQI = true;

  // barRange = ta.tr(false); direction = close > open ? 1 : close < open ? -1 : 0
  const barRange = A(ta.tr(bars, false));
  const weightedVol = bars.map((b, i) => barRange[i] * (gt(b.close, b.open) ? 1 : gt(b.open, b.close) ? -1 : 0));
  const vqiRaw = A(ta.ema(S(weightedVol), cfg.vqiLen));
  const vqiSmoothed = A(ta.ema(S(vqiRaw), cfg.vqiSmoothingLen));
  const vqiStdev = A(ta.stdev(S(vqiSmoothed), cfg.vqiLen));
  // `if normalizeVQI` is always true: ta.highest / ta.lowest run on every bar
  const vqiHighest = A(ta.highest(S(vqiSmoothed), cfg.normalizationLength));
  const vqiLowest = A(ta.lowest(S(vqiSmoothed), cfg.normalizationLength));

  const norm = new Array<number>(n);
  const bands = [1, 2, 3, 4, 5, 6].map(() => new Array<number>(n));
  const mults = [cfg.stdevMultiplier1, cfg.stdevMultiplier2, cfg.stdevMultiplier3];
  for (let i = 0; i < n; i++) {
    const sm = vqiSmoothed[i];
    const raw = [
      sm + vqiStdev[i] * mults[0], sm + vqiStdev[i] * mults[1], sm + vqiStdev[i] * mults[2],
      sm - vqiStdev[i] * mults[0], sm - vqiStdev[i] * mults[1], sm - vqiStdev[i] * mults[2],
    ];
    const range = vqiHighest[i] - vqiLowest[i];
    // if vqiRange > 0: ((x - vqiLowest) / vqiRange - 0.5) * 200
    const doNorm = normalizeVQI && gt(range, 0);
    const f = (x: number) => (doNorm ? ((x - vqiLowest[i]) / range - 0.5) * 200 : x);
    norm[i] = f(sm);
    for (let k = 0; k < 6; k++) bands[k][i] = f(raw[k]);
  }

  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const line = (arr: number[], col: string) => bars.map((b, i) => ({ time: b.time, value: fin(arr[i]), color: col }));

  const markers: MarkerData[] = [];
  const candles: PlotCandleData[] = [];
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    if (cfg.showCandles) {
      // candle_col = vqiPositive ? color.lime : color.red (vqiNormalized >= 0)
      const c = ge(norm[i], 0) ? color.lime : color.red;
      candles.push({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, color: c, wickColor: c,
        borderColor: c, forceOverlay: true });
    }
    // plotchar(overboughtSignal ? high : na, '⌄', location.abovebar, color.red, size.tiny, force_overlay = true)
    if (normalizeVQI && ge(bands[2][i], 200)) {
      markers.push({ time: b.time, position: 'aboveBar', shape: 'circle', color: 'transparent', text: '⌄',
        textColor: color.red, size: 'tiny', forceOverlay: true });
    }
    // plotchar(oversoldSignal ? low : na, '⌃', location.belowbar, color.lime, size.tiny, force_overlay = true)
    if (normalizeVQI && le(bands[5][i], -200)) {
      markers.push({ time: b.time, position: 'belowBar', shape: 'circle', color: 'transparent', text: '⌃',
        textColor: color.lime, size: 'tiny', forceOverlay: true });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      // plot(vqiNormalized, color = vqiNormalized >= 0 ? color.lime : color.rgb(255, 0, 0), linewidth = 2)
      plot0: bars.map((b, i) => ({ time: b.time, value: fin(norm[i]), color: ge(norm[i], 0) ? UP_COL : DOWN_COL })),
      plot1: line(bands[0], U1),
      plot2: line(bands[1], U2),
      plot3: line(bands[2], U3),
      plot4: line(bands[3], L1),
      plot5: line(bands[4], L2),
      plot6: line(bands[5], L3),
    },
    hlines: [
      { value: 0, options: { title: 'Zero Line', color: color.gray, linestyle: 'dashed' } },
      { value: 100, options: { title: '+100', color: String(color.new(color.white, 70)), linestyle: 'dotted' } },
      { value: -100, options: { title: '-100', color: String(color.new(color.white, 70)), linestyle: 'dotted' } },
    ],
    markers,
    plotCandles: { vqiCandles: candles },
  };
}

export const VolatilityQuality = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
