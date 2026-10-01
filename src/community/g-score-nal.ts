/**
 * G-Score | NAL
 *
 * Price Z: a Jurik-style moving average of the z-score of the source ((src - SMA) / stdev over the z-score length).
 * Thresholds: +- a Jurik-style moving average (3 x smoothing) of the z-score of a GARCH volatility. The GARCH
 * variance mixes the long-run variance (SMA of the lagged one-bar variance), the squared lagged log return of the
 * source and the lagged one-bar variance; its weights are fitted on each bar by a grid search: beta (1..99) then
 * gamma (1..100 - beta), each the candidate with the lowest sum of squared errors against the realized variance (SMA
 * of the squared returns) over the lookback. The state turns bullish when Price Z is above the upper threshold and
 * bearish below the lower threshold, and is kept between. Colours of the lines, fills, background and candles
 * follow the state; triangles mark the changes from bearish to bullish and back.
 *
 * Reference: "G-Score | NAL" by NordicAlphaLab
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © NordicAlphaLab
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BgColorData, PlotCandleData } from '../types';

export interface GScoreNalInputs {
  /** Colour mode: Standard, Nordic or Simple */
  colMode: 'Standard' | 'Nordic' | 'Simple';
  src: SourceType;
  /** GARCH lookback (window of the fit and of the variance averages) */
  garchLookback: number;
  /** Z-score length */
  len: number;
  /** Jurik-style smoothing length (3 x for the volatility z-score) */
  smoothLen: number;
}

export const defaultInputs: GScoreNalInputs = {
  colMode: 'Standard',
  src: 'hlcc4',
  garchLookback: 30,
  len: 48,
  smoothLen: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'colMode', type: 'string', title: 'Color Mode', defval: 'Standard', options: ['Standard', 'Nordic', 'Simple'] },
  { id: 'src', type: 'source', title: 'Source', defval: 'hlcc4' },
  { id: 'garchLookback', type: 'int', title: 'GARCH Lookback', defval: 30, min: 2 },
  { id: 'len', type: 'int', title: 'Z-Score Length', defval: 48, min: 1 },
  { id: 'smoothLen', type: 'int', title: 'Smoothing', defval: 10, min: 1 },
];

const STANDARD_UP = String(color.rgb(0, 255, 200));
const ZERO_COL = String(color.new(color.white, 85));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Zero', color: ZERO_COL, lineWidth: 1, display: 'pane' },
  { id: 'plot1', title: 'Upper Threshold', color: String(color.new(color.gray, 35)), lineWidth: 1 },
  { id: 'plot2', title: 'Lower Threshold', color: String(color.new(color.gray, 35)), lineWidth: 1 },
  { id: 'plot3', title: 'Price Z', color: color.gray, lineWidth: 1 },
  { id: 'plot4', title: 'GLOW Price Z', color: String(color.new(color.gray, 50)), lineWidth: 5, display: 'pane' },
];

