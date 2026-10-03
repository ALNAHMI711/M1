/**
 * MACD-V with Volatility Normalisation
 *
 * MACD line normalised by volatility: MACD-V = (EMA(src, fast) - EMA(src, slow)) / ATR(atrLength) * 100, with an EMA
 * signal line and a histogram of 2 * (MACD-V - signal). Circles mark the crosses of MACD-V over (green) and under
 * (red) the signal line. The background is green when MACD-V is above zero, red otherwise. Histogram columns use four
 * colours: above zero growing / falling, below zero growing / falling (compared with the previous histogram value,
 * na read as 0). Horizontal lines every 50 from -250 to 250.
 *
 * Reference: "MACD-V with Volatility Normalisation [DCD]" by DutchCryptoDad
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © DutchCryptoDad
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BgColorData } from '../types';

export interface MacdVWithVolatilityNormalisationInputs {
  /** MACD fast EMA length */
  fastLength: number;
  /** MACD slow EMA length */
  slowLength: number;
  /** Price source */
  source: SourceType;
  /** Signal line EMA length */
  signalLength: number;
  /** ATR length */
  atrLength: number;
  macdColor: string;
  signalColor: string;
  colGrowAbove: string;
  colFallAbove: string;
  colGrowBelow: string;
  colFallBelow: string;
}

export const defaultInputs: MacdVWithVolatilityNormalisationInputs = {
  fastLength: 12,
  slowLength: 26,
  source: 'close',
  signalLength: 9,
  atrLength: 26,
  macdColor: '#2962FF',
  signalColor: '#FF6D00',
  colGrowAbove: '#26A69A',
  colFallAbove: '#B2DFDB',
  colGrowBelow: '#FFCDD2',
  colFallBelow: '#FF5252',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'MACD Fast Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'MACD Slow Length', defval: 26, min: 1 },
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'signalLength', type: 'int', title: 'Signal Line Smoothing Length', defval: 9, min: 1 },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 26, min: 1 },
  { id: 'macdColor', type: 'color', title: 'MACD Line', defval: '#2962FF' },
  { id: 'signalColor', type: 'color', title: 'Signal Line', defval: '#FF6D00' },
  { id: 'colGrowAbove', type: 'color', title: 'Above Grow', defval: '#26A69A' },
  { id: 'colFallAbove', type: 'color', title: 'Fall', defval: '#B2DFDB' },
  { id: 'colGrowBelow', type: 'color', title: 'Below Grow', defval: '#FFCDD2' },
  { id: 'colFallBelow', type: 'color', title: 'Fall', defval: '#FF5252' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Crossover', color: color.green, lineWidth: 2, style: 'circles' },
  { id: 'plot1', title: 'Crossdown', color: color.red, lineWidth: 2, style: 'circles' },
  { id: 'plot2', title: 'MACD Line', color: '#2962FF', lineWidth: 1 },
  { id: 'plot3', title: 'Signal Line', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot4', title: 'Histogram', color: '#26A69A', lineWidth: 1, style: 'columns' },
];

const LEVEL_COL = String(color.new(color.gray, 60));
const ZERO_COL = String(color.new(color.gray, 40));
const LEVELS = [250, 200, 150, 100, 50, 0, -50, -100, -150, -200, -250];

export const hlineConfig: HLineConfig[] = LEVELS.map((v, k) => ({
  id: `hline${k}`,
  price: v,
  title: String(v),
  color: v === 0 ? ZERO_COL : LEVEL_COL,
  linestyle: v === 0 ? 'solid' : 'dotted',
}));

export const metadata = {
  title: 'MACD-V with Volatility Normalisation [DCD]',
  shortTitle: 'MACD-V',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

export function calculate(
  bars: Bar[],
  inputs: Partial<MacdVWithVolatilityNormalisationInputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const src = getSourceSeries(bars, cfg.source);

  // macd = ((ta.ema(source, fast_len) - ta.ema(source, slow_len)) / ta.atr(atr_len)) * 100
  // A plain division: x / 0 is +-infinity (0 / 0 NaN); ta.ema skips an infinite value, comparisons and crosses use it
  const fastEma = A(ta.ema(src, cfg.fastLength));
  const slowEma = A(ta.ema(src, cfg.slowLength));
  const atr = A(ta.atr(bars, cfg.atrLength));
  const macd = fastEma.map((f, i) => ((f - slowEma[i]) / atr[i]) * 100);
  const signal = A(ta.ema(S(macd), cfg.signalLength));
  const hist = macd.map((m, i) => (m - signal[i]) * 2);
  const crossover = A(ta.crossover(S(macd), S(signal)));
  const crossdown = A(ta.crossunder(S(macd), S(signal)));

  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  /** Pine nz(): na and +-infinity give 0 */
  const nz = (v: number) => (Number.isFinite(v) ? v : 0);
  const bgUp = String(color.new(color.green, 90));
  const bgDown = String(color.new(color.red, 90));

  const plot0 = [];
  const plot1 = [];
  const plot2 = [];
  const plot3 = [];
  const plot4 = [];
  const bgColors: BgColorData[] = [];
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    plot0.push({ time: t, value: crossover[i] ? fin(macd[i]) : NaN, color: color.green });
    plot1.push({ time: t, value: crossdown[i] ? fin(macd[i]) : NaN, color: color.red });
    plot2.push({ time: t, value: fin(macd[i]), color: cfg.macdColor });
    plot3.push({ time: t, value: fin(signal[i]), color: cfg.signalColor });
    bgColors.push({ time: t, color: gt(macd[i], 0) ? bgUp : bgDown });
    const h = hist[i];
    const h1 = nz(i > 0 ? hist[i - 1] : NaN);
    const histColor = ge(h, 0)
      ? (gt(h, h1) ? cfg.colGrowAbove : cfg.colFallAbove)
      : (lt(h, h1) ? cfg.colFallBelow : cfg.colGrowBelow);
    plot4.push({ time: t, value: fin(h), color: histColor });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2, plot3, plot4 },
    hlines: LEVELS.map((v) => ({
      value: v,
      options: { title: String(v), color: v === 0 ? ZERO_COL : LEVEL_COL, linestyle: v === 0 ? 'solid' : 'dotted' },
    })),
    bgColors,
  };
}

export const MacdVWithVolatilityNormalisation = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
