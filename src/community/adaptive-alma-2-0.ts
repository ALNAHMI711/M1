/**
 * Adaptive ALMA 2.0
 *
 * An ALMA whose window, offset and sigma follow the efficiency ratio of the source (net change over `maxLen` bars
 * divided by the volume-weighted sum of the absolute changes): short window, high offset and low sigma in efficient
 * trends; long window and more smoothing in noise. The candles can be replaced by Heikin-Ashi values (unless the
 * chart candles are already Heikin-Ashi). The source is chosen among price mixes (default (o + 2h + 2l + 2c) / 7).
 * A Garman-Klass volatility engine (ALMAs of the GK volatility of lengths 2..10 interpolated by the efficiency, over
 * a slow ALMA of 160 bars) and a tanh scale of its z-score set a threshold: the trend turns up when the ALMA rises
 * by more than the threshold with the close above it, down when it falls by more than the threshold with the close
 * below it (triangle signals on the turns, shifted by `sigOffset` bars). Medium and long ALMAs, a noise band around
 * the adaptive ALMA (filled aqua while the close is inside) and ALMA Bollinger Bands with circle signals on the
 * crosses of the source with the bands.
 *
 * Reference: "Adaptive ALMA" by Zomzi
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { barInterval, barTime } from '../bar-time';

export type AdaptiveAlmaSourceType = 'Close' | 'HL2' | 'HLC3' | 'OHLC4' | 'OCC3' | 'HLCC4' | 'Custom';

export interface AdaptiveAlma20Inputs {
  /** Source mix of the (Heikin-Ashi) candle */
  srcType: AdaptiveAlmaSourceType;
  /** Use Heikin-Ashi values (when the chart candles are not Heikin-Ashi) */
  useHa: boolean;
  /** Minimum ALMA window */
  minLen: number;
  /** Maximum ALMA window (also the efficiency ratio length) */
  maxLen: number;
  /** Show the medium and long ALMAs */
  showExtra: boolean;
  medLen: number;
  medOff: number;
  medSig: number;
  longLen: number;
  longOff: number;
  longSig: number;
  minOff: number;
  maxOff: number;
  minSig: number;
  maxSig: number;
  /** Length of the slow GK volatility (VWMA) */
  atrSlowLen: number;
  /** Threshold sensitivity */
  atrMasterMult: number;
  /** Bar shift of the signal shapes */
  sigOffset: number;
  showBb: boolean;
  bbLen: number;
  bbOffset: number;
  bbSigma: number;
  bbMult: number;
}

export const defaultInputs: AdaptiveAlma20Inputs = {
  srcType: 'Custom',
  useHa: true,
  minLen: 3,
  maxLen: 21,
  showExtra: true,
  medLen: 32,
  medOff: 0.8,
  medSig: 5.0,
  longLen: 128,
  longOff: 0.8,
  longSig: 5.0,
  minOff: 0.81,
  maxOff: 1.0,
  minSig: 2.6,
  maxSig: 6.9,
  atrSlowLen: 160,
  atrMasterMult: 0.645,
  sigOffset: -1,
  showBb: true,
  bbLen: 20,
  bbOffset: 0.8,
  bbSigma: 1.0,
  bbMult: 2.0,
};

const G_SRC = 'Source Settings';
const G_ALMA = 'ALMA Adaptation';
const G_EXTRA = 'Additional ALMA Averages';
const G_OPT = 'Sigma/Offset Dynamics';
const G_EV = 'Global Evasion Engine (Autonomic Gaussian)';
const G_SHIFT = 'Signal Shift';
const G_BB = 'BB-ALMA Settings';

