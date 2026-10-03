/**
 * RSI-EMA-Crossing with Donchian-Stop-Loss
 *
 * Donchian channel (highest high, lowest low and their midpoint over `lenDonchian` bars) and a moving average of the
 * close. A signal candle is a bar where the RSI crosses over its moving average while the close is above the price
 * moving average: its high is stored and the background is yellow. The entry is the first later close above that
 * high (green label below the bar). The stop-loss line is the lower Donchian band.
 *
 * Reference: "RSI-EMA-Crossing with Donchian-Stop-Loss" by Kahael
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Kahael
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';

type MaType = 'SMA' | 'EMA' | 'WMA' | 'VWMA' | 'HMA';

export interface RsiEmaCrossingWithDonchianStopLossInputs {
  /** Donchian channel length */
  lenDonchian: number;
  /** RSI length */
  lenRSI: number;
  /** Length of the moving average of the RSI */
  lenSMARSI: number;
  /** Moving average type of the RSI */
  maTypeRSI: MaType;
  /** Length of the price moving average */
  lenMAPrice: number;
  /** Moving average type of the price */
  maTypePrice: MaType;
}

export const defaultInputs: RsiEmaCrossingWithDonchianStopLossInputs = {
  lenDonchian: 48,
  lenRSI: 7,
  lenSMARSI: 14,
  maTypeRSI: 'SMA',
  lenMAPrice: 50,
  maTypePrice: 'SMA',
};

const MA_OPTIONS = ['SMA', 'EMA', 'WMA', 'VWMA', 'HMA'];

export const inputConfig: InputConfig[] = [
  { id: 'lenDonchian', type: 'int', title: 'Donchian Kanal Länge', defval: 48 },
  { id: 'lenRSI', type: 'int', title: 'RSI Länge', defval: 7 },
  { id: 'lenSMARSI', type: 'int', title: 'SMA RSI Länge', defval: 14 },
  { id: 'maTypeRSI', type: 'string', title: 'RSI MA-Typ', defval: 'SMA', options: MA_OPTIONS },
  { id: 'lenMAPrice', type: 'int', title: 'Preis MA Länge', defval: 50 },
  { id: 'maTypePrice', type: 'string', title: 'Preis MA-Typ', defval: 'SMA', options: MA_OPTIONS },
];

const STOP_COL = String(color.new(color.red, 60));
const SIGNAL_BG = String(color.new(color.yellow, 80));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Donchian Upper', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'Donchian Lower', color: color.red, lineWidth: 1 },
  { id: 'plot2', title: 'Donchian Basis', color: color.green, lineWidth: 1 },
  { id: 'plot3', title: 'Preis MA', color: color.orange, lineWidth: 1 },
  { id: 'plot4', title: 'Stop-Loss', color: STOP_COL, lineWidth: 1 },
];

export const metadata = {
  title: 'RSI-EMA-Crossing with Donchian-Stop-Loss',
  shortTitle: 'RSI-EMA-Crossing with Donchian-Stop-Loss',
  overlay: true,
};

/** Pine a > b: a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;

export function calculate(
  bars: Bar[],
  inputs: Partial<RsiEmaCrossingWithDonchianStopLossInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const close = S(bars.map((b) => b.close));
  const volume = S(bars.map((b) => b.volume ?? NaN));

  // switch maType: only the selected branch runs (the input is constant, so on every bar)
  const ma = (src: Series, len: number, type: MaType): number[] => {
    switch (type) {
      case 'EMA': return A(ta.ema(src, len));
      case 'WMA': return A(ta.wma(src, len));
      case 'VWMA': return A(ta.vwma(src, len, volume));
      case 'HMA': return A(ta.hma(src, len));
      default: return A(ta.sma(src, len));
    }
  };

  const upperBand = A(ta.highest(S(bars.map((b) => b.high)), cfg.lenDonchian));
  const lowerBand = A(ta.lowest(S(bars.map((b) => b.low)), cfg.lenDonchian));
  const basisBand = upperBand.map((u, i) => (u + lowerBand[i]) / 2);

  const rsiValue = ta.rsi(close, cfg.lenRSI);
  const smaRSI = ma(rsiValue, cfg.lenSMARSI, cfg.maTypeRSI);
  const priceMA = ma(close, cfg.lenMAPrice, cfg.maTypePrice);
  // ta.crossover(rsiValue, smaRSI): exact comparisons (oakscriptjs)
  const cross = A(ta.crossover(rsiValue, S(smaRSI)));

  const markers: MarkerData[] = [];
  const bgColors: BgColorData[] = [];
  let signalHigh = NaN; // var float signalHigh = na
  let isSignalActive = false; // var bool isSignalActive = false
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const crossUp = cross[i] === 1 && gt(b.close, priceMA[i]);
    if (crossUp) {
      signalHigh = b.high;
      isSignalActive = true;
    }
    const entryCondition = isSignalActive && gt(b.close, signalHigh);
    if (entryCondition) isSignalActive = false;
    // bgcolor(crossUp ? color.new(color.yellow, 80) : na, title = "Signalkerze")
    if (crossUp) bgColors.push({ time: b.time, color: SIGNAL_BG });
    // plotshape(entryCondition, style = shape.labelup, location = location.belowbar, color = color.green, title = "Einstieg")
    if (entryCondition) markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: color.green });
  }

  const P = (vals: number[], c: string) => bars.map((b, i) => ({ time: b.time, value: vals[i], color: c }));
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: P(upperBand, color.blue),
      plot1: P(lowerBand, color.red),
      plot2: P(basisBand, color.green),
      plot3: P(priceMA, color.orange),
      // stopLoss = lowerBand
      plot4: P(lowerBand, STOP_COL),
    },
    markers,
    bgColors,
  };
}

export const RsiEmaCrossingWithDonchianStopLoss = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
