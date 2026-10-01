/**
 * Multi-Oscillator Adaptive Kernel
 *
 * The mean of the selected oscillators, each scaled to about -100..100: (RSI - 50) x 2, (SMA(3) of the stochastic
 * - 50) x 2, (MFI of hlc3 - 50) x 2 and CCI / 4. A kernel smoother (weights exp(-5 i / L), 1 - i / L or
 * exp(-0.5 (3 i / L)^2) for the last L values) gives the signal line; the same kernel over 2 L smooths the signal.
 * The smoothed signal is drawn as ten layers (100 % to 10 % of its value) with fills of growing transparency down to
 * zero, cyan above zero, magenta below. The bars take the colour of the smoothed signal side.
 *
 * Reference: "Multi-Oscillator Adaptive Kernel | Opus" by AlphaNatt
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface MultiOscillatorAdaptiveKernelInputs {
  src: SourceType;
  useRsi: boolean;
  useStoch: boolean;
  useMfi: boolean;
  useCci: boolean;
  lenRsi: number;
  lenStoch: number;
  lenMfi: number;
  lenCci: number;
  kernelType: 'Exponential' | 'Linear' | 'Gaussian';
  kernelLen: number;
  /** Not used in the calculation (as in the Pine script) */
  sensitivity: number;
  barColoring: boolean;
}

export const defaultInputs: MultiOscillatorAdaptiveKernelInputs = {
  src: 'close',
  useRsi: true,
  useStoch: true,
  useMfi: true,
  useCci: false,
  lenRsi: 14,
  lenStoch: 14,
  lenMfi: 14,
  lenCci: 20,
  kernelType: 'Exponential',
  kernelLen: 25,
  sensitivity: 1.5,
  barColoring: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'useRsi', type: 'bool', title: 'RSI', defval: true },
  { id: 'useStoch', type: 'bool', title: 'Stochastic', defval: true },
  { id: 'useMfi', type: 'bool', title: 'MFI', defval: true },
  { id: 'useCci', type: 'bool', title: 'CCI', defval: false },
  { id: 'lenRsi', type: 'int', title: 'RSI Length', defval: 14 },
  { id: 'lenStoch', type: 'int', title: 'Stochastic Length', defval: 14 },
  { id: 'lenMfi', type: 'int', title: 'MFI Length', defval: 14 },
  { id: 'lenCci', type: 'int', title: 'CCI Length', defval: 20 },
  { id: 'kernelType', type: 'string', title: 'Kernel Type', defval: 'Exponential', options: ['Exponential', 'Linear', 'Gaussian'] },
  { id: 'kernelLen', type: 'int', title: 'Kernel Length', defval: 25 },
  { id: 'sensitivity', type: 'float', title: 'Sensitivity', defval: 1.5, min: 0.1, max: 5.0, step: 0.1 },
  { id: 'barColoring', type: 'bool', title: 'Color Bars', defval: true },
];

const BULL = '#00F1FF';
const BEAR = '#FF019A';
/** Transparency of layer k (1..10): 0, 10, ..., 90 */
const layerColor = (base: string, k: number) => (k === 1 ? base : String(color.new(base, (k - 1) * 10)));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Zero Line', color: String(color.new(color.gray, 50)), lineWidth: 1 },
  { id: 'plot1', title: 'Signal Line', color: String(color.new(BULL, 70)), lineWidth: 1 },
  ...Array.from({ length: 10 }, (_v, j) => ({
    id: `plot${2 + j}`, title: `P${j + 1}`, color: layerColor(BULL, j + 1), lineWidth: j === 0 ? 2 : 1,
  })),
  ...Array.from({ length: 10 }, (_v, j) => ({
    id: `plot${12 + j}`, title: `N${j + 1}`, color: layerColor(BEAR, j + 1), lineWidth: j === 0 ? 2 : 1,
  })),
];