export const inputConfig: InputConfig[] = [
  { id: 'srcType', type: 'string', title: 'Source Type', defval: 'Custom', options: ['Close', 'HL2', 'HLC3', 'OHLC4', 'OCC3', 'HLCC4', 'Custom'], group: G_SRC },
  { id: 'useHa', type: 'bool', title: 'Force Heikin-Ashi Calculations', defval: true, group: G_SRC,
    tooltip: 'When ON, the Heikin-Ashi values are computed and used also on regular candles. When OFF, each candle type uses its own values.' },
  { id: 'minLen', type: 'int', title: 'Min. Length', defval: 3, min: 1, group: G_ALMA,
    tooltip: 'Minimum window size for ALMA. Used during high-efficiency trend phases to reduce lag.' },
  { id: 'maxLen', type: 'int', title: 'Max. Length', defval: 21, max: 100, group: G_ALMA,
    tooltip: 'Maximum window size for ALMA. Used during low-efficiency or noisy phases to increase smoothing.' },
  { id: 'showExtra', type: 'bool', title: 'Show Medium & Long ALMAs', defval: true, group: G_EXTRA },
  { id: 'medLen', type: 'int', title: 'Medium Length', defval: 32, min: 1, group: G_EXTRA },
  { id: 'medOff', type: 'float', title: 'Medium Offset', defval: 0.8, step: 0.025, group: G_EXTRA },
  { id: 'medSig', type: 'float', title: 'Medium Sigma', defval: 5.0, step: 0.25, group: G_EXTRA },
  { id: 'longLen', type: 'int', title: 'Long Length', defval: 128, min: 1, group: G_EXTRA },
  { id: 'longOff', type: 'float', title: 'Long Offset', defval: 0.8, step: 0.025, group: G_EXTRA },
  { id: 'longSig', type: 'float', title: 'Long Sigma', defval: 5.0, step: 0.25, group: G_EXTRA },
  { id: 'minOff', type: 'float', title: 'Min. Offset', defval: 0.81, min: 0.0, max: 1.0, step: 0.005, group: G_OPT },
  { id: 'maxOff', type: 'float', title: 'Max. Offset', defval: 1.0, min: 0.0, max: 1.0, step: 0.005, group: G_OPT },
  { id: 'minSig', type: 'float', title: 'Min. Sigma', defval: 2.6, min: 0.25, step: 0.05, group: G_OPT },
  { id: 'maxSig', type: 'float', title: 'Max. Sigma', defval: 6.9, min: 0.5, step: 0.05, group: G_OPT },
  { id: 'atrSlowLen', type: 'int', title: 'Slow GK Volatility (Background)', defval: 160, min: 10, group: G_EV },
  { id: 'atrMasterMult', type: 'float', title: 'Sensitivity', defval: 0.645, min: 0.1, step: 0.005, group: G_EV },
  { id: 'sigOffset', type: 'int', title: 'Arrows Offset (Shift)', defval: -1, min: -10, max: 10, group: G_SHIFT },
  { id: 'showBb', type: 'bool', title: 'Show Bollinger Bands', defval: true, group: G_BB },
  { id: 'bbLen', type: 'int', title: 'BB Length', defval: 20, min: 1, group: G_BB },
  { id: 'bbOffset', type: 'float', title: 'BB ALMA Offset', defval: 0.8, min: 0, max: 1, step: 0.01, group: G_BB },
  { id: 'bbSigma', type: 'float', title: 'BB ALMA Sigma', defval: 1.0, min: 0, group: G_BB },
  { id: 'bbMult', type: 'float', title: 'BB Multiplier', defval: 2.0, min: 0.1, step: 0.1, group: G_BB },
];

const SRC_COL = String(color.new(color.white, 70));
const NOISE_COL = String(color.new(color.gray, 85));
const BASIS_COL = String(color.new(color.gray, 50));
const BAND_COL = String(color.new(color.teal, 50));
const UP_COL = '#3AFF17';
const DOWN_COL = '#FD1707';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Source Line', color: SRC_COL, lineWidth: 1 },
  { id: 'plot1', title: 'Adaptive ALMA', color: color.gray, lineWidth: 3 },
  { id: 'plot2', title: 'Medium ALMA', color: '#00ff08', lineWidth: 2 },
  { id: 'plot3', title: 'Long ALMA', color: '#2196F3', lineWidth: 2 },
  { id: 'plot4', title: 'Noise Upper Band', color: NOISE_COL, lineWidth: 1 },
  { id: 'plot5', title: 'Noise Lower Band', color: NOISE_COL, lineWidth: 1 },
  { id: 'plot6', title: 'BB Basis', color: BASIS_COL, lineWidth: 1 },
  { id: 'plot7', title: 'BB Upper Band', color: BAND_COL, lineWidth: 1 },
  { id: 'plot8', title: 'BB Lower Band', color: BAND_COL, lineWidth: 1 },
];

