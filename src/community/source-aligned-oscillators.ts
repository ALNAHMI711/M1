/**
 * Source-Aligned Oscillators (for Divergences)
 *
 * One oscillator (RSI, ROC, Momentum, MACD histogram, CMO or Stoch RSI %K) computed on a source chosen by the source
 * mode. The split modes compute it twice: a bullish line on the low (or the body low) and a bearish line on the high
 * (or the body high), to read divergences against the matching price extreme. Stoch RSI adds %D lines (SMA of %K).
 * Reference lines: the midline (0 or 50), 70 / 30 for the RSI family, +50 / -50 for CMO.
 *
 * Reference: "Oscillators for Divergences" by QuantNomad
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export type SourceAlignedOscType = 'RSI' | 'ROC' | 'Momentum' | 'MACD' | 'CMO' | 'Stoch RSI';
export type SourceAlignedSrcMode = 'Close' | 'HL2' | 'HLC3' | 'OHLC4' | 'High/Low Split' | 'Body High/Low Split';

export interface SourceAlignedOscillatorsInputs {
  oscType: SourceAlignedOscType;
  srcMode: SourceAlignedSrcMode;
  showBull: boolean;
  showBear: boolean;
  showStochD: boolean;
  rsiLen: number;
  rocLen: number;
  momLen: number;
  cmoLen: number;
  stochLen: number;
  smoothK: number;
  smoothD: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
}

export const defaultInputs: SourceAlignedOscillatorsInputs = {
  oscType: 'RSI',
  srcMode: 'Close',
  showBull: true,
  showBear: true,
  showStochD: true,
  rsiLen: 14,
  rocLen: 14,
  momLen: 10,
  cmoLen: 14,
  stochLen: 14,
  smoothK: 3,
  smoothD: 3,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'oscType', type: 'string', title: 'Oscillator', defval: 'RSI', options: ['RSI', 'ROC', 'Momentum', 'MACD', 'CMO', 'Stoch RSI'] },
  { id: 'srcMode', type: 'string', title: 'Source Mode', defval: 'Close', options: ['Close', 'HL2', 'HLC3', 'OHLC4', 'High/Low Split', 'Body High/Low Split'] },
  { id: 'showBull', type: 'bool', title: 'Show Bullish Line', defval: true },
  { id: 'showBear', type: 'bool', title: 'Show Bearish Line', defval: true },
  { id: 'showStochD', type: 'bool', title: 'Show Stoch RSI %D', defval: true },
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'rocLen', type: 'int', title: 'ROC Length', defval: 14, min: 1 },
  { id: 'momLen', type: 'int', title: 'Momentum Length', defval: 10, min: 1 },
  { id: 'cmoLen', type: 'int', title: 'CMO Length', defval: 14, min: 1 },
  { id: 'stochLen', type: 'int', title: 'Stoch RSI Length', defval: 14, min: 1 },
  { id: 'smoothK', type: 'int', title: 'Stoch RSI %K Smoothing', defval: 3, min: 1 },
  { id: 'smoothD', type: 'int', title: 'Stoch RSI %D Smoothing', defval: 3, min: 1 },
  { id: 'macdFast', type: 'int', title: 'Fast Length', defval: 12, min: 1 },
  { id: 'macdSlow', type: 'int', title: 'Slow Length', defval: 26, min: 1 },
  { id: 'macdSignal', type: 'int', title: 'Signal Length', defval: 9, min: 1 },
];

const MID_COL = String(color.new(color.gray, 60));
const RSI_LEVEL_COL = String(color.new(color.gray, 80));
const CMO_LEVEL_COL = String(color.new(color.gray, 85));
const OSC_COL = String(color.new(color.aqua, 0));
const BULL_COL = String(color.new(color.lime, 0));
const BEAR_COL = String(color.new(color.red, 0));
const D_COL = String(color.new(color.orange, 0));
const D_BULL_COL = String(color.new(color.green, 50));
const D_BEAR_COL = String(color.new(color.maroon, 50));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Midline', color: MID_COL, lineWidth: 1 },
  { id: 'plot1', title: 'Upper 70', color: RSI_LEVEL_COL, lineWidth: 1 },
  { id: 'plot2', title: 'Lower 30', color: RSI_LEVEL_COL, lineWidth: 1 },
  { id: 'plot3', title: 'CMO +50', color: CMO_LEVEL_COL, lineWidth: 1 },
  { id: 'plot4', title: 'CMO -50', color: CMO_LEVEL_COL, lineWidth: 1 },
  { id: 'plot5', title: 'Oscillator', color: OSC_COL, lineWidth: 2 },
  { id: 'plot6', title: 'Bullish Source Line', color: BULL_COL, lineWidth: 2 },
  { id: 'plot7', title: 'Bearish Source Line', color: BEAR_COL, lineWidth: 2 },
  { id: 'plot8', title: 'Stoch RSI %D', color: D_COL, lineWidth: 1 },
  { id: 'plot9', title: 'Stoch RSI %D Bull', color: D_BULL_COL, lineWidth: 1 },
  { id: 'plot10', title: 'Stoch RSI %D Bear', color: D_BEAR_COL, lineWidth: 1 },
];

export const metadata = {
  title: 'Oscillators for Divergences',
  shortTitle: 'OscDiv',
  overlay: false,
};

/** Pine a != b: false when the values are within 1e-10 or one is na */
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > 1e-10;