export const metadata = {
  title: 'G-Score | NAL',
  shortTitle: 'G-Score',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; na operands give false */
const EPS = 1e-10;
const gt = (a: number, b: number): boolean => a - b > EPS;
const lt = (a: number, b: number): boolean => b - a > EPS;
/** Pine nz: na and +-infinity give the replacement */
const nz = (v: number, r: number) => (Number.isFinite(v) ? v : r);

export function calculate(
  bars: Bar[],
  inputs: Partial<GScoreNalInputs> = {},
): Omit<IndicatorResult, 'markers'> & {
  markers: MarkerData[]; bgColors: BgColorData[]; plotCandles: Record<string, PlotCandleData[]>;
} {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const lookback = cfg.garchLookback;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  const [colUp, colDn, colNu] = cfg.colMode === 'Nordic'
    ? [String(color.rgb(46, 161, 255)), String(color.rgb(150, 154, 169)), color.gray]
    : cfg.colMode === 'Simple'
      ? [color.lime, color.red, color.gray]
      : [STANDARD_UP, String(color.rgb(32, 94, 144)), color.gray];

  const src = A(getSourceSeries(bars, cfg.src));

  // Lagged return / variance components
  const logReturn = src.map((_c, i) => {
    const s1 = i >= 1 ? src[i - 1] : NaN;
    const s2 = i >= 2 ? src[i - 2] : NaN;
    return !isNaN(s2) && gt(s1, 0.0) && gt(s2, 0.0) ? Math.log(s1 / s2) : 0.0;
  });
  // nz(ta.variance(src[1], 1), 0.0)
  const laggedVariance = A(ta.variance(S(src.map((_c, i) => (i >= 1 ? src[i - 1] : NaN))), 1)).map((v) => nz(v, 0.0));
  const squaredLogReturn = logReturn.map((r) => Math.pow(r, 2.0));
  const realizedVariance = A(ta.sma(S(squaredLogReturn), lookback)).map((v, i) => nz(v, squaredLogReturn[i]));
  const longRunVariance = A(ta.sma(S(laggedVariance), lookback)).map((v, i) => nz(v, laggedVariance[i]));

  // math.sum(x, lookback) inside the two loops: one call site each. Its history has one value per bar (the value of
  // its last call in that bar), so each call gives x + the last values of the lookback - 1 previous bars.
  const lambdaSum = new LoopSum(lookback);
  const gammaSum = new LoopSum(lookback);
  const volatility: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const lagged = laggedVariance[i];
    const sq = squaredLogReturn[i];
    const realized = realizedVariance[i];
    const lambdaSse: number[] = [];
    for (let c = 1; c <= 99; c++) {
      const w = c / 100.0;
      const est = w * lagged + (1.0 - w) * sq;
      lambdaSse.push(lambdaSum.call(Math.pow(est - realized, 2.0)));
    }
    lambdaSum.commit();
    const betaIndex = indexOfMin(lambdaSse) + 1;

    const gammaSse: number[] = [];
    for (let g = 1; g <= 100 - betaIndex; g++) {
      const bw = betaIndex / 100.0;
      const gw = g / 100.0;
      const aw = 1.0 - bw - gw;
      const est = gw * longRunVariance[i] + aw * sq + bw * lagged;
      gammaSse.push(gammaSum.call(Math.pow(est - realized, 2.0)));
    }
    gammaSum.commit();
    const gammaIndex = indexOfMin(gammaSse) + 1;

    const beta = betaIndex / 100.0;
    const gamma = gammaIndex / 100.0;
    const alpha = 1.0 - beta - gamma;
    const variance = gamma * longRunVariance[i] + alpha * sq + beta * lagged;
    volatility[i] = Math.sqrt(Math.max(variance, 0.0));
  }

  // f_zScore(Zsrc, Zlen) = (Zsrc - ta.sma(Zsrc, Zlen)) / ta.stdev(Zsrc, Zlen): a plain division (x / 0 is +-infinity)
  const zScore = (x: number[], zlen: number) => {
    const mean = A(ta.sma(S(x), zlen));
    const dev = A(ta.stdev(S(x), zlen));
    return x.map((v, i) => (v - mean[i]) / dev[i]);
  };
  const zPrice = jma(zScore(src, cfg.len), cfg.smoothLen, 100, 7);
  const zVol = jma(zScore(volatility, cfg.len), cfg.smoothLen * 3, 100, 7);

  const upper: number[] = new Array(n);
  const lower: number[] = new Array(n);
  const nal: number[] = new Array(n);
  const plotColor: string[] = new Array(n);
  let state = 0;
  let prevColor = colNu;
  for (let i = 0; i < n; i++) {
    const neg = zVol[i] * -1;
    // math.max / math.min: na with an na argument
    upper[i] = isNaN(zVol[i]) ? NaN : Math.max(zVol[i], neg);
    lower[i] = isNaN(zVol[i]) ? NaN : Math.min(zVol[i], neg);
    // NAL := zScore_Price < lower_threshold ? -1 : zScore_Price > upper_threshold ? 1 : nz(NAL[1], 0)
    state = lt(zPrice[i], lower[i]) ? -1 : gt(zPrice[i], upper[i]) ? 1 : state;
    nal[i] = state;
    // plotColor := NAL == 1 ? col_up : NAL == -1 ? col_dn : nz(plotColor[1], col_nu)
    prevColor = state === 1 ? colUp : state === -1 ? colDn : prevColor;
    plotColor[i] = prevColor;
  }

  const t = (i: number) => bars[i].time;
  const thr = plotColor.map((c) => String(color.new(c, 35)));
  const glow = plotColor.map((c) => String(color.new(c, 50)));
  const fillUp = String(color.new(colUp, 90));
  const fillDn = String(color.new(colDn, 90));

  const markers: MarkerData[] = [];
  const bgColors: BgColorData[] = [];
  const candles: PlotCandleData[] = [];
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    // bgcolor(color.new(plotColor, 70), force_overlay = true)
    bgColors.push({ time: t(i), color: String(color.new(plotColor[i], 70)), forceOverlay: true });
    if (i > 0 && nal[i] === 1 && nal[i - 1] === -1) {
      markers.push({ time: t(i), position: 'belowBar', shape: 'triangleUp', color: colUp, text: '𝓑𝓾𝔂', textColor: colUp,
        size: 'tiny', forceOverlay: true });
    }
    if (i > 0 && nal[i] === -1 && nal[i - 1] === 1) {
      markers.push({ time: t(i), position: 'aboveBar', shape: 'triangleDown', color: colDn, text: '𝓢𝓮𝓵𝓵', textColor: colDn,
        size: 'tiny', forceOverlay: true });
    }
    // plotcandle(open, high, low, close, "Colored Candles", plotColor, plotColor, bordercolor = plotColor,
    //            force_overlay = true, display = display.pane)
    candles.push({ time: t(i), open: b.open, high: b.high, low: b.low, close: b.close,
      color: plotColor[i], wickColor: plotColor[i], borderColor: plotColor[i], forceOverlay: true });
  }

  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((_b, i) => ({ time: t(i), value: 0, color: ZERO_COL })),
      plot1: bars.map((_b, i) => ({ time: t(i), value: fin(upper[i]), color: thr[i] })),
      plot2: bars.map((_b, i) => ({ time: t(i), value: fin(lower[i]), color: thr[i] })),
      plot3: bars.map((_b, i) => ({ time: t(i), value: fin(zPrice[i]), color: plotColor[i] })),
      plot4: bars.map((_b, i) => ({ time: t(i), value: fin(zPrice[i]), color: glow[i] })),
    },
    fills: [
      // fill(pu, p0, color.new(col_up, 90)); fill(pl, p0, color.new(col_dn, 90)); fill(pz, p0, color.new(plotColor, 90))
      { plot1: 'plot1', plot2: 'plot0', options: { title: 'Plots Background', color: fillUp }, colors: bars.map(() => fillUp) },
      { plot1: 'plot2', plot2: 'plot0', options: { title: 'Plots Background', color: fillDn }, colors: bars.map(() => fillDn) },
      { plot1: 'plot3', plot2: 'plot0', options: { title: 'Plots Background' },
        colors: plotColor.map((c) => String(color.new(c, 90))) },
    ],
    markers,
    bgColors,
    plotCandles: { coloredCandles: candles },
  };
}

