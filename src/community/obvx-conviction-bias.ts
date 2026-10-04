/**
 * OBVX Conviction Bias
 *
 * On Balance Volume (cumulative sum of sign(change(close)) * volume) with a short and a long moving average of the
 * OBV (Length and round(Length * 2.718)), with a selectable average type (SMA, EMA, SMMA (RMA), WMA, VWMA). The long
 * average is green when the short average is above it, red otherwise. The area between the OBV and the short
 * average is lime when the OBV is above it, maroon otherwise; the area between the two averages is green or red.
 * A runtime error is raised when the data has no volume.
 *
 * Reference: "OBVX Conviction Bias" by TheLeadingIndicator
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Open Source | Designed by Adrian Dyer for "The Leading Indicator", Engineered by PineForge
 * Laboratory (2025)
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface ObvxConvictionBiasInputs {
  /** Smoothing Method */
  typeMA: 'SMA' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';
  /** Length of the short average (the long average uses round(len * 2.718)) */
  len: number;
}

export const defaultInputs: ObvxConvictionBiasInputs = {
  typeMA: 'VWMA',
  len: 34,
};

export const inputConfig: InputConfig[] = [
  { id: 'typeMA', type: 'string', title: 'Smoothing Method', defval: 'VWMA', options: ['SMA', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'] },
  { id: 'len', type: 'int', title: 'Length', defval: 34, min: 1, max: 100 },
];

const OBV_COLOR = String(color.rgb(174, 243, 230));
const SHORT_COLOR = String(color.new('#f2e782', 0));
const LONG_BULL = String(color.rgb(101, 221, 105, 33));
const LONG_BEAR = String(color.rgb(223, 117, 117, 33));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'On Balance Volume', color: OBV_COLOR, lineWidth: 1 },
  { id: 'plot1', title: 'Short MA', color: SHORT_COLOR, lineWidth: 1 },
  { id: 'plot2', title: 'Long MA', color: LONG_BULL, lineWidth: 1 },
];

export const metadata = {
  title: 'OBVX Conviction Bias',
  shortTitle: 'OBVX',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(bars: Bar[], inputs: Partial<ObvxConvictionBiasInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const volume = bars.map((b) => b.volume ?? NaN);

  // obv = ta.cum(math.sign(ta.change(close)) * volume)
  const sign = (x: number) => (isNaN(x) ? NaN : x > 0 ? 1 : x < 0 ? -1 : 0);
  const obvIn = bars.map((b, i) => (i > 0 ? sign(b.close - bars[i - 1].close) * volume[i] : NaN));
  const obv = A(ta.cum(S(obvIn)));

  // var cumVol = 0.0; cumVol += nz(volume); if barstate.islast and cumVol == 0: runtime.error(...)
  let cumVol = 0;
  for (let i = 0; i < n; i++) cumVol += isNaN(volume[i]) ? 0 : volume[i];
  if (n > 0 && Math.abs(cumVol) <= EPS) throw new Error('No volume is provided by the data vendor.');

  const ma = (src: number[], len: number): number[] => {
    switch (cfg.typeMA) {
      case 'VWMA': return A(ta.vwma(S(src), len, S(volume)));
      case 'WMA': return A(ta.wma(S(src), len));
      case 'SMA': return A(ta.sma(S(src), len));
      case 'EMA': return A(ta.ema(S(src), len));
      default: return A(ta.rma(S(src), len));
    }
  };
  const mult = 2.718;
  const smoothShort = ma(obv, cfg.len);
  const smoothLong = ma(obv, Math.round(cfg.len * mult));

  const fillShortUp = String(color.new(color.lime, 70));
  const fillShortDown = String(color.new(color.maroon, 70));
  const fillLongUp = String(color.new(color.green, 40));
  const fillLongDown = String(color.new('#ec1d1d', 18));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: obv[i], color: OBV_COLOR })),
      plot1: bars.map((b, i) => ({ time: b.time, value: smoothShort[i], color: SHORT_COLOR })),
      // colorLong = smoothShort > smoothLong ? color.rgb(101, 221, 105, 33) : color.rgb(223, 117, 117, 33)
      plot2: bars.map((b, i) => ({
        time: b.time, value: smoothLong[i], color: gt(smoothShort[i], smoothLong[i]) ? LONG_BULL : LONG_BEAR,
      })),
    },
    fills: [
      // fill(plotShort, plotOBV, obv > smoothShort ? color.new(color.lime, 70) : color.new(color.maroon, 70))
      { plot1: 'plot1', plot2: 'plot0', options: { title: 'Short OBV Fill' },
        colors: bars.map((_b, i) => (gt(obv[i], smoothShort[i]) ? fillShortUp : fillShortDown)) },
      // fill(plotLong, plotShort, smoothShort > smoothLong ? color.new(color.green, 40) : color.new(#ec1d1d, 18))
      { plot1: 'plot2', plot2: 'plot1', options: { title: 'Long OBV Fill' },
        colors: bars.map((_b, i) => (gt(smoothShort[i], smoothLong[i]) ? fillLongUp : fillLongDown)) },
    ],
  };
}

export const ObvxConvictionBias = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