export function calculate(bars: Bar[], inputs: Partial<SourceAlignedOscillatorsInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  const isSplitSource = cfg.srcMode === 'High/Low Split' || cfg.srcMode === 'Body High/Low Split';
  const pick = (b: Bar, split: 'bull' | 'bear'): number => {
    switch (cfg.srcMode) {
      case 'HL2': return (b.high + b.low) / 2;
      case 'HLC3': return (b.high + b.low + b.close) / 3;
      case 'OHLC4': return (b.open + b.high + b.low + b.close) / 4;
      case 'High/Low Split': return split === 'bull' ? b.low : b.high;
      case 'Body High/Low Split': return split === 'bull' ? Math.min(b.open, b.close) : Math.max(b.open, b.close);
      default: return b.close;
    }
  };

  // f_get_osc(_src): the oscillator type is fixed for the run, so each ta.* call runs on every bar
  const getOsc = (srcArr: number[]): number[] => {
    const src = S(srcArr);
    switch (cfg.oscType) {
      case 'RSI': return A(ta.rsi(src, cfg.rsiLen));
      case 'ROC': return A(ta.roc(src, cfg.rocLen));
      case 'Momentum': return A(ta.mom(src, cfg.momLen));
      case 'MACD': {
        const fast = A(ta.ema(src, cfg.macdFast));
        const slow = A(ta.ema(src, cfg.macdSlow));
        const macdLine = fast.map((f, i) => f - slow[i]);
        const signalLine = A(ta.ema(S(macdLine), cfg.macdSignal));
        return macdLine.map((m, i) => m - signalLine[i]);
      }
      case 'CMO': return A(ta.cmo(src, cfg.cmoLen));
      case 'Stoch RSI': {
        const rsiValue = A(ta.rsi(src, cfg.rsiLen));
        const lowestRsi = A(ta.lowest(S(rsiValue), cfg.stochLen));
        const highestRsi = A(ta.highest(S(rsiValue), cfg.stochLen));
        // rawK = highestRsi != lowestRsi ? 100 * (rsiValue - lowestRsi) / (highestRsi - lowestRsi) : na
        const rawK = rsiValue.map((r, i) => (ne(highestRsi[i], lowestRsi[i])
          ? (100 * (r - lowestRsi[i])) / (highestRsi[i] - lowestRsi[i]) : NaN));
        return A(ta.sma(S(rawK), cfg.smoothK));
      }
      default: return new Array(n).fill(NaN);
    }
  };

  const bullOsc = getOsc(bars.map((b) => pick(b, 'bull')));
  const bearOsc = getOsc(bars.map((b) => pick(b, 'bear')));
  const isStoch = cfg.oscType === 'Stoch RSI';
  const stochBullD = isStoch ? A(ta.sma(S(bullOsc), cfg.smoothD)) : new Array(n).fill(NaN);
  const stochBearD = isStoch ? A(ta.sma(S(bearOsc), cfg.smoothD)) : new Array(n).fill(NaN);

  const isRsiFamily = cfg.oscType === 'RSI' || isStoch;
  const isCMO = cfg.oscType === 'CMO';
  const isZeroBased = cfg.oscType === 'ROC' || cfg.oscType === 'Momentum' || cfg.oscType === 'MACD' || isCMO;
  const midValue = isZeroBased ? 0.0 : 50.0;

  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const line = (col: string, f: (i: number) => number) => bars.map((b, i) => ({ time: b.time, value: fin(f(i)), color: col }));
  const showOsc = !isSplitSource && cfg.showBull;
  const showBullLine = isSplitSource && cfg.showBull;
  const showBearLine = isSplitSource && cfg.showBear;
  const showD = isStoch && cfg.showStochD;

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: line(MID_COL, () => midValue),
      plot1: line(RSI_LEVEL_COL, () => (isRsiFamily ? 70 : NaN)),
      plot2: line(RSI_LEVEL_COL, () => (isRsiFamily ? 30 : NaN)),
      plot3: line(CMO_LEVEL_COL, () => (isCMO ? 50 : NaN)),
      plot4: line(CMO_LEVEL_COL, () => (isCMO ? -50 : NaN)),
      plot5: line(OSC_COL, (i) => (showOsc ? bullOsc[i] : NaN)),
      plot6: line(BULL_COL, (i) => (showBullLine ? bullOsc[i] : NaN)),
      plot7: line(BEAR_COL, (i) => (showBearLine ? bearOsc[i] : NaN)),
      plot8: line(D_COL, (i) => (showD && !isSplitSource && cfg.showBull ? stochBullD[i] : NaN)),
      plot9: line(D_BULL_COL, (i) => (showD && isSplitSource && cfg.showBull ? stochBullD[i] : NaN)),
      plot10: line(D_BEAR_COL, (i) => (showD && isSplitSource && cfg.showBear ? stochBearD[i] : NaN)),
    },
  };
}

export const SourceAlignedOscillators = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
