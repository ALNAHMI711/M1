/**
 * MACD with MFI & OBV (VWMACD-MFI-OBV Composite)
 *
 * A volume-weighted MACD: the difference of a fast and a slow VWMA of the close, with an EMA (or SMA) signal line.
 * The background is green when the MACD is above its signal, red otherwise. The Money Flow Index of hlc3 is plotted,
 * with the On Balance Volume normalised to 0-100 over the last 100 bars ((obv - lowest) / (highest - lowest)). The
 * combined line is the average of the normalised MACD (same normalisation), the MFI and the normalised OBV.
 * Horizontal lines at 0, at the overbought / oversold inputs, and dotted lines at 20, 80 and 50.
 *
 * Reference: "VWMACD-MFI-OBV Composite" by munair
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © munair; @author Striketarget Development Squad, @copyright Virtuous Finance LLC
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';

export interface VwmacdMfiObvCompositeInputs {
  /** Fast VWMA length of the MACD */
  fastLength: number;
  /** Slow VWMA length of the MACD */
  slowLength: number;
  /** Signal line length */
  signalLength: number;
  /** SMA instead of EMA for the signal line */
  smaSignal: boolean;
  /** MFI length */
  mfiLength: number;
  /** MFI overbought level */
  mfiOb: number;
  /** MFI oversold level */
  mfiOs: number;
}

export const defaultInputs: VwmacdMfiObvCompositeInputs = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  smaSignal: false,
  mfiLength: 14,
  mfiOb: 80,
  mfiOs: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'MACD Fast Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'MACD Slow Length', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'MACD Signal Smoothing', defval: 9, min: 1 },
  { id: 'smaSignal', type: 'bool', title: 'Simple MA (Signal Line)', defval: false },
  { id: 'mfiLength', type: 'int', title: 'MFI Length', defval: 14, min: 1 },
  { id: 'mfiOb', type: 'int', title: 'MFI Overbought', defval: 80, min: 50, max: 100 },
  { id: 'mfiOs', type: 'int', title: 'MFI Oversold', defval: 20, min: 0, max: 50 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MFI', color: color.purple, lineWidth: 2 },
  { id: 'plot1', title: 'Combined', color: color.yellow, lineWidth: 2 },
  { id: 'plot2', title: 'OBV', color: color.white, lineWidth: 1 },
];

export const metadata = {
  title: 'MACD with MFI & OBV',
  shortTitle: 'MACD-MFI-OBV',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const finite = (x: number) => (Number.isFinite(x) ? x : NaN);

export function calculate(
  bars: Bar[],
  inputs: Partial<VwmacdMfiObvCompositeInputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const closeS = S(bars.map((b) => b.close));
  const volumeS = S(bars.map((b) => b.volume ?? NaN));

  // Volume-weighted MACD
  const fastMa = A(ta.vwma(closeS, cfg.fastLength, volumeS));
  const slowMa = A(ta.vwma(closeS, cfg.slowLength, volumeS));
  const macd = fastMa.map((v, i) => v - slowMa[i]);
  // sma_signal is a constant input: one branch runs on every bar
  const signal = cfg.smaSignal ? A(ta.sma(S(macd), cfg.signalLength)) : A(ta.ema(S(macd), cfg.signalLength));

  // MFI of hlc3
  const mfi = A(ta.mfi(S(bars.map((b) => (b.high + b.low + b.close) / 3)), cfg.mfiLength, volumeS));

  // norm = 100 * (x - ta.lowest(x, 100)) / (ta.highest(x, 100) - ta.lowest(x, 100)): x / 0 is +-infinity (plot na)
  const normalise = (x: number[]) => {
    const lo = A(ta.lowest(S(x), 100));
    const hi = A(ta.highest(S(x), 100));
    return x.map((v, i) => (100 * (v - lo[i])) / (hi[i] - lo[i]));
  };
  const obv = A(ta.obv(bars));
  const normObv = normalise(obv);
  const normMacd = normalise(macd);

  const bullBg = String(color.new(color.green, 90));
  const bearBg = String(color.new(color.red, 90));
  const plot0 = [];
  const plot1 = [];
  const plot2 = [];
  const bgColors: BgColorData[] = [];
  for (let i = 0; i < n; i++) {
    const time = bars[i].time;
    const combined = (normMacd[i] + mfi[i] + normObv[i]) / 3;
    plot0.push({ time, value: finite(mfi[i]), color: color.purple });
    plot1.push({ time, value: finite(combined), color: color.yellow });
    plot2.push({ time, value: finite(normObv[i]), color: color.white });
    bgColors.push({ time, color: gt(macd[i], signal[i]) ? bullBg : bearBg });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2 },
    hlines: [
      { value: 0, options: { title: 'Zero Line', color: String(color.new('#787B86', 50)), linestyle: 'dashed' } },
      { value: cfg.mfiOb, options: { title: 'Overbought', color: String(color.new(color.red, 50)), linestyle: 'dashed' } },
      { value: cfg.mfiOs, options: { title: 'Oversold', color: String(color.new(color.green, 50)), linestyle: 'dashed' } },
      { value: 20, options: { title: 'MFI Oversold Line', color: String(color.new(color.green, 50)), linestyle: 'dotted' } },
      { value: 80, options: { title: 'MFI Overbought Line', color: String(color.new(color.red, 50)), linestyle: 'dotted' } },
      { value: 50, options: { title: 'MFI Midpoint', color: String(color.new(color.gray, 70)), linestyle: 'dotted' } },
    ],
    bgColors,
  };
}

export const VwmacdMfiObvComposite = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
