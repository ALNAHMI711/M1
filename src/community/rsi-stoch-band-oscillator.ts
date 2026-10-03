/**
 * RSI+Stoch Band Oscillator
 *
 * Price bands at which the RSI (Wilder averages of the up / down closes, as an EMA of length 2 * RSI length - 1) and
 * the slow Stochastic (%K of the previous bar, smoothed) would reach their overbought and oversold levels on the
 * current bar. The upper band is the higher of the RSI and Stochastic upper bands, the lower band the higher of the
 * lower bands. The oscillator is the close position between them (0 at the lower band, 100 at the upper band), with
 * fills above 100 (red) and below 0 (green). A price-pane background marks a fall after a close above the upper band
 * (red) or a rise after a close below the lower band (green), with optional RSI / Stochastic direction and ADX
 * filters (ADX of ta.dmi(14, 14) above the threshold and falling).
 *
 * Reference: "RSI+Stoch Band Oscillator" by nasu_is_gaji
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © nasu_is_gaji
 */

import { ta, math, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';

export interface RsiStochBandOscillatorInputs {
  /** The RSI must fall (rise) for a red (green) background */
  rsiFilter: boolean;
  rsiLength: number;
  rsiOb: number;
  rsiOs: number;
  /** The slow %K and %D must fall (rise) for a red (green) background */
  stochFilter: boolean;
  stochLengthK: number;
  stochSmoothK: number;
  stochLengthD: number;
  stochOb: number;
  stochOs: number;
  /** The ADX must be above the threshold and falling */
  adxFilter: boolean;
  /** Not used by the original script (the ADX is ta.dmi(14, 14)) */
  adxLength: number;
  /** Not used by the original script (the ADX is ta.dmi(14, 14)) */
  adxSmooth: number;
  adxThreshold: number;
}

export const defaultInputs: RsiStochBandOscillatorInputs = {
  rsiFilter: true,
  rsiLength: 14,
  rsiOb: 70,
  rsiOs: 30,
  stochFilter: false,
  stochLengthK: 14,
  stochSmoothK: 3,
  stochLengthD: 3,
  stochOb: 80,
  stochOs: 20,
  adxFilter: true,
  adxLength: 14,
  adxSmooth: 14,
  adxThreshold: 25,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiFilter', type: 'bool', title: 'RSI Filter', defval: true, group: 'RSI' },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, group: 'RSI' },
  { id: 'rsiOb', type: 'float', title: 'RSI Overbought', defval: 70, group: 'RSI' },
  { id: 'rsiOs', type: 'float', title: 'RSI Oversold', defval: 30, group: 'RSI' },
  { id: 'stochFilter', type: 'bool', title: 'Stochastic Filter', defval: false, group: 'Stochastic' },
  { id: 'stochLengthK', type: 'int', title: 'Stochastic %K Length', defval: 14, group: 'Stochastic' },
  { id: 'stochSmoothK', type: 'int', title: 'Stochastic %K Smooth', defval: 3, group: 'Stochastic' },
  { id: 'stochLengthD', type: 'int', title: 'Stochastic %D Length', defval: 3, group: 'Stochastic' },
  { id: 'stochOb', type: 'float', title: 'Stochastic Overbought', defval: 80, group: 'Stochastic' },
  { id: 'stochOs', type: 'float', title: 'Stochastic Oversold', defval: 20, group: 'Stochastic' },
  { id: 'adxFilter', type: 'bool', title: 'ADX Filter', defval: true, group: 'ADX' },
  { id: 'adxLength', type: 'int', title: 'ADX Length', defval: 14, group: 'ADX' },
  { id: 'adxSmooth', type: 'int', title: 'ADX Smooth Length', defval: 14, group: 'ADX' },
  { id: 'adxThreshold', type: 'float', title: 'ADX Threshold', defval: 25, group: 'ADX' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Overbought Line', color: color.silver, lineWidth: 1, display: 'pane' },
  { id: 'plot1', title: 'Oversold Line', color: color.silver, lineWidth: 1, display: 'pane' },
  { id: 'plot2', title: 'Band Position', color: color.green, lineWidth: 1 },
];

export const metadata = {
  title: 'RSI+Stoch Band Oscillator',
  shortTitle: 'RSI+Stoch Band Oscillator',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

export function calculate(
  bars: Bar[],
  inputs: Partial<RsiStochBandOscillatorInputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const prev = (a: number[], k = 1) => a.map((_v, i) => (i - k >= 0 ? a[i - k] : NaN));
  const close = bars.map((b) => b.close);
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  const { rsiLength, rsiOb, rsiOs, stochLengthK: lenK, stochSmoothK: smoothK, stochLengthD: lenD, stochOb, stochOs } = cfg;

  // math.sum(x, stochLengthD - 1) and math.sum(x, stochSmoothK - 1): a length of 0 is a Pine runtime error on bar 0
  if (n > 0 && (lenD - 1 < 1 || smoothK - 1 < 1)) {
    throw new Error("Invalid value of the 'length' argument (0.0) in the 'sum' function. It must be > 0.");
  }

  // RSI bands: auc / adc = ta.ema(max(+-(close[1] - close[2]), 0), 2 * rsiLength - 1)
  const ep = 2 * rsiLength - 1;
  const c1 = prev(close);
  const c2 = prev(close, 2);
  const auc = A(ta.ema(S(c1.map((v, i) => Math.max(v - c2[i], 0))), ep));
  const adc = A(ta.ema(S(c1.map((v, i) => Math.max(c2[i] - v, 0))), ep));
  const rsiBand = (level: number, i: number) => {
    const x = (rsiLength - 1) * ((adc[i] * level) / (100 - level) - auc[i]);
    return ge(x, 0) ? close[i] + x : close[i] + (x * (100 - level)) / level;
  };

  // Stochastic bands: fastK = ta.stoch(close[1], high[1], low[1], lenK), slowK = ta.sma(fastK, smoothK)
  const fastK = A(ta.stoch(S(c1), S(prev(high)), S(prev(low)), lenK));
  const slowK = A(ta.sma(S(fastK), smoothK));
  const sumSlowK1 = A(math.sum(S(prev(slowK)), lenD - 1) as Series);
  const sumFastK1 = A(math.sum(S(prev(fastK)), smoothK - 1) as Series);
  const hh = A(ta.highest(S(high), lenK));
  const ll = A(ta.lowest(S(low), lenK));
  const stochPrice = (fk: number, i: number) => (fk * (hh[i] - ll[i])) / 100 + ll[i];
  const stochBands = (level: number, i: number) => {
    const sk = level * lenD - sumSlowK1[i];
    const fk1 = sk * smoothK - sumFastK1[i];
    const fk2 = level * smoothK - sumFastK1[i];
    return [stochPrice(fk1, i), stochPrice(fk2, i)];
  };

  const upper: number[] = new Array(n);
  const lower: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const [x11, x12] = stochBands(stochOb, i);
    const [x21, x22] = stochBands(stochOs, i);
    // Pine math.max / math.min: na when an argument is na
    const stochUb = Math.max(x11, x12);
    const stochLb = Math.min(x21, x22);
    upper[i] = Math.max(stochUb, rsiBand(rsiOb, i));
    lower[i] = Math.max(stochLb, rsiBand(rsiOs, i));
  }
  // osc = ta.stoch(close, max(stochUb, rsiUb), max(stochLb, rsiLb), 1)
  const osc = A(ta.stoch(S(close), S(upper), S(lower), 1));

  const rsi = S(A(ta.rsi(S(close), rsiLength)));
  const sK = S(A(ta.sma(S(fastK), smoothK)));
  const sD = S(A(ta.sma(S(slowK), lenD)));
  const [, , adxS] = ta.dmi(bars, 14, 14);
  const adx = A(adxS);

  const B = (s: Series) => s.toArray().map((v) => v === 1);
  const rsiFall = B(ta.falling(rsi, 1));
  const rsiRise = B(ta.rising(rsi, 1));
  const skFall = B(ta.falling(sK, 1));
  const skRise = B(ta.rising(sK, 1));
  const sdFall = B(ta.falling(sD, 1));
  const sdRise = B(ta.rising(sD, 1));

  const bgRed = String(color.new(color.red, 70));
  const bgGreen = String(color.new(color.green, 70));
  const fillUp = String(color.new(color.red, 20));
  const fillDn = String(color.new(color.green, 20));
  const bgColors: BgColorData[] = [];
  const upColors: string[] = new Array(n);
  const dnColors: string[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const falling = (!cfg.rsiFilter || rsiFall[i]) && (!cfg.stochFilter || (skFall[i] && sdFall[i]));
    const rising = (!cfg.rsiFilter || rsiRise[i]) && (!cfg.stochFilter || (skRise[i] && sdRise[i]));
    const adx1 = i > 0 ? adx[i - 1] : NaN;
    const adxOk = !cfg.adxFilter || (gt(adx[i], cfg.adxThreshold) && gt(adx1, adx[i]));
    const osc1 = i > 0 ? osc[i - 1] : NaN;
    if (adxOk && gt(osc1, 100) && falling) bgColors.push({ time: bars[i].time, color: bgRed, forceOverlay: true });
    else if (adxOk && lt(osc1, 0) && rising) bgColors.push({ time: bars[i].time, color: bgGreen, forceOverlay: true });
    // fill(oscline, obline, osc >= 100 ? red 20 : na); fill(oscline, osline, osc <= 0 ? green 20 : na)
    upColors[i] = ge(osc[i], 100) ? fillUp : 'transparent';
    dnColors[i] = le(osc[i], 0) ? fillDn : 'transparent';
  }

  const P = (f: (i: number) => number, c: string) => bars.map((b, i) => {
    const v = f(i);
    return { time: b.time, value: Number.isFinite(v) ? v : NaN, color: c };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: P(() => 100, color.silver),
      plot1: P(() => 0, color.silver),
      plot2: P((i) => osc[i], color.green),
    },
    fills: [
      { plot1: 'plot2', plot2: 'plot0', colors: upColors },
      { plot1: 'plot2', plot2: 'plot1', colors: dnColors },
    ],
    bgColors,
  };
}

export const RsiStochBandOscillator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
