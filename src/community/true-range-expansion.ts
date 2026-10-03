/**
 * True Range eXpansion (TRX)
 *
 * Draws each bar as a candle from its low (open and low) to its high (high and close), coloured by the real bar
 * direction (close >= open: up colour, else down colour). Two moving averages (SMA / EMA / WMA / RMA / HMA) of the
 * high and of the low are moved out by an ATR offset: offset = rma(atr(atrLen), atrSmoothing) * multiplier, times
 * |ATR Adj| for each line (high line up, low line down). The basis is the middle of the two lines.
 *
 * Reference: "True Range eXpansion" by Sherlock_MacGyver
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';

export interface TrueRangeExpansionInputs {
  upColor: string;
  downColor: string;
  /** Candle transparency */
  transp: number;
  showMA: boolean;
  maLen: number;
  maType: 'SMA' | 'EMA' | 'WMA' | 'RMA' | 'HMA';
  atrLen: number;
  atrSmoothing: number;
  atrGlobalMult: number;
  showBasis: boolean;
  basisColor: string;
  /** Basis width (the plot width is static: 2) */
  basisWidth: number;
  basisTransp: number;
  maHighColor: string;
  /** High line width (the plot width is static: 2) */
  maHighWidth: number;
  maHighTransp: number;
  maHighATRMult: number;
  maLowColor: string;
  /** Low line width (the plot width is static: 2) */
  maLowWidth: number;
  maLowTransp: number;
  maLowATRMult: number;
}

export const defaultInputs: TrueRangeExpansionInputs = {
  upColor: color.green,
  downColor: color.red,
  transp: 20,
  showMA: true,
  maLen: 100,
  maType: 'WMA',
  atrLen: 3,
  atrSmoothing: 15,
  atrGlobalMult: 10,
  showBasis: true,
  basisColor: color.silver,
  basisWidth: 2,
  basisTransp: 50,
  maHighColor: color.orange,
  maHighWidth: 2,
  maHighTransp: 50,
  maHighATRMult: 0.5,
  maLowColor: color.blue,
  maLowWidth: 2,
  maLowTransp: 50,
  maLowATRMult: -0.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'upColor', type: 'color', title: 'Up', defval: color.green },
  { id: 'downColor', type: 'color', title: 'Down', defval: color.red },
  { id: 'transp', type: 'int', title: 'Transparency', defval: 20, min: 0, max: 100, step: 10 },
  { id: 'showMA', type: 'bool', title: 'Show High/Low Moving Averages', defval: true },
  { id: 'maLen', type: 'int', title: 'MA Length', defval: 100, min: 1 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'WMA', options: ['SMA', 'EMA', 'WMA', 'RMA', 'HMA'] },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 3, min: 1 },
  { id: 'atrSmoothing', type: 'int', title: 'ATR Smoothing', defval: 15, min: 1 },
  { id: 'atrGlobalMult', type: 'float', title: 'ATR Multiplier', defval: 10, min: 0.0, step: 1 },
  { id: 'showBasis', type: 'bool', title: 'Show Basis', defval: true },
  { id: 'basisColor', type: 'color', title: 'Color', defval: color.silver },
  { id: 'basisWidth', type: 'int', title: 'Width', defval: 2, min: 1, max: 5 },
  { id: 'basisTransp', type: 'int', title: 'Transparency', defval: 50, min: 0, max: 100 },
  { id: 'maHighColor', type: 'color', title: 'Color', defval: color.orange },
  { id: 'maHighWidth', type: 'int', title: 'Width', defval: 2 },
  { id: 'maHighTransp', type: 'int', title: 'Transp', defval: 50 },
  { id: 'maHighATRMult', type: 'float', title: 'ATR Adj ↑', defval: 0.5, step: 0.1 },
  { id: 'maLowColor', type: 'color', title: 'Color', defval: color.blue },
  { id: 'maLowWidth', type: 'int', title: 'Width', defval: 2 },
  { id: 'maLowTransp', type: 'int', title: 'Transp', defval: 50 },
  { id: 'maLowATRMult', type: 'float', title: 'ATR Adj ↓', defval: -0.5, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA of High', color: String(color.new(color.orange, 50)), lineWidth: 2 },
  { id: 'plot1', title: 'MA of Low', color: String(color.new(color.blue, 50)), lineWidth: 2 },
  { id: 'plot2', title: 'Basis', color: String(color.new(color.silver, 50)), lineWidth: 2 },
];

export const metadata = {
  title: 'True Range eXpansion',
  shortTitle: 'TRX',
  overlay: true,
};

/** Pine a >= b: not (b - a > 1e-10), false with na */
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > 1e-10);

export function calculate(
  bars: Bar[],
  inputs: Partial<TrueRangeExpansionInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  // getMA(src, len): switch maType
  const getMA = (src: number[], len: number): number[] => {
    const s = S(src);
    switch (cfg.maType) {
      case 'EMA': return A(ta.ema(s, len));
      case 'WMA': return A(ta.wma(s, len));
      case 'RMA': return A(ta.rma(s, len));
      case 'HMA': {
        // w = ta.wma(src, len / 2); ta.wma(2 * w - ta.wma(src, len), math.round(math.sqrt(len)))
        const w = A(ta.wma(s, len / 2));
        const full = A(ta.wma(s, len));
        return A(ta.wma(S(w.map((v, i) => 2 * v - full[i])), Math.round(Math.sqrt(len))));
      }
      default: return A(ta.sma(s, len));
    }
  };

  const baseHighMA = getMA(bars.map((b) => b.high), cfg.maLen);
  const baseLowMA = getMA(bars.map((b) => b.low), cfg.maLen);
  const rawATR = ta.atr(bars, cfg.atrLen);
  const smoothATR = A(ta.rma(rawATR, cfg.atrSmoothing));

  const highCol = String(color.new(cfg.maHighColor, cfg.maHighTransp));
  const lowCol = String(color.new(cfg.maLowColor, cfg.maLowTransp));
  const basisCol = String(color.new(cfg.basisColor, cfg.basisTransp));
  const upCol = String(color.new(cfg.upColor, cfg.transp));
  const downCol = String(color.new(cfg.downColor, cfg.transp));

  const plot0: { time: number; value: number; color: string }[] = [];
  const plot1: { time: number; value: number; color: string }[] = [];
  const plot2: { time: number; value: number; color: string }[] = [];
  const candles: PlotCandleData[] = [];
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const adjATR = smoothATR[i] * cfg.atrGlobalMult;
    const maHighAdj = baseHighMA[i] + adjATR * Math.abs(cfg.maHighATRMult);
    const maLowAdj = baseLowMA[i] - adjATR * Math.abs(cfg.maLowATRMult);
    const basis = (maHighAdj + maLowAdj) / 2;
    plot0.push({ time: b.time, value: cfg.showMA ? maHighAdj : NaN, color: highCol });
    plot1.push({ time: b.time, value: cfg.showMA ? maLowAdj : NaN, color: lowCol });
    plot2.push({ time: b.time, value: cfg.showMA && cfg.showBasis ? basis : NaN, color: basisCol });
    // plotcandle(low, high, low, high, color = col, bordercolor = col, wickcolor = col)
    const col = ge(b.close, b.open) ? upCol : downCol;
    candles.push({ time: b.time, open: b.low, high: b.high, low: b.low, close: b.high, color: col, borderColor: col, wickColor: col });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2 },
    markers: [],
    plotCandles: { trueRangeCandles: candles },
  };
}

export const TrueRangeExpansion = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