export const metadata = {
  title: 'Multi-Oscillator Adaptive Kernel | Opus',
  shortTitle: 'Multi-Oscillator Adaptive Kernel | Opus',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** kernel_weight(i, len, type) */
function kernelWeight(i: number, len: number, type: string): number {
  if (type === 'Exponential') return Math.exp((-5.0 * i) / len);
  if (type === 'Linear') return 1.0 - i / len;
  if (type === 'Gaussian') return Math.exp(-0.5 * Math.pow((3.0 * i) / len, 2));
  return 0.0;
}

/** smooth_value(src, len, type): kernel-weighted mean of src[0 .. min(len - 1, bar_index)] (na with an na value) */
function smoothValue(src: number[], len: number, type: string): number[] {
  return src.map((_v, b) => {
    let sum = 0.0;
    let weightSum = 0.0;
    for (let i = 0; i <= Math.min(len - 1, b); i++) {
      const w = kernelWeight(i, len, type);
      sum += src[b - i] * w;
      weightSum += w;
    }
    // The weight of i = 0 is 1: weightSum >= 1, the 0 test is never true
    return weightSum === 0 ? NaN : sum / weightSum;
  });
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MultiOscillatorAdaptiveKernelInputs> = {},
): IndicatorResult & { barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const src = getSourceSeries(bars, cfg.src);
  const high = S(bars.map((b) => b.high));
  const low = S(bars.map((b) => b.low));

  // var rsi_val / stoch_val / mfi_val / cci_val = 0.0: an oscillator that is off stays 0
  const zero = new Array(n).fill(0);
  const rsiVal = cfg.useRsi ? A(ta.rsi(src, cfg.lenRsi)).map((r) => (r - 50) * 2) : zero;
  const stochVal = cfg.useStoch
    ? A(ta.sma(ta.stoch(src, high, low, cfg.lenStoch), 3)).map((k) => (k - 50) * 2) : zero;
  const mfiVal = cfg.useMfi
    ? A(ta.mfi(S(bars.map((b) => (b.high + b.low + b.close) / 3)), cfg.lenMfi, S(bars.map((b) => b.volume ?? NaN))))
      .map((m) => (m - 50) * 2)
    : zero;
  const cciVal = cfg.useCci ? A(ta.cci(src, cfg.lenCci)).map((c) => c / 4) : zero;
  const activeCount = [cfg.useRsi, cfg.useStoch, cfg.useMfi, cfg.useCci].filter(Boolean).length;
  const rawValue = bars.map((_b, i) => (rsiVal[i] + stochVal[i] + mfiVal[i] + cciVal[i]) / Math.max(activeCount, 1));

  const signal = smoothValue(rawValue, cfg.kernelLen, cfg.kernelType);
  const signal2 = smoothValue(signal, cfg.kernelLen * 2, cfg.kernelType);

  const t = (i: number) => bars[i].time;
  const plots: Record<string, { time: number; value: number; color?: string }[]> = {};
  const zeroCol = String(color.new(color.gray, 50));
  plots.plot0 = bars.map((_b, i) => ({ time: t(i), value: 0, color: zeroCol }));
  const sigUp = String(color.new(BULL, 70));
  const sigDown = String(color.new(BEAR, 70));
  plots.plot1 = bars.map((_b, i) => ({ time: t(i), value: signal[i], color: gt(signal[i], 0) ? sigUp : sigDown }));
  for (let j = 0; j < 10; j++) {
    const k = (10 - j) / 10; // 1, 0.9, ..., 0.1
    const pc = layerColor(BULL, j + 1);
    const nc = layerColor(BEAR, j + 1);
    // plot(signal2 > 0 ? signal2 * k : 0) / plot(signal2 < 0 ? signal2 * k : 0)
    plots[`plot${2 + j}`] = bars.map((_b, i) => ({
      time: t(i), value: gt(signal2[i], 0) ? (j === 0 ? signal2[i] : signal2[i] * k) : 0, color: pc,
    }));
    plots[`plot${12 + j}`] = bars.map((_b, i) => ({
      time: t(i), value: lt(signal2[i], 0) ? (j === 0 ? signal2[i] : signal2[i] * k) : 0, color: nc,
    }));
  }

  // fill(layer k, layer k + 1 (layer 10: zero line), signal2 > 0 ? color.new(bull_color, 5 + 10 (k - 1)) : na)
  const fills: { plot1: string; plot2: string; colors: string[] }[] = [];
  for (const [first, base, on] of [[2, BULL, gt], [12, BEAR, lt]] as const) {
    for (let j = 0; j < 10; j++) {
      const c = String(color.new(base, 5 + 10 * j));
      fills.push({
        plot1: `plot${first + j}`, plot2: j === 9 ? 'plot0' : `plot${first + j + 1}`,
        colors: signal2.map((v) => (on(v, 0) ? c : 'transparent')),
      });
    }
  }

  // barcolor(bar_coloring ? (signal2 > 0 ? bull_color : bear_color) : na)
  const barColors: BarColorData[] = cfg.barColoring
    ? bars.map((_b, i) => ({ time: t(i), color: gt(signal2[i], 0) ? BULL : BEAR }))
    : [];

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills,
    barColors,
  };
}

export const MultiOscillatorAdaptiveKernel = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
