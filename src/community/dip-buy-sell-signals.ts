/**
 * Dip Buy/Sell Signals (Vix Fix + MA Deviation + TRMAD)
 *
 * Three conditions:
 * 1. CM Williams Vix Fix: wvf = (highest(close, pd) - low) / highest(close, pd) * 100 is at or above its upper
 *    Bollinger band (sma + mult * stdev over bbl bars) or at or above ph times its highest value over lb bars.
 * 2. Deviation from a moving average (type and length as inputs): (close - ma) / ma * 100 below -percent (buy) or
 *    above +percent (sell).
 * 3. TRMAD: (close - MA(close)) / MA(true range), 0 when not finite, below the buy level (buy) or above the sell
 *    level (sell).
 * Buy = 1 and 2 (buy) and 3 (buy); sell = 1 and 2 (sell) and 3 (sell). A label below the bar marks a buy signal.
 * The bar colour, the background colour and the sell label have display.none in Pine: they are not drawn.
 *
 * Reference: "Dip Buy/Sell Signals (Vix Fix + MA Deviation + TRMAD)" by DotGain
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © DotGain
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export type DipDevMaType = 'ema' | 'sma' | 'rma' | 'vwma' | 'wma' | 'tema';
export type DipTrmadMaType = 'SMA' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';

export interface DipBuySellSignalsInputs {
  pd: number;
  bbl: number;
  mult: number;
  lb: number;
  ph: number;
  pl: number;
  matDev: DipDevMaType;
  lenDev: number;
  percentDev: number;
  trTypeInputTrmad: DipTrmadMaType;
  trLengthInputTrmad: number;
  maTypeInputTrmad: DipTrmadMaType;
  maLengthInputTrmad: number;
  trmadLevelBuy: number;
  trmadLevelSell: number;
}

export const defaultInputs: DipBuySellSignalsInputs = {
  pd: 22,
  bbl: 20,
  mult: 2.0,
  lb: 50,
  ph: 0.85,
  pl: 1.01,
  matDev: 'ema',
  lenDev: 200,
  percentDev: 10,
  trTypeInputTrmad: 'SMA',
  trLengthInputTrmad: 14,
  maTypeInputTrmad: 'SMA',
  maLengthInputTrmad: 20,
  trmadLevelBuy: -3.0,
  trmadLevelSell: 3.0,
};

const GROUP_VIX = 'CM Williams Vix Fix';
const GROUP_DEV = 'Deviation from MA';
const GROUP_TRMAD = 'TRMAD';
const TRMAD_TYPES: DipTrmadMaType[] = ['SMA', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'];

export const inputConfig: InputConfig[] = [
  { id: 'pd', type: 'int', title: 'LookBack Period Standard Deviation High', defval: 22, group: GROUP_VIX },
  { id: 'bbl', type: 'int', title: 'Bolinger Band Length', defval: 20, group: GROUP_VIX },
  { id: 'mult', type: 'float', title: 'Bollinger Band Standard Deviation Up', defval: 2.0, min: 1, max: 5, group: GROUP_VIX },
  { id: 'lb', type: 'int', title: 'Look Back Period Percentile High', defval: 50, group: GROUP_VIX },
  { id: 'ph', type: 'float', title: 'Highest Percentile', defval: 0.85, group: GROUP_VIX },
  { id: 'pl', type: 'float', title: 'Lowest Percentile', defval: 1.01, group: GROUP_VIX },
  { id: 'matDev', type: 'string', title: 'Moving Average Type', defval: 'ema',
    options: ['ema', 'sma', 'rma', 'vwma', 'wma', 'tema'], group: GROUP_DEV },
  { id: 'lenDev', type: 'int', title: 'Length of MA', defval: 200, group: GROUP_DEV },
  { id: 'percentDev', type: 'float', title: 'Deviation Percent', defval: 10, group: GROUP_DEV },
  { id: 'trTypeInputTrmad', type: 'string', title: 'TR Type', defval: 'SMA', options: TRMAD_TYPES, group: GROUP_TRMAD },
  { id: 'trLengthInputTrmad', type: 'int', title: 'TR Length', defval: 14, min: 2, group: GROUP_TRMAD },
  { id: 'maTypeInputTrmad', type: 'string', title: 'MA Type', defval: 'SMA', options: TRMAD_TYPES, group: GROUP_TRMAD },
  { id: 'maLengthInputTrmad', type: 'int', title: 'MA Length', defval: 20, min: 2, group: GROUP_TRMAD },
  { id: 'trmadLevelBuy', type: 'float', title: 'TRMAD Buy Level', defval: -3.0, step: 0.1, group: GROUP_TRMAD },
  { id: 'trmadLevelSell', type: 'float', title: 'TRMAD Sell Level', defval: 3.0, step: 0.1, group: GROUP_TRMAD },
];

// No plot(): a plotshape marker only (barcolor, bgcolor and the sell plotshape have display.none)
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Dip Buy/Sell Signals (Vix Fix + MA Deviation + TRMAD)',
  shortTitle: 'DipSig',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

export function calculate(
  bars: Bar[],
  inputs: Partial<DipBuySellSignalsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (values: number[]) => Series.fromArray(bars, values);
  const close = bars.map((b) => b.close);
  const closeS = S(close);
  const volumeS = S(bars.map((b) => b.volume ?? NaN));

  // f_tema_dev(s, p): 3 * ema1 - 3 * ema2 + ema3
  const temaDev = (s: Series, p: number): number[] => {
    const ema1 = ta.ema(s, p);
    const ema2 = ta.ema(ema1, p);
    const ema3 = ta.ema(ema2, p);
    const e1 = A(ema1);
    const e2 = A(ema2);
    const e3 = A(ema3);
    return e1.map((v, i) => 3 * v - 3 * e2[i] + e3[i]);
  };

  // f_ma_dev(t, s, p)
  const maDev = (t: string, s: Series, p: number): number[] => {
    switch (t) {
      case 'ema': return A(ta.ema(s, p));
      case 'rma': return A(ta.rma(s, p));
      case 'vwma': return A(ta.vwma(s, p, volumeS));
      case 'wma': return A(ta.wma(s, p));
      case 'tema': return temaDev(s, p);
      default: return A(ta.sma(s, p));
    }
  };

  // f_ma_trmad(source, length, type)
  const maTrmad = (source: Series, length: number, type: string): number[] => {
    switch (type) {
      case 'SMA': return A(ta.sma(source, length));
      case 'EMA': return A(ta.ema(source, length));
      case 'SMMA (RMA)': return A(ta.rma(source, length));
      case 'WMA': return A(ta.wma(source, length));
      case 'VWMA': return A(ta.vwma(source, length, volumeS));
      default: return A(ta.sma(source, length));
    }
  };

  // 1. CM Williams Vix Fix
  const hiClose = A(ta.highest(closeS, cfg.pd));
  const wvf = bars.map((b, i) => (hiClose[i] - b.low) / hiClose[i] * 100);
  const wvfS = S(wvf);
  const sd = A(ta.stdev(wvfS, cfg.bbl));
  const midLine = A(ta.sma(wvfS, cfg.bbl));
  const hiWvf = A(ta.highest(wvfS, cfg.lb));

  // 2. Deviation from MA
  const ma1Dev = maDev(cfg.matDev, closeS, cfg.lenDev);

  // 3. TRMAD
  const atrTrmad = maTrmad(ta.tr(bars, true), cfg.trLengthInputTrmad, cfg.trTypeInputTrmad);
  const maClose = maTrmad(closeS, cfg.maLengthInputTrmad, cfg.maTypeInputTrmad);

  const buyColor = String(color.new(color.green, 60));
  const markers: MarkerData[] = [];
  bars.forEach((b, i) => {
    const sDev = cfg.mult * sd[i];
    const upperBand = midLine[i] + sDev;
    const rangeHigh = hiWvf[i] * cfg.ph;
    const cond1VixLime = ge(wvf[i], upperBand) || ge(wvf[i], rangeHigh);

    // Plain division: x / 0 is +-infinity, 0 / 0 is na
    const defVal = (close[i] - ma1Dev[i]) / ma1Dev[i] * 100;
    const cond2DevBuy = lt(defVal, -cfg.percentDev);
    const cond2DevSell = gt(defVal, cfg.percentDev);

    const distanceTrmad = close[i] - maClose[i];
    const ratio = distanceTrmad / atrTrmad[i];
    // nz(): na and +-infinity give 0
    const trmadVal = Number.isFinite(ratio) ? ratio : 0;
    const cond3TrmadBuy = lt(trmadVal, cfg.trmadLevelBuy);
    const cond3TrmadSell = gt(trmadVal, cfg.trmadLevelSell);

    const buySignal = cond1VixLime && cond2DevBuy && cond3TrmadBuy;
    const sellSignal = cond1VixLime && cond2DevSell && cond3TrmadSell;

    // barcolor(buy ? green : sell ? red : na, display.none) and bgcolor(buy ? green 85 : sell ? red 85 : na,
    // display.none): not drawn
    // plotshape(buySignal, 'Buy', shape.labelup, location.belowbar, color.new(color.green, 60), size.small)
    if (buySignal) markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: buyColor, size: 'small' });
    // plotshape(sellSignal, 'Sell', shape.labeldown, location.abovebar, color.new(color.red, 60), size.small,
    // display.none): not drawn
    void sellSignal;
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
  };
}

export const DipBuySellSignals = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