export const metadata = {
  title: 'Adaptive ALMA',
  shortTitle: 'Adaptive ALMA',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const nz = (x: number, y = 0) => (Number.isFinite(x) ? x : y);
/** Pine math.max / math.min: na when an argument is na */
const max = (a: number, b: number) => Math.max(a, b);
const min = (a: number, b: number) => Math.min(a, b);
/** Non-finite values are na for the averages and the plots */
const fin = (x: number) => (Number.isFinite(x) ? x : NaN);

export function calculate(
  bars: Bar[],
  inputs: Partial<AdaptiveAlma20Inputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const alma = (a: number[], len: number, off: number, sig: number) => A(ta.alma(S(a), len, off, sig));
  const volume = bars.map((b) => b.volume ?? NaN);
  const vwma = (a: number[], len: number) => A(ta.vwma(S(a), len, S(volume)));
  const { minLen, maxLen } = cfg;

  // Candles: Heikin-Ashi values unless the chart candles already follow the Heikin-Ashi open
  const cOpen = new Array<number>(n);
  const cHigh = new Array<number>(n);
  const cLow = new Array<number>(n);
  const cClose = new Array<number>(n);
  const src = new Array<number>(n);
  let isNativeHa = true; // var bool is_native_ha = true
  let haOpen = NaN; // var float ha_open = na
  let prevHaClose = NaN;
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    if (i > 0) {
      const p = bars[i - 1];
      if (gt(Math.abs(b.open - (p.open + p.close) / 2), 0.0001)) isNativeHa = false;
    }
    const applyHa = cfg.useHa && !isNativeHa;
    const haClose = (b.open + b.high + b.low + b.close) / 4;
    haOpen = isNaN(haOpen) ? (b.open + b.close) / 2 : (nz(haOpen) + nz(prevHaClose)) / 2;
    prevHaClose = haClose;
    const haHigh = Math.max(b.high, Math.max(haOpen, haClose));
    const haLow = Math.min(b.low, Math.min(haOpen, haClose));
    const o = applyHa ? haOpen : b.open;
    const h = applyHa ? haHigh : b.high;
    const l = applyHa ? haLow : b.low;
    const c = applyHa ? haClose : b.close;
    cOpen[i] = o;
    cHigh[i] = h;
    cLow[i] = l;
    cClose[i] = c;
    switch (cfg.srcType) {
      case 'Close': src[i] = c; break;
      case 'HL2': src[i] = (h + l) / 2; break;
      case 'HLC3': src[i] = (h + l + c) / 3; break;
      case 'OHLC4': src[i] = (o + h + l + c) / 4; break;
      case 'HLCC4': src[i] = (h + l + 2 * c) / 4; break;
      case 'OCC3': src[i] = (o + 2 * c) / 3; break;
      default: src[i] = (o + 2 * h + 2 * l + 2 * c) / 7;
    }
  }

  // Efficiency ratio and the adaptive ALMA
  const absChange = src.map((x, i) => (i > 0 ? Math.abs(x - src[i - 1]) : NaN));
  const vwChange = vwma(absChange, maxLen);
  const er = new Array<number>(n);
  const currentAlma = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const changeNet = Math.abs(src[i] - nz(i - maxLen >= 0 ? src[i - maxLen] : NaN, src[i]));
    const sumVol = max(vwChange[i] * maxLen, 1e-6);
    er[i] = max(0.0, min(1.0, changeNet / sumVol));
    const e = er[i];
    const currLen = Math.trunc(Math.round(max(minLen, min(maxLen, maxLen - e * (maxLen - minLen)))));
    const currOff = max(cfg.minOff, min(cfg.maxOff, cfg.minOff + e * (cfg.maxOff - cfg.minOff)));
    const currSig = max(cfg.minSig, min(cfg.maxSig, cfg.maxSig - e * (cfg.maxSig - cfg.minSig)));
    // f_alma_dynamic: an na window length runs no loop iteration (0 / 1e-10 = 0)
    const len = max(2, currLen);
    const m = (1.0 - currOff) * (len - 1);
    const s = len / currSig;
    const s2 = 2 * (s * s);
    let v = 0.0;
    let w = 0.0;
    for (let k = 0; k <= len - 1; k++) {
      const diff = k - m;
      const weight = Math.exp(-(diff * diff) / s2);
      v += nz(i - k >= 0 ? src[i - k] : NaN) * weight;
      w += weight;
    }
    currentAlma[i] = v / Math.max(w, 1e-10);
  }

  const almaMedium = alma(src, cfg.medLen, cfg.medOff, cfg.medSig);
  const almaLong = alma(src, cfg.longLen, cfg.longOff, cfg.longSig);

  // Garman-Klass volatility engine
  const cGk = cClose.map((c, i) => {
    const logHl = Math.log(Math.max(cHigh[i], 1e-10) / Math.max(cLow[i], 1e-10));
    const logCc = Math.log(Math.max(c, 1e-10) / Math.max(cOpen[i], 1e-10));
    const gkVariance = 0.5 * Math.pow(logHl, 2) - (2 * Math.log(2) - 1) * Math.pow(logCc, 2);
    return Math.sqrt(Math.max(0.0, gkVariance)) * c;
  });
  const gk: number[][] = [];
  for (let len = 2; len <= 10; len++) gk[len] = alma(cGk, len, 0.8, 5);
  const gkSlow = alma(cGk, 160, 0.8, 5);

  const volRatio = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const idx = 10.0 - er[i] * 8.0;
    const intIdx = Math.trunc(Math.floor(max(2.0, min(9.0, idx))));
    const weight = max(0.0, min(1.0, idx - intIdx));
    // na int_idx: no case matches, the last branch (gk9 / gk10) is taken
    const lowIdx = intIdx >= 2 && intIdx <= 8 ? intIdx : 9;
    const vLow = gk[lowIdx][i];
    const vHigh = gk[lowIdx + 1][i];
    const atrFast = nz(vLow + weight * (vHigh - vLow), gk[2][i]);
    volRatio[i] = nz(atrFast / max(gkSlow[i], 1e-10), 1.0);
  }
  const vrMean = alma(volRatio, 160, 0.8, 5);
  const vrStdev = A(ta.stdev(S(volRatio), 160));
  const almaHl = alma(cHigh.map((h, i) => h - cLow[i]), 5, 0.8, 5);
  const baseAtrEv = vwma(cGk, cfg.atrSlowLen);

  const visualNoiseTh = new Array<number>(n);
  const isNoisyVis = new Array<boolean>(n);
  const buy = new Array<boolean>(n).fill(false);
  const sell = new Array<boolean>(n).fill(false);
  const trend = new Array<number>(n);
  let trendState = 0; // var int trend_state = 0
  // histories of the ta.change calls that do not run on every bar (lazy `or` / `and`, `else if` condition)
  let prevCloseAtCall = NaN;
  let prevVolumeAtCall = NaN;
  let prevAlmaAtElse = NaN;
  for (let i = 0; i < n; i++) {
    const vr = volRatio[i];
    const sd = vrStdev[i];
    const z = eq(sd, 0) ? 0.0 : (vr - vrMean[i]) / sd;
    const x = Math.abs(z) / 2.0;
    const ex = Math.exp(x);
    const enx = Math.exp(-x);
    const vrGaussScaled = max(0.0, min(1.0, (ex - enx) / max(ex + enx, 1e-10)));

    // is_frozen = ta.alma(c_high - c_low, 5, 0.8, 5) == 0 or (ta.change(c_close) == 0 and ta.change(volume) == 0)
    let isFrozen = eq(almaHl[i], 0);
    if (!isFrozen) {
      const chClose = cClose[i] - prevCloseAtCall;
      prevCloseAtCall = cClose[i];
      if (eq(chClose, 0)) {
        const chVolume = volume[i] - prevVolumeAtCall;
        prevVolumeAtCall = volume[i];
        isFrozen = eq(chVolume, 0);
      }
    }
    const finalGaussScale = isFrozen ? 0.0 : vrGaussScaled;

    const base = baseAtrEv[i];
    visualNoiseTh[i] = base * (0.3 + 20.0 * vr * 0.008);
    const fSample = max(10.0, min(50.0, 20.0 * vr));
    const autoAtrM = 0.015 + Math.pow(fSample, 0.95) * 0.0018;
    const noiseLimit = base * (0.3 + fSample * 0.008);
    const close = cClose[i];
    const ca = currentAlma[i];
    const distToMean = Math.abs(close - ca);
    const adaptAlpha = lt(distToMean, noiseLimit)
      ? max(0.015, 0.2 - fSample * 0.003) * (1.0 - distToMean / noiseLimit) : 0.0;
    const baseThreshold = (autoAtrM + adaptAlpha) * (1.0 + finalGaussScale);
    const dAtr = nz(base * baseThreshold * cfg.atrMasterMult);
    isNoisyVis[i] = lt(Math.abs(close - ca), visualNoiseTh[i]);

    const prevTrend = trendState;
    const ch1 = i > 0 ? ca - currentAlma[i - 1] : NaN;
    if (gt(ch1, dAtr) && gt(close, ca)) {
      trendState = 1;
    } else {
      const ch2 = ca - prevAlmaAtElse;
      prevAlmaAtElse = ca;
      if (lt(ch2, -dAtr) && lt(close, ca)) trendState = -1;
    }
    trend[i] = trendState;
    buy[i] = trendState === 1 && prevTrend !== 1;
    sell[i] = trendState === -1 && prevTrend !== -1;
  }

  // ALMA Bollinger Bands
  const bbBasis = alma(src, cfg.bbLen, cfg.bbOffset, cfg.bbSigma);
  const bbSd = A(ta.stdev(S(src), cfg.bbLen));
  const bbUpper = bbBasis.map((v, i) => v + cfg.bbMult * bbSd[i]);
  const bbLower = bbBasis.map((v, i) => v - cfg.bbMult * bbSd[i]);
  // ta.crossover / ta.crossunder: compared with the last bar where both values were not na; a tie there counts
  const crossover = new Array<boolean>(n).fill(false);
  const crossunder = new Array<boolean>(n).fill(false);
  let pS1 = NaN;
  let pL = NaN;
  let pS2 = NaN;
  let pU = NaN;
  for (let i = 0; i < n; i++) {
    const s = src[i];
    crossover[i] = gt(s, bbLower[i]) && le(pS1, pL);
    crossunder[i] = lt(s, bbUpper[i]) && ge(pS2, pU);
    if (!isNaN(s) && !isNaN(bbLower[i])) {
      pS1 = s;
      pL = bbLower[i];
    }
    if (!isNaN(s) && !isNaN(bbUpper[i])) {
      pS2 = s;
      pU = bbUpper[i];
    }
  }

  const t = (i: number) => bars[i].time;
  const P = (f: (i: number) => { time: number; value: number; color?: string }) => bars.map((_b, i) => f(i));
  const medUp = (i: number) => i > 0 && gt(almaMedium[i], almaMedium[i - 1]);
  const longUp = (i: number) => i > 0 && gt(almaLong[i], almaLong[i - 1]);
  const plots = {
    plot0: P((i) => ({ time: t(i), value: fin(src[i]) })),
    plot1: P((i) => ({
      time: t(i), value: fin(currentAlma[i]),
      color: trend[i] === 1 ? UP_COL : trend[i] === -1 ? DOWN_COL : color.gray,
    })),
    plot2: P((i) => ({ time: t(i), value: cfg.showExtra ? fin(almaMedium[i]) : NaN, color: medUp(i) ? '#00ff08' : '#ff0055' })),
    plot3: P((i) => ({ time: t(i), value: cfg.showExtra ? fin(almaLong[i]) : NaN, color: longUp(i) ? '#2196F3' : '#9C27B0' })),
    plot4: P((i) => ({ time: t(i), value: fin(currentAlma[i] + visualNoiseTh[i]) })),
    plot5: P((i) => ({ time: t(i), value: fin(currentAlma[i] - visualNoiseTh[i]) })),
    plot6: P((i) => ({ time: t(i), value: cfg.showBb ? fin(bbBasis[i]) : NaN })),
    plot7: P((i) => ({ time: t(i), value: cfg.showBb ? fin(bbUpper[i]) : NaN })),
    plot8: P((i) => ({ time: t(i), value: cfg.showBb ? fin(bbLower[i]) : NaN })),
  };

  // fill(p1, p2, isNoisy_vis ? color.new(color.aqua, 92) : color.new(color.gray, 97))
  const noisyCol = String(color.new(color.aqua, 92));
  const quietCol = String(color.new(color.gray, 97));
  const bbFillCol = String(color.new(color.teal, cfg.showBb ? 95 : 100));
  const fills = [
    { plot1: 'plot4', plot2: 'plot5', colors: isNoisyVis.map((v) => (v ? noisyCol : quietCol)) },
    { plot1: 'plot7', plot2: 'plot8', colors: bars.map(() => bbFillCol) },
  ];

  // plotshape(..., offset = sig_offset): the shape of bar i is drawn on bar i + sig_offset
  const markers: MarkerData[] = [];
  const interval = barInterval(bars);
  const at = (i: number) => barTime(bars, i + cfg.sigOffset, interval);
  for (let i = 0; i < n; i++) {
    if (i + cfg.sigOffset < 0) continue;
    if (buy[i]) markers.push({ time: at(i), position: 'belowBar', shape: 'triangleUp', color: color.lime, size: 'small' });
    if (sell[i]) markers.push({ time: at(i), position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'small' });
    if (cfg.showBb && crossover[i]) {
      markers.push({ time: at(i), position: 'belowBar', shape: 'circle', color: String(color.new(color.lime, 0)), size: 'tiny' });
    }
    if (cfg.showBb && crossunder[i]) {
      markers.push({ time: at(i), position: 'aboveBar', shape: 'circle', color: String(color.new(color.red, 0)), size: 'tiny' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills,
    markers,
  };
}

export const AdaptiveAlma20 = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
