/**
 * Adaptive RSI | Lyro RS
 *
 * ARSI: the RSI distance from 50 scaled to -100..100 (new calculation) or the fast EMA minus the slow EMA of the RSI
 * (old calculation), drawn as columns with an EMA signal line. Bands: the stdev of the ARSI times the upper / lower
 * multipliers (new bands) or the SMA of the ARSI plus these (old bands), eased with the previous raw band. The column
 * and bar colour follow the signal type (trend following, strong trend following, reversion, volatility spectrum),
 * or the ARSI sign with the old calculation.
 *
 * Reference: "Adaptive RSI | Lyro RS" by LyroRS
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface AdaptiveRsiLyroRsInputs {
  signalType: 'Trend Following' | 'Strong Trend Following' | 'Reversion' | 'Volatility Spectrum';
  calcStyle: 'New Calculation' | 'Old Calculation';
  bandsStyle: 'New Bands' | 'Old Bands';
  src: SourceType;
  rsiLength: number;
  /** EMA length of the signal line */
  signalLength: number;
  /** Fast EMA of the RSI (old calculation) */
  emaShort: number;
  /** Slow EMA of the RSI (old calculation) */
  emaLong: number;
  /** SMA / stdev length of the bands */
  bbLength: number;
  upperbandMult: number;
  lowerbandMult: number;
  /** Weight of the current raw band (0-2) */
  bandEasing: number;
  /** Colour palette ('Major Themes' has no colours in the script: na) */
  colMode: 'Classic' | 'Mystic' | 'Major Themes' | 'Accented' | 'Royal';
  useCustomPalette: boolean;
  customUp: string;
  customDown: string;
}

export const defaultInputs: AdaptiveRsiLyroRsInputs = {
  signalType: 'Trend Following',
  calcStyle: 'New Calculation',
  bandsStyle: 'New Bands',
  src: 'close',
  rsiLength: 20,
  signalLength: 15,
  emaShort: 14,
  emaLong: 22,
  bbLength: 22,
  upperbandMult: 0.6,
  lowerbandMult: -0.9,
  bandEasing: 0.6,
  colMode: 'Mystic',
  useCustomPalette: false,
  customUp: '#00ff00',
  customDown: '#ff0000',
};

export const inputConfig: InputConfig[] = [
  { id: 'signalType', type: 'string', title: 'Signal Type', defval: 'Trend Following',
    options: ['Trend Following', 'Strong Trend Following', 'Reversion', 'Volatility Spectrum'] },
  { id: 'calcStyle', type: 'string', title: 'Calculation Style', defval: 'New Calculation', options: ['New Calculation', 'Old Calculation'] },
  { id: 'bandsStyle', type: 'string', title: 'Bands Style', defval: 'New Bands', options: ['New Bands', 'Old Bands'] },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 20 },
  { id: 'signalLength', type: 'int', title: 'Signal Smoothing', defval: 15 },
  { id: 'emaShort', type: 'int', title: 'Fast EMA Smoothing', defval: 14 },
  { id: 'emaLong', type: 'int', title: 'Slow EMA Smoothing', defval: 22 },
  { id: 'bbLength', type: 'int', title: 'Band Length', defval: 22 },
  { id: 'upperbandMult', type: 'float', title: 'Upperband Multiplier', defval: 0.6, min: 0 },
  { id: 'lowerbandMult', type: 'float', title: 'Loweband Multiplier', defval: -0.9, max: 0 },
  { id: 'bandEasing', type: 'float', title: 'Band Smoothing (0-2)', defval: 0.6, min: 0, max: 2 },
  { id: 'colMode', type: 'string', title: 'Custom Color Palette', defval: 'Mystic',
    options: ['Classic', 'Mystic', 'Major Themes', 'Accented', 'Royal'] },
  { id: 'useCustomPalette', type: 'bool', title: 'Use Custom Palette', defval: false },
  { id: 'customUp', type: 'color', title: 'Custom Up', defval: '#00ff00' },
  { id: 'customDown', type: 'color', title: 'Custom Down', defval: '#ff0000' },
];

const BAND_FILL = String(color.new(color.teal, 85));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ARSI', color: '#30FDCF', lineWidth: 2, style: 'columns' },
  { id: 'plot1', title: 'Signal Line', color: color.white, lineWidth: 1 },
  // plot(upperBand, "Upper Band") / plot(lowerBand, "Lower Band"): Pine default colour
  { id: 'plot2', title: 'Upper Band', color: color.blue, lineWidth: 1 },
  { id: 'plot3', title: 'Lower Band', color: color.blue, lineWidth: 1 },
];

