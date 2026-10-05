/**
 * Regression Blend Candles [Adaptive]
 *
 * Candles that blend the price OHLC with the linear regression (end point, LR Lookback bars) of each of open, high,
 * low and close: blended = price * (1 - blend) + LR * blend. Advanced mode replaces the regression by an
 * exponentially weighted regression with a lag correction (its change since the previous bar times the factor - 1
 * is added). The LR values can be smoothed by ALMA, a Kalman filter or KAMA. The blend is the fixed LR Blend % or,
 * with Adaptive Blend, mapped between the min and max blend by the 100-bar percent rank of ATR % / StdDev % of close,
 * by the R² of close over the LR Lookback, or by an average of these. The high / low are widened to contain the
 * blended open and close. Ghost candles (off by default) draw the price candles with a transparency.
 *
 * Reference: "Regression Blend Candles [Adaptive]" by B3AR_Trades
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, math, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';

export interface LinearRegressionBlendCandlesInputs {
  /** LR Lookback */
  lrLength: number;
  /** LR Blend % (0 = price candles, 100 = LR candles); not used with Adaptive Blend */
  blendPct: number;
  /** Enable Adaptive Blend */
  useAdaptive: boolean;
  /** 'ATR' | 'StdDev' | 'ATR + StdDev' | 'R-Squared' | 'R² + ATR' */
  adaptiveMode: string;
  /** Adaptive lookback (ATR / StdDev) */
  adaptiveLen: number;
  adaptiveMin: number;
  adaptiveMax: number;
  rSquaredThreshLow: number;
  rSquaredThreshHigh: number;
  /** 'None' | 'ALMA' | 'Kalman' | 'KAMA' */
  smoothMode: string;
  almaOffset: number;
  almaSigma: number;
  /** ALMA / KAMA length */
  smoothLen: number;
  kalmanGain: number;
  /** Weighted regression with lag correction */
  useAdvanced: boolean;
  lagCorrection: number;
  weightDecay: number;
  showGhost: boolean;
  /** Ghost candle transparency (0-100) */
  ghostOpacity: number;
  colUp: string;
  colDn: string;
  useGrayWick: boolean;
  colGrayWick: string;
}

export const defaultInputs: LinearRegressionBlendCandlesInputs = {
  lrLength: 10,
  blendPct: 50.0,
  useAdaptive: false,
  adaptiveMode: 'ATR',
  adaptiveLen: 14,
  adaptiveMin: 20.0,
  adaptiveMax: 80.0,
  rSquaredThreshLow: 0.3,
  rSquaredThreshHigh: 0.8,
  smoothMode: 'None',
  almaOffset: 0.85,
  almaSigma: 6.0,
  smoothLen: 10,
  kalmanGain: 0.1,
  useAdvanced: false,
  lagCorrection: 1.5,
  weightDecay: 0.9,
  showGhost: false,
  ghostOpacity: 85,
  colUp: '#00FFFF',
  colDn: '#FF0000',
  useGrayWick: false,
  colGrayWick: '#787B86',
};

export const inputConfig: InputConfig[] = [
  { id: 'lrLength', type: 'int', title: 'LR Lookback', defval: 10, min: 2 },
  { id: 'blendPct', type: 'float', title: 'LR Blend %', defval: 50.0, min: 0, max: 100, step: 5 },
  { id: 'useAdaptive', type: 'bool', title: 'Enable Adaptive Blend', defval: false },
  {
    id: 'adaptiveMode', type: 'string', title: 'Adaptive Mode', defval: 'ATR',
    options: ['ATR', 'StdDev', 'ATR + StdDev', 'R-Squared', 'R² + ATR'],
  },
  { id: 'adaptiveLen', type: 'int', title: 'Adaptive Lookback', defval: 14, min: 2 },
  { id: 'adaptiveMin', type: 'float', title: 'Min Blend %', defval: 20.0, min: 0, max: 100, step: 5 },
  { id: 'adaptiveMax', type: 'float', title: 'Max Blend %', defval: 80.0, min: 0, max: 100, step: 5 },
  { id: 'rSquaredThreshLow', type: 'float', title: 'R² Low Threshold', defval: 0.3, min: 0, max: 1, step: 0.05 },
  { id: 'rSquaredThreshHigh', type: 'float', title: 'R² High Threshold', defval: 0.8, min: 0, max: 1, step: 0.05 },
  { id: 'smoothMode', type: 'string', title: 'Smoothing', defval: 'None', options: ['None', 'ALMA', 'Kalman', 'KAMA'] },
  { id: 'almaOffset', type: 'float', title: 'ALMA Offset', defval: 0.85, min: 0, max: 1, step: 0.05 },
  { id: 'almaSigma', type: 'float', title: 'ALMA Sigma', defval: 6.0, min: 1, step: 0.5 },
  { id: 'smoothLen', type: 'int', title: 'Smooth Length', defval: 10, min: 2 },
  { id: 'kalmanGain', type: 'float', title: 'Kalman Gain', defval: 0.1, min: 0.01, max: 1, step: 0.01 },
  { id: 'useAdvanced', type: 'bool', title: 'Enable Advanced Weighting & Lag Correction', defval: false },
  { id: 'lagCorrection', type: 'float', title: 'Lag Correction Factor', defval: 1.5, min: 1.0, max: 3.0, step: 0.1 },
  { id: 'weightDecay', type: 'float', title: 'Weight Decay', defval: 0.9, min: 0.5, max: 0.99, step: 0.01 },
  { id: 'showGhost', type: 'bool', title: 'Show Ghost Candles', defval: false },
  { id: 'ghostOpacity', type: 'int', title: 'Ghost Opacity %', defval: 85, min: 50, max: 95, step: 5 },
  { id: 'colUp', type: 'color', title: 'Bullish', defval: '#00FFFF' },
  { id: 'colDn', type: 'color', title: 'Bearish', defval: '#FF0000' },
  { id: 'useGrayWick', type: 'bool', title: 'Use Gray Wicks', defval: false },
  { id: 'colGrayWick', type: 'color', title: 'Gray Wick Color', defval: '#787B86' },
];

