/**
 * Ehlers Regime Dynamic Candles
 *
 * Candles of the open, high, low and close passed through an Ehlers Super Smoother (cycle length). The regime is
 * read from autocorrelations of the smoothed close: lag 1 over 2 * length bars (regime) and lag length / 2 over
 * 4 * length bars (trending). The trend strength (regime - (1 - threshold)) * trending / sensitivity, times the
 * percent rank of the relative volume when volume is used, is clamped to 0..1 and smoothed with an SMA. It mixes the
 * choppy colour with the bullish / bearish colour (color.from_gradient; bullish when the smoothed close is above the
 * smoothed open). A Fisher transform of the smoothed close sets the transparency: base + 20 when |fisher| < 0.5, base
 * when < 1, else base - 20 (wicks 10 more).
 *
 * Reference: "Ehlers Regime Dynamic Candles" by sizzlinsoft
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © SizzlinSoft
 */

import { ta, Series, color, math, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';

export interface EhlersRegimeDynamicCandlesInputs {
  /** Cycle length (Super Smoother period, base of the autocorrelation and Fisher windows) */
  length: number;
  /** SMA length of the trend weight */
  gradientSmooth: number;
  /** Trend detection threshold */
  regimeThreshold: number;
  /** Trend sensitivity (divides the trend strength) */
  trendSensitivity: number;
  /** Weight the trend strength with the percent rank of the relative volume */
  useVolume: boolean;
  trendUpBodyColor: string;
  trendUpWickColor: string;
  trendDownBodyColor: string;
  trendDownWickColor: string;
  choppyBodyColor: string;
  choppyWickColor: string;
  showBorder: boolean;
  borderColor: string;
  /** Border transparency */
  borderTransp: number;
  /** Transparency from the Fisher transform */
  adaptiveTransp: boolean;
  /** Base transparency */
  baseTransp: number;
}

export const defaultInputs: EhlersRegimeDynamicCandlesInputs = {
  length: 7,
  gradientSmooth: 5,
  regimeThreshold: 3,
  trendSensitivity: 0.2,
  useVolume: true,
  trendUpBodyColor: '#00ab14',
  trendUpWickColor: '#00ab14',
  trendDownBodyColor: '#e1005a',
  trendDownWickColor: '#e1005a',
  choppyBodyColor: '#00d0ff',
  choppyWickColor: '#00d0ff',
  showBorder: true,
  borderColor: '#000000',
  borderTransp: 30,
  adaptiveTransp: true,
  baseTransp: 0,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Cycle Length', defval: 7, min: 2 },
  { id: 'gradientSmooth', type: 'int', title: 'Gradient Smoothness', defval: 5, min: 1, max: 10 },
  { id: 'regimeThreshold', type: 'float', title: 'Trend Detection Threshold', defval: 3, min: 0.1, max: 10, step: 0.1 },
  { id: 'trendSensitivity', type: 'float', title: 'Trend Sensitivity', defval: 0.2, min: 0.2, max: 10, step: 0.1 },
  { id: 'useVolume', type: 'bool', title: 'Use Volume', defval: true },
  { id: 'trendUpBodyColor', type: 'color', title: 'Bullish Body', defval: '#00ab14' },
  { id: 'trendUpWickColor', type: 'color', title: 'Wick', defval: '#00ab14' },
  { id: 'trendDownBodyColor', type: 'color', title: 'Bearish Body', defval: '#e1005a' },
  { id: 'trendDownWickColor', type: 'color', title: 'Wick', defval: '#e1005a' },
  { id: 'choppyBodyColor', type: 'color', title: 'Body', defval: '#00d0ff' },
  { id: 'choppyWickColor', type: 'color', title: 'Wick', defval: '#00d0ff' },
  { id: 'showBorder', type: 'bool', title: 'Show Candle Border', defval: true },
  { id: 'borderColor', type: 'color', title: 'Border Color', defval: '#000000' },
  { id: 'borderTransp', type: 'int', title: 'Transparency', defval: 30, min: 0, max: 100 },
  { id: 'adaptiveTransp', type: 'bool', title: 'Adaptive Transparency', defval: true },
  { id: 'baseTransp', type: 'int', title: 'Base Transparency', defval: 0, min: 0, max: 100 },
];

// No plot(): the output is the plotcandle
export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [
  { id: 'candles', title: 'Ehlers Regime Dynamic Candles' },
];

export const metadata = {
  title: 'Ehlers Regime Dynamic Candles',
  shortTitle: 'Ehlers Regime Dynamic Candles',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
/** Pine math.max / math.min: na when an argument is na */
const max = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.max(a, b));
const min = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.min(a, b));
const nz = (x: number) => (isNaN(x) ? 0 : x);

/** superSmooth(src, len): Ehlers 2-pole Super Smoother; filt[1] / filt[2] read with nz */
function superSmooth(src: number[], len: number): number[] {
  const a1 = math.exp((-math.pi * math.sqrt(2)) / len);
  const b1 = 2 * a1 * math.cos((math.sqrt(2) * math.pi) / len);
  const c2 = b1;
  const c3 = -a1 * a1;
  const c1 = 1 - c2 - c3;
  const filt = new Array<number>(src.length);
  for (let i = 0; i < src.length; i++) {
    const s1 = i > 0 ? src[i - 1] : NaN;
    const f1 = i > 0 ? filt[i - 1] : NaN;
    const f2 = i > 1 ? filt[i - 2] : NaN;
    filt[i] = (c1 * (src[i] + s1)) / 2 + c2 * nz(f1) + c3 * nz(f2);
  }
  return filt;
}

