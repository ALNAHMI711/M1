/**
 * Fractal Strength Oscillator
 *
 * An RSI of the source (optionally smoothed by a moving average of a chosen type) and a "fractal dimension" line.
 * The fractal dimension line is FDI = 1 + (log(MA Length) + log(2)) / log(2 * Length): it only depends on two
 * inputs, so it is a constant line. The RSI trend is 1 above 55 and -1 below 45 (kept in between); the FDI trend
 * is -1 above the trend threshold and 1 below it. The overall trend follows the RSI trend once both trends are set.
 * The FDI line and the bars take the trend colour (bull / bear / gray), the RSI line the RSI trend colour. A
 * horizontal line at 50.
 *
 * Reference: "Fractal Strength Oscillator" by SurgeQuant
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © SurgeQuant
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface FractalStrengthOscillatorInputs {
  /** Source */
  src: SourceType;
  /** FDI length (N) */
  length: number;
  /** FDI trend threshold */
  fdiThreshold: number;
  /** RSI length */
  rsiLength: number;
  /** Smooth the RSI with the moving average */
  useSmoothing: boolean;
  /** Moving average type of the smoothing */
  maType: 'SMA' | 'EMA' | 'DEMA' | 'TEMA' | 'WMA' | 'VWMA' | 'SMMA' | 'HMA' | 'LSMA' | 'ALMA';
  /** Moving average length (also used by the FDI formula) */
  maLength: number;
  /** ALMA sigma */
  sigma: number;
  bullColor: string;
  bearColor: string;
}

export const defaultInputs: FractalStrengthOscillatorInputs = {
  src: 'close',
  length: 20,
  fdiThreshold: 1.45,
  rsiLength: 14,
  useSmoothing: false,
  maType: 'EMA',
  maLength: 14,
  sigma: 5,
  bullColor: '#00ffee',
  bearColor: '#ff0055',
};

const GROUP_FDI = 'FDI Parameters 📊 ';
const GROUP_RSI = 'RSI Parameters 📏';
const GROUP_COLOR = 'Visual Parameters 🎨';

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'length', type: 'int', title: 'Length', defval: 20, group: GROUP_FDI },
  { id: 'fdiThreshold', type: 'float', title: 'Trend Threshold', defval: 1.45, group: GROUP_FDI },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, group: GROUP_RSI },
  { id: 'useSmoothing', type: 'bool', title: 'Use Smoothing', defval: false, group: GROUP_RSI },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA', group: GROUP_RSI,
    options: ['SMA', 'EMA', 'DEMA', 'TEMA', 'WMA', 'VWMA', 'SMMA', 'HMA', 'LSMA', 'ALMA'] },
  { id: 'maLength', type: 'int', title: 'MA Length', defval: 14, group: GROUP_RSI },
  { id: 'sigma', type: 'int', title: 'Sigma', defval: 5, group: GROUP_RSI, tooltip: 'Sigma Period for ALMA' },
  { id: 'bullColor', type: 'color', title: 'Bull Color', defval: '#00ffee', group: GROUP_COLOR },
  { id: 'bearColor', type: 'color', title: 'Bear Color', defval: '#ff0055', group: GROUP_COLOR },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'FDI', color: color.gray, lineWidth: 1 },
  { id: 'plot1', title: 'RSI', color: '#ff0055', lineWidth: 1 },
];