export const metadata = {
  title: 'Adaptive RSI | Lyro RS',
  shortTitle: 'ARSI | 𝓛𝔂𝓻𝓸 𝓡𝓢',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const nz = (x: number) => (Number.isNaN(x) ? 0 : x);

const PALETTES: Record<string, [string, string] | undefined> = {
  Classic: ['#00E676', '#880E4F'],
  Mystic: ['#30FDCF', '#E117B7'],
  Accented: ['#9618F7', '#FF0078'],
  Royal: ['#FFC107', '#673AB7'],
};

export function calculate(
  bars: Bar[],
  inputs: Partial<AdaptiveRsiLyroRsInputs> = {},
): IndicatorResult & { barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  // Colours: no switch case for "Major Themes" (UpC / DnC stay na); null = na
  let upC: string | null = PALETTES[cfg.colMode]?.[0] ?? null;
  let dnC: string | null = PALETTES[cfg.colMode]?.[1] ?? null;
  if (cfg.useCustomPalette) {
    upC = cfg.customUp;
    dnC = cfg.customDown;
  }

  const rsiRaw = A(ta.rsi(getSourceSeries(bars, cfg.src), cfg.rsiLength));
  const rsiEmaFast = A(ta.ema(S(rsiRaw), cfg.emaShort));
  const rsiEmaSlow = A(ta.ema(S(rsiRaw), cfg.emaLong));
  const newCalc = cfg.calcStyle === 'New Calculation';
  const arsi = rsiRaw.map((r, i) => (newCalc ? ((r - 50) / 50) * 100 : rsiEmaFast[i] - rsiEmaSlow[i]));

  const basis = A(ta.sma(S(arsi), cfg.bbLength));
  const std = A(ta.stdev(S(arsi), cfg.bbLength));
  const signal = A(ta.ema(S(arsi), cfg.signalLength));
  const rawBand = (mult: number) => basis.map((b, i) => (cfg.bandsStyle === 'New Bands' ? std[i] * mult
    : cfg.bandsStyle === 'Old Bands' ? b + std[i] * mult : NaN));
  const rawUb = rawBand(cfg.upperbandMult);
  const rawLb = rawBand(cfg.lowerbandMult);
  // upperBand := raw_ub * bandEasing + nz(raw_ub[1]) * (1 - bandEasing)
  const ease = (raw: number[]) => raw.map((r, i) => r * cfg.bandEasing + nz(i > 0 ? raw[i - 1] : NaN) * (1 - cfg.bandEasing));
  const upperBand = ease(rawUb);
  const lowerBand = ease(rawLb);

  const pcArr: Array<string | null> = new Array(n);
  let pc: string | null = null; // var color pc = na
  for (let i = 0; i < n; i++) {
    const a = arsi[i];
    const s = signal[i];
    const ub = upperBand[i];
    const lb = lowerBand[i];
    if (newCalc) {
      if (cfg.signalType === 'Trend Following') {
        if (gt(a, ub)) pc = upC;
        else if (lt(a, lb)) pc = dnC;
      } else if (cfg.signalType === 'Strong Trend Following') {
        if (gt(s, ub)) pc = upC;
        else if (lt(s, lb)) pc = dnC;
        else if (lt(a, ub) && gt(a, lb)) pc = color.gray;
      } else if (cfg.signalType === 'Reversion') {
        if (gt(a, ub) && gt(s, a)) pc = dnC;
        else if (lt(a, lb) && lt(s, a)) pc = upC;
        else pc = color.gray;
      } else if (cfg.signalType === 'Volatility Spectrum') {
        if (gt(a, s) && gt(a, ub)) pc = upC;
        else if (lt(a, s) && lt(a, lb)) pc = dnC;
        else pc = color.gray;
      }
    } else if (cfg.calcStyle === 'Old Calculation') {
      if (gt(a, 0)) pc = upC;
      else if (lt(a, 0)) pc = dnC;
    }
    pcArr[i] = pc;
  }

  const t = (i: number) => bars[i].time;
  const barColors: BarColorData[] = [];
  for (let i = 0; i < n; i++) {
    const c = pcArr[i];
    if (c !== null) barColors.push({ time: t(i), color: c });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      // plot(arsi, "ARSI", color = pc, linewidth = 2, style = plot.style_columns): na colour draws no column
      plot0: bars.map((_b, i) => ({ time: t(i), value: arsi[i], color: pcArr[i] ?? 'transparent' })),
      plot1: bars.map((_b, i) => ({ time: t(i), value: signal[i], color: color.white })),
      plot2: bars.map((_b, i) => ({ time: t(i), value: upperBand[i], color: color.blue })),
      plot3: bars.map((_b, i) => ({ time: t(i), value: lowerBand[i], color: color.blue })),
    },
    hlines: [{ value: 0, options: { title: 'Zero Line', color: color.gray, linestyle: 'dashed', linewidth: 1 } }],
    fills: [{ plot1: 'plot2', plot2: 'plot3', options: { title: 'Band Fill', color: BAND_FILL } }],
    barColors,
  };
}

export const AdaptiveRsiLyroRs = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
