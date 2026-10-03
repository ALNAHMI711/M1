/**
 * Cabal Dev Indicator
 *
 * A stochastic momentum index (SMI): the close position against the middle of the `Percent K Length` high / low range,
 * rdiff = close - (highest + lowest) / 2, and the range diff = highest - lowest, both smoothed with an EMA of
 * `Percent D Length`; SMI = ema(rdiff) / (ema(diff) / 2) * 100 (0 when ema(diff) is 0 or na). The SMI is smoothed
 * with an SMA of `Smoothing Period` (the "Stochastic" line), and an EMA of `EMA Signal Length` of it is the signal.
 * The parts of the line above the overbought level and below the oversold level are filled.
 *
 * Reference: "Cabal Dev Indicator" by SolanaMemeCoins
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Cabal_Dev_Indicator, Author: Senyor, Release: v2.1
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface CabalDevIndicatorInputs {
  /** Length of the highest high / lowest low range */
  percentKLength: number;
  /** EMA length of the range and of the relative position */
  percentDLength: number;
  /** EMA length of the signal line */
  emaSignalLength: number;
  /** SMA length of the SMI */
  smoothingPeriod: number;
  overbought: number;
  oversold: number;
}

export const defaultInputs: CabalDevIndicatorInputs = {
  percentKLength: 15,
  percentDLength: 3,
  emaSignalLength: 15,
  smoothingPeriod: 5,
  overbought: 40,
  oversold: -40,
};

export const inputConfig: InputConfig[] = [
  { id: 'percentKLength', type: 'int', title: 'Percent K Length', defval: 15, min: 1 },
  { id: 'percentDLength', type: 'int', title: 'Percent D Length', defval: 3, min: 1 },
  { id: 'emaSignalLength', type: 'int', title: 'EMA Signal Length', defval: 15, min: 1 },
  { id: 'smoothingPeriod', type: 'int', title: 'Smoothing Period', defval: 5, min: 1 },
  { id: 'overbought', type: 'float', title: 'Overbought', defval: 40, min: -100, max: 100 },
  { id: 'oversold', type: 'float', title: 'Oversold', defval: -40, min: -100, max: 100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Stochastic', color: color.green, lineWidth: 1 },
  { id: 'plot1', title: 'EMA', color: color.red, lineWidth: 1 },
  { id: 'plot2', title: 'Overbought Level', color: color.blue, lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Overbought SMI', color: color.blue, lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'Oversold Level', color: color.blue, lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Oversold SMI', color: color.blue, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Cabal Dev Indicator',
  shortTitle: 'Cabal_Dev_iNDEX',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
/** Pine `x != y`: false when one side is na, true when they differ by more than 1e-10 */
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;

export function calculate(bars: Bar[], inputs: Partial<CabalDevIndicatorInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  // Range
  const ll = A(ta.lowest(S(bars.map((b) => b.low)), cfg.percentKLength));
  const hh = A(ta.highest(S(bars.map((b) => b.high)), cfg.percentKLength));
  const diff = hh.map((h, i) => h - ll[i]);
  const rdiff = bars.map((b, i) => b.close - (hh[i] + ll[i]) / 2);
  const avgrel = A(ta.ema(S(rdiff), cfg.percentDLength));
  const avgdiff = A(ta.ema(S(diff), cfg.percentDLength));

  // SMI = avgdiff != 0 ? avgrel / (avgdiff / 2) * 100 : 0.0 (plain division, as Pine)
  const smi = avgdiff.map((d, i) => (ne(d, 0) ? (avgrel[i] / (d / 2)) * 100 : 0.0));
  const smiSmoothed = A(ta.sma(S(smi), cfg.smoothingPeriod));
  const emaSignal = A(ta.ema(S(smiSmoothed), cfg.emaSignalLength));

  const ob = cfg.overbought;
  const os = cfg.oversold;
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const t = (i: number) => bars[i].time;
  const plot0 = bars.map((_b, i) => ({ time: t(i), value: fin(smiSmoothed[i]), color: color.green }));
  const plot1 = bars.map((_b, i) => ({ time: t(i), value: fin(emaSignal[i]), color: color.red }));
  // level_obsmi = SMI_smoothed > ob ? SMI_smoothed : ob; level_ossmi = SMI_smoothed < os ? SMI_smoothed : os
  const plot2 = bars.map((_b, i) => ({ time: t(i), value: ob }));
  const plot3 = bars.map((_b, i) => ({ time: t(i), value: fin(gt(smiSmoothed[i], ob) ? smiSmoothed[i] : ob) }));
  const plot4 = bars.map((_b, i) => ({ time: t(i), value: os }));
  const plot5 = bars.map((_b, i) => ({ time: t(i), value: fin(lt(smiSmoothed[i], os) ? smiSmoothed[i] : os) }));

  const obFill = String(color.new(color.red, 60));
  const osFill = String(color.new(color.green, 60));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2, plot3, plot4, plot5 },
    hlines: [
      { value: ob, options: { title: 'Overbought', color: color.gray, linestyle: 'dashed' } },
      { value: os, options: { title: 'Oversold', color: color.gray, linestyle: 'dashed' } },
    ],
    fills: [
      // fill(p1, p2, color = color.new(color.red, 60), title = 'OverBought')
      { plot1: 'plot2', plot2: 'plot3', options: { title: 'OverBought' }, colors: new Array<string>(n).fill(obFill) },
      // fill(p3, p4, color = color.new(color.green, 60), title = 'OverSold')
      { plot1: 'plot4', plot2: 'plot5', options: { title: 'OverSold' }, colors: new Array<string>(n).fill(osFill) },
    ],
  };
}

export const CabalDevIndicator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