export const metadata = {
  title: 'Fractal Strength Oscillator',
  shortTitle: 'Fractal Strength Oscillator',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<FractalStrengthOscillatorInputs> = {},
): IndicatorResult & { barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const N = cfg.length;
  const length = cfg.maLength;

  // The hh / ll / diffs array / fdi_length code of the Pine source is not used by any output: Pine removes it (no
  // runtime error even with Length 0 or 1, where array.get would be out of bounds), so it is not ported.

  // FDI = 1 + (math.log(length) + math.log(2)) / math.log(2 * N): `length` is the MA Length input
  const FDI = 1 + (Math.log(length) + Math.log(2)) / Math.log(2 * N);

  // RSI and the moving average of calcMovingAverage(ma_type, base_rsi, length, sigma) (called on every bar)
  const baseRsi = A(ta.rsi(getSourceSeries(bars, cfg.src), cfg.rsiLength));
  const rsiS = S(baseRsi);
  let smoothed: number[];
  switch (cfg.maType) {
    case 'SMA':
      smoothed = A(ta.sma(rsiS, length));
      break;
    case 'EMA':
      smoothed = A(ta.ema(rsiS, length));
      break;
    case 'DEMA': {
      const e1 = A(ta.ema(rsiS, length));
      const e2 = A(ta.ema(S(e1), length));
      smoothed = e1.map((v, i) => 2 * v - e2[i]);
      break;
    }
    case 'TEMA': {
      const e1 = A(ta.ema(rsiS, length));
      const e2 = A(ta.ema(S(e1), length));
      const e3 = A(ta.ema(S(e2), length));
      smoothed = e1.map((v, i) => 3 * (v - e2[i]) + e3[i]);
      break;
    }
    case 'WMA':
      // for i = 0 to length - 1: weight = length - i; norm += weight; sum += S[i] * weight; result = sum / norm
      smoothed = baseRsi.map((_v, bi) => {
        let norm = 0.0;
        let sum = 0.0;
        for (let i = 0; i <= length - 1; i++) {
          const weight = length - i;
          norm = norm + weight;
          sum = sum + (bi - i >= 0 ? baseRsi[bi - i] : NaN) * weight;
        }
        return sum / norm;
      });
      break;
    case 'VWMA':
      smoothed = A(ta.vwma(rsiS, length, S(bars.map((b) => b.volume ?? NaN))));
      break;
    case 'SMMA':
      smoothed = A(ta.rma(rsiS, length));
      break;
    case 'HMA':
      if (length === 1 && n > 0) throw new Error("Invalid value of the 'length' argument (0.0) in the 'wma' function. It must be > 0.");
      smoothed = A(ta.hma(rsiS, length));
      break;
    case 'LSMA':
      smoothed = A(ta.linreg(rsiS, length, 0));
      break;
    case 'ALMA':
      smoothed = A(ta.alma(rsiS, length, 0.85, cfg.sigma));
      break;
    default:
      smoothed = new Array(n).fill(NaN);
  }
  const standardRsi = cfg.useSmoothing ? smoothed : baseRsi;

  const gray = color.gray;
  const fdiPlot: { time: number; value: number; color: string }[] = [];
  const rsiPlot: { time: number; value: number; color: string }[] = [];
  const barColors: BarColorData[] = [];
  let rsiTrend = 0; // var int RSItrend = 0
  let fdiTrend = 0; // var int FDItrend = 0
  let trend = 0; // var int Trend = 0
  let col: string = gray; // var col = color.gray
  for (let i = 0; i < n; i++) {
    const r = standardRsi[i];
    if (lt(r, 45)) rsiTrend = -1;
    if (gt(r, 55)) rsiTrend = 1;
    if (gt(FDI, cfg.fdiThreshold)) fdiTrend = -1;
    if (lt(FDI, cfg.fdiThreshold)) fdiTrend = 1;
    if (rsiTrend === 1 && fdiTrend === 1) trend = 1;
    if (rsiTrend === 1 && fdiTrend === -1) trend = 1;
    if (rsiTrend === -1 && fdiTrend === -1) trend = -1;
    if (rsiTrend === -1 && fdiTrend === 1) trend = -1;
    if (trend === 1) col = cfg.bullColor;
    if (trend === -1) col = cfg.bearColor;
    if (trend === 0) col = gray;

    const t = bars[i].time;
    fdiPlot.push({ time: t, value: Number.isFinite(FDI) ? FDI : NaN, color: col });
    rsiPlot.push({ time: t, value: r, color: rsiTrend === 1 ? cfg.bullColor : cfg.bearColor });
    barColors.push({ time: t, color: col });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: fdiPlot, plot1: rsiPlot },
    // hline(50, color = color.gray): default dashed, width 1
    hlines: [{ value: 50, options: { title: 'Level', color: gray, linestyle: 'dashed', linewidth: 1 } }],
    barColors,
  };
}

export const FractalStrengthOscillator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