/**
 * Jurik-style moving average of the script (jma(src, length, phase, power)); one state per call. nz() treats na and
 * +-infinity as na.
 */
function jma(src: number[], length: number, phase: number, power: number): number[] {
  const phaseRatio = phase < -100.0 ? 0.5 : phase > 100.0 ? 2.5 : phase / 100.0 + 1.5;
  const beta = (0.45 * (length - 1)) / (0.45 * (length - 1) + 2.0);
  const alpha = Math.pow(beta, power);
  const out: number[] = new Array(src.length);
  let e0 = NaN;
  let e1 = NaN;
  let e2 = NaN;
  let val = NaN;
  for (let i = 0; i < src.length; i++) {
    const x = src[i];
    e0 = (1.0 - alpha) * x + alpha * nz(e0, x);
    e1 = (x - e0) * (1.0 - beta) + beta * nz(e1, 0.0);
    e2 = (e0 + phaseRatio * e1 - nz(val, x)) * Math.pow(1.0 - alpha, 2.0) + Math.pow(alpha, 2.0) * nz(e2, 0.0);
    val = e2 + nz(val, x);
    out[i] = val;
  }
  return out;
}

/**
 * array.indexof(arr, array.min(arr)): array.min skips na; array.indexof compares as Pine `==` (within 1e-10), so it
 * gives the first value within 1e-10 of the smallest one; -1 when every value is na.
 */
function indexOfMin(values: number[]): number {
  let min = NaN;
  for (const v of values) if (!isNaN(v) && (isNaN(min) || v < min)) min = v;
  if (isNaN(min)) return -1;
  return values.findIndex((v) => !isNaN(v) && !(Math.abs(v - min) > EPS));
}

/**
 * Pine math.sum(x, len) of one call site called several times per bar (in a loop): each call gives x + the values
 * of the len - 1 previous bars where it ran (na before); the value kept for a bar is the one of its last call.
 */
class LoopSum {
  private hist: number[] = [];
  private last = NaN;
  constructor(private readonly len: number) {}
  call(x: number): number {
    this.last = x;
    const h = this.hist.length;
    if (h < this.len - 1) return NaN;
    let s = x;
    for (let k = 1; k < this.len; k++) s += this.hist[h - k];
    return s;
  }
  commit(): void {
    this.hist.push(this.last);
    if (this.hist.length > this.len) this.hist.shift();
  }
}

export const GScoreNal = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