// Only candles (plotcandle): no line plots
export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [
  { id: 'ghost', title: 'Ghost Candles' },
  { id: 'blend', title: 'Blend Candles' },
];

export const metadata = {
  title: 'Regression Blend Candles [Adaptive]',
  shortTitle: 'Blend Candles',
  overlay: true,
};

/** Pine float comparisons: a >= b unless b - a > 1e-10, a != b when |a - b| > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;
/** Pine math.max / math.min: na when an argument is na (as JS Math.max / Math.min with NaN) */
const nz = (x: number, y = 0) => (isNaN(x) ? y : x);

export function calculate(
  bars: Bar[],
  inputs: Partial<LinearRegressionBlendCandlesInputs> = {},
): Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const open = bars.map((b) => b.open);
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  const close = bars.map((b) => b.close);
  const len = cfg.lrLength;

  // weightedLinreg(src, len, decay): exponentially weighted regression, end point; src[i] before bar 0 is nz() = 0
  const weightedLinreg = (src: number[], i: number): number => {
    let sumW = 0.0;
    let sumWX = 0.0;
    let sumWY = 0.0;
    let sumWXX = 0.0;
    let sumWXY = 0.0;
    for (let k = 0; k <= len - 1; k++) {
      const w = Math.pow(cfg.weightDecay, k);
      const x = len - 1 - k;
      const y = i - k >= 0 ? nz(src[i - k]) : 0;
      sumW += w;
      sumWX += w * x;
      sumWY += w * y;
      sumWXX += w * x * x;
      sumWXY += w * x * y;
    }
    const denom = sumW * sumWXX - sumWX * sumWX;
    const slope = ne(denom, 0) ? (sumW * sumWXY - sumWX * sumWY) / denom : 0.0;
    const intercept = ne(denom, 0) ? (sumWY - slope * sumWX) / sumW : src[i];
    return intercept + slope * (len - 1);
  };
  // advancedLR: wlr + (wlr - nz(wlr[1], wlr)) * (lagFactor - 1)
  const advancedLR = (src: number[]): number[] => {
    const wlr = src.map((_, i) => weightedLinreg(src, i));
    return wlr.map((v, i) => {
      const wlr1 = i > 0 ? nz(wlr[i - 1], v) : v;
      return v + (v - wlr1) * (cfg.lagCorrection - 1);
    });
  };

  // calcRSquared(close, lrLength): computed on every bar
  const rSquared: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    let sumX = 0.0;
    let sumY = 0.0;
    let sumXY = 0.0;
    let sumX2 = 0.0;
    let sumY2 = 0.0;
    for (let k = 0; k <= len - 1; k++) {
      const x = k;
      const y = i - k >= 0 ? nz(close[i - k]) : 0;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
      sumY2 += y * y;
    }
    const nn = len;
    const denom = (nn * sumX2 - sumX * sumX) * (nn * sumY2 - sumY * sumY);
    if (le(denom, 0)) {
      rSquared[i] = 0.0;
    } else {
      const r = (nn * sumXY - sumX * sumY) / Math.sqrt(denom);
      rSquared[i] = r * r;
    }
  }

  // effectiveBlendPct = useAdaptive ? calcAdaptiveBlend() : blendPct (an input: the call runs on all bars or none)
  let blendPctArr: number[];
  if (cfg.useAdaptive) {
    const atrVal = A(ta.atr(bars, cfg.adaptiveLen));
    const atrPct = atrVal.map((v, i) => (v / close[i]) * 100);
    const stdVal = A(ta.stdev(S(close), cfg.adaptiveLen));
    const stdPct = stdVal.map((v, i) => (v / close[i]) * 100);
    const atrNorm = A(ta.percentrank(S(atrPct), 100)).map((v) => v / 100);
    const stdNorm = A(ta.percentrank(S(stdPct), 100)).map((v) => v / 100);
    blendPctArr = new Array(n);
    for (let i = 0; i < n; i++) {
      const rSquaredNorm = Math.max(0.0, Math.min(1.0,
        (rSquared[i] - cfg.rSquaredThreshLow) / (cfg.rSquaredThreshHigh - cfg.rSquaredThreshLow)));
      let adaptiveVal: number;
      switch (cfg.adaptiveMode) {
        case 'ATR': adaptiveVal = atrNorm[i]; break;
        case 'StdDev': adaptiveVal = stdNorm[i]; break;
        case 'ATR + StdDev': adaptiveVal = (atrNorm[i] + stdNorm[i]) / 2; break;
        case 'R-Squared': adaptiveVal = rSquaredNorm; break;
        case 'R² + ATR': adaptiveVal = (rSquaredNorm + atrNorm[i]) / 2; break;
        default: adaptiveVal = atrNorm[i];
      }
      blendPctArr[i] = cfg.adaptiveMin + adaptiveVal * (cfg.adaptiveMax - cfg.adaptiveMin);
    }
  } else {
    blendPctArr = new Array(n).fill(cfg.blendPct);
  }

  // LR OHLC (useAdvanced is an input: one branch on every bar)
  let lr: number[][] = cfg.useAdvanced
    ? [open, high, low, close].map((s) => advancedLR(s))
    : [open, high, low, close].map((s) => A(ta.linreg(S(s), len, 0)));

  // Post-LR smoothing
  if (cfg.smoothMode === 'ALMA') {
    lr = lr.map((s) => A(ta.alma(S(s), cfg.smoothLen, cfg.almaOffset, cfg.almaSigma)));
  } else if (cfg.smoothMode === 'Kalman') {
    // kalmanX := kalman(lrX, gain, kalmanX[1]); kalman: state = nz(prev, src); state + gain * (src - state)
    lr = lr.map((s) => {
      const out: number[] = new Array(n);
      let prev = NaN;
      for (let i = 0; i < n; i++) {
        const state = nz(prev, s[i]);
        out[i] = state + cfg.kalmanGain * (s[i] - state);
        prev = out[i];
      }
      return out;
    });
  } else if (cfg.smoothMode === 'KAMA') {
    const L = cfg.smoothLen;
    const fastSC = 2.0 / (2.0 + 1);
    const slowSC = 2.0 / (30.0 + 1);
    lr = lr.map((s) => {
      const diff = s.map((v, i) => (i > 0 ? Math.abs(v - s[i - 1]) : NaN));
      const volatility = A(math.sum(S(diff), L) as Series);
      const out: number[] = new Array(n);
      let prev = NaN; // var float kamaVal (one per call site)
      for (let i = 0; i < n; i++) {
        const change = i - L >= 0 ? Math.abs(s[i] - s[i - L]) : NaN;
        const er = ne(volatility[i], 0) ? change / volatility[i] : 0;
        const sc = Math.pow(er * (fastSC - slowSC) + slowSC, 2);
        out[i] = nz(prev, s[i]) + sc * (s[i] - nz(prev, s[i]));
        prev = out[i];
      }
      return out;
    });
  }
  const [lrOpen, lrHigh, lrLow, lrClose] = lr;

  const ghostWickCol = String(color.new(cfg.colGrayWick, cfg.ghostOpacity));
  const ghostUp = String(color.new(cfg.colUp, cfg.ghostOpacity));
  const ghostDn = String(color.new(cfg.colDn, cfg.ghostOpacity));
  const ghost: PlotCandleData[] = [];
  const blendCandles: PlotCandleData[] = [];
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const blend = blendPctArr[i] / 100.0;
    const bo = b.open * (1 - blend) + lrOpen[i] * blend;
    let bh = b.high * (1 - blend) + lrHigh[i] * blend;
    let bl = b.low * (1 - blend) + lrLow[i] * blend;
    const bc = b.close * (1 - blend) + lrClose[i] * blend;
    bh = Math.max(bh, Math.max(bo, bc));
    bl = Math.min(bl, Math.min(bo, bc));

    const bodyCol = ge(bc, bo) ? cfg.colUp : cfg.colDn;
    const wickCol = cfg.useGrayWick ? cfg.colGrayWick : bodyCol;
    // plotcandle(showGhost ? open : na, ..., 'Ghost Candles')
    if (cfg.showGhost) {
      const gc = ge(b.close, b.open) ? ghostUp : ghostDn;
      ghost.push({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, color: gc, wickColor: ghostWickCol, borderColor: gc });
    }
    // plotcandle(blendOpen, blendHigh, blendLow, blendClose, 'Blend Candles'): no candle when a value is na
    if (!isNaN(bo) && !isNaN(bh) && !isNaN(bl) && !isNaN(bc)) {
      blendCandles.push({ time: b.time, open: bo, high: bh, low: bl, close: bc, color: bodyCol, wickColor: wickCol, borderColor: bodyCol });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    plotCandles: { ghost, blend: blendCandles },
  };
}

export const LinearRegressionBlendCandles = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  plotCandleConfig,
};