/** autocorr(src, lag, len): sum1 / sqrt(sum2 * sum3) over src[i] * src[i + lag], i = 0 .. len - 1 */
function autocorr(src: number[], lag: number, len: number): number[] {
  const at = (j: number) => (j >= 0 ? src[j] : NaN);
  return src.map((_, bar) => {
    let sum1 = 0.0;
    let sum2 = 0.0;
    let sum3 = 0.0;
    for (let i = 0; i <= len - 1; i++) {
      sum1 = sum1 + at(bar - i) * at(bar - i - lag);
      sum2 = sum2 + at(bar - i) * at(bar - i);
      sum3 = sum3 + at(bar - i - lag) * at(bar - i - lag);
    }
    return sum1 / math.sqrt(sum2 * sum3);
  });
}

export function calculate(
  bars: Bar[],
  inputs: Partial<EhlersRegimeDynamicCandlesInputs> = {},
): Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const len = cfg.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  // Ehlers processing of the prices
  const smoothPrice = superSmooth(bars.map((b) => b.close), len);
  const o = superSmooth(bars.map((b) => b.open), len);
  const h = superSmooth(bars.map((b) => b.high), len);
  const l = superSmooth(bars.map((b) => b.low), len);
  const c = smoothPrice;

  // regime = autocorr(smoothPrice, 1, length * 2); trending = autocorr(smoothPrice, length / 2, length * 4)
  // (length / 2 is fractional in Pine v6: the history index src[i + lag] truncates it)
  const regime = autocorr(smoothPrice, 1, len * 2);
  const trending = autocorr(smoothPrice, Math.trunc(len / 2), len * 4);

  // fisher(c, length * 2)
  const fLen = len * 2;
  const cS = Series.fromArray(bars, c);
  const hi = A(ta.highest(cS, fLen));
  const lo = A(ta.lowest(cS, fLen));
  const fishVal = new Array<number>(n);
  let value1Prev = NaN;
  let value2Prev = NaN;
  for (let i = 0; i < n; i++) {
    let value1 = 0.66 * ((c[i] - lo[i]) / max(hi[i] - lo[i], 1e-10) - 0.5) + 0.67 * nz(value1Prev);
    value1 = max(min(value1, 0.999), -0.999);
    const value2 = 0.5 * math.log((1 + value1) / max(1 - value1, 1e-10)) + 0.5 * nz(value2Prev);
    value1Prev = value1;
    value2Prev = value2;
    fishVal[i] = value2;
  }
  // volatility = ta.atr(length) / ta.atr(length * 3) and its percent rank, trendPctRank: not used by the outputs

  // Volume trend validation
  let volumeStrength = new Array<number>(n).fill(0.5);
  if (cfg.useVolume) {
    const vol = bars.map((b) => b.volume ?? NaN);
    const volSma = A(ta.sma(Series.fromArray(bars, vol), len * 2));
    const volRatio = vol.map((v, i) => v / volSma[i]);
    const rank = A(ta.percentrank(Series.fromArray(bars, volRatio), len * 3));
    volumeStrength = rank.map((r) => min(r / 100, 1.0));
  }

  // trendWeight = min(1, max(0, scaledTrend * volume factor)), then ta.sma(trendWeight, gradientSmooth)
  const rawWeight = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const rawTrendStrength = (regime[i] - (1 - cfg.regimeThreshold)) * trending[i];
    const scaledTrend = rawTrendStrength / cfg.trendSensitivity;
    const volumeAdjustedTrend = scaledTrend * (cfg.useVolume ? volumeStrength[i] : 1.0);
    rawWeight[i] = min(1.0, max(0.0, volumeAdjustedTrend));
  }
  const trendWeight = A(ta.sma(Series.fromArray(bars, rawWeight), cfg.gradientSmooth));

  const borderCol = cfg.showBorder ? color.new(cfg.borderColor, cfg.borderTransp) : null;
  const candles: PlotCandleData[] = [];
  for (let i = 0; i < n; i++) {
    const tw = trendWeight[i];
    const isBullish = gt(c[i], o[i]);
    const bodyColor = isBullish
      ? color.from_gradient(tw, 0, 1, cfg.choppyBodyColor, cfg.trendUpBodyColor)
      : color.from_gradient(tw, 0, 1, cfg.choppyBodyColor, cfg.trendDownBodyColor);
    const wickColor = isBullish
      ? color.from_gradient(tw, 0, 1, cfg.choppyWickColor, cfg.trendUpWickColor)
      : color.from_gradient(tw, 0, 1, cfg.choppyWickColor, cfg.trendDownWickColor);
    const af = Math.abs(fishVal[i]);
    const bodyTransp = cfg.adaptiveTransp
      ? lt(af, 0.5) ? cfg.baseTransp + 20 : lt(af, 1.0) ? cfg.baseTransp : cfg.baseTransp - 20
      : cfg.baseTransp;
    const wickTransp = bodyTransp + 10;
    // plotcandle(o, h, l, c, color = color.new(bodyColor, bodyTransp), wickcolor = color.new(wickColor, wickTransp),
    //            bordercolor = showBorder ? color.new(borderColor, borderTransp) : na)
    candles.push({
      time: bars[i].time,
      open: o[i],
      high: h[i],
      low: l[i],
      close: c[i],
      color: color.new(bodyColor, bodyTransp) ?? undefined,
      wickColor: color.new(wickColor, wickTransp) ?? undefined,
      borderColor: borderCol ?? 'transparent',
    });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    plotCandles: { candles },
  };
}

export const EhlersRegimeDynamicCandles = { calculate, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig };
