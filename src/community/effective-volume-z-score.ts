/**
 * Effective Volume Z-Score
 *
 * Effective volume = volume * (close - open) / (high - low) (0 on a bar with no range), smoothed by an EMA. The
 * z-score of this EMA over `length` bars (at most bar_index + 1 bars): (x - sma(x)) / stdev(x). A moving average
 * of the z-score (hidden by default), horizontal lines at 0 and at the upper / lower thresholds with a fill between
 * them, and optional regular divergences of the z-score pivots against the close (Bull / Bear labels).
 *
 * Reference: "Effective Volume Z-Score" by eugencovaci
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © eugencovaci
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { barInterval, barTime } from '../bar-time';

export interface EffectiveVolumeZScoreInputs {
  /** EMA length of the effective volume */
  evSmoothing: number;
  /** Z-score length */
  length: number;
  upper: number;
  lower: number;
  /** Length of the moving average of the z-score */
  smoothing: number;
  maTypeInput: 'SMA' | 'EMA' | 'SMMA (RMA)';
  /** Pivot lookback right */
  lbR: number;
  /** Pivot lookback left */
  lbL: number;
  rangeUpper: number;
  rangeLower: number;
  plotBull: boolean;
  plotBear: boolean;
}

export const defaultInputs: EffectiveVolumeZScoreInputs = {
  evSmoothing: 14,
  length: 300,
  upper: 2,
  lower: -2,
  smoothing: 14,
  maTypeInput: 'SMA',
  lbR: 5,
  lbL: 5,
  rangeUpper: 60,
  rangeLower: 5,
  plotBull: false,
  plotBear: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'evSmoothing', type: 'int', title: 'Effective Volume Smoothing Period', defval: 14, min: 1 },
  { id: 'length', type: 'int', title: 'Z-Score Length', defval: 300, min: 2 },
  { id: 'upper', type: 'float', title: 'Upper threshold', defval: 2 },
  { id: 'lower', type: 'float', title: 'Lower threshold', defval: -2 },
  { id: 'smoothing', type: 'int', title: 'Average Effective Volume Z-Score Period', defval: 14 },
  { id: 'maTypeInput', type: 'string', title: 'MA Type', defval: 'SMA', options: ['SMA', 'EMA', 'SMMA (RMA)'] },
  { id: 'lbR', type: 'int', title: 'Pivot Lookback Right', defval: 5 },
  { id: 'lbL', type: 'int', title: 'Pivot Lookback Left', defval: 5 },
  { id: 'rangeUpper', type: 'int', title: 'Max of Lookback Range', defval: 60 },
  { id: 'rangeLower', type: 'int', title: 'Min of Lookback Range', defval: 5 },
  { id: 'plotBull', type: 'bool', title: 'Plot Bullish', defval: false },
  { id: 'plotBear', type: 'bool', title: 'Plot Bearish', defval: false },
];

const BEAR_COL = String(color.new(color.red, 0));
const BULL_COL = String(color.new(color.green, 0));
const NONE_COL = String(color.new(color.white, 100));
const FILL_COL = String(color.new(color.gray, 80));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Effective Volume Z-Score', color: color.orange, lineWidth: 1 },
  { id: 'plot1', title: 'Average Effective Volume Z-Score', color: color.lime, lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Regular Bullish', color: BULL_COL, lineWidth: 2 },
  { id: 'plot3', title: 'Regular Bearish', color: BEAR_COL, lineWidth: 2 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, title: 'Zero line', color: color.red, linestyle: 'dashed' },
  { id: 'hline_upper', price: 2, title: 'Upper threshold', color: color.gray, linestyle: 'solid' },
  { id: 'hline_lower', price: -2, title: 'Lower threshold', color: color.gray, linestyle: 'solid' },
];

/** fill(hl, hu, color = color.new(color.gray, 80)) */
export const fillConfig: FillConfig[] = [
  { id: 'fill_thresholds', plot1: 'hline_lower', plot2: 'hline_upper', color: FILL_COL, title: 'Hlines Background' },
];

export const metadata = {
  title: 'Effective Volume Z-Score',
  shortTitle: 'EVZS',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color?: string };

export function calculate(
  bars: Bar[],
  inputs: Partial<EffectiveVolumeZScoreInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  // effectiveVolume(): spread == 0 ? 0 : volume * (close - open) / spread
  const ev = bars.map((b) => {
    const spread = b.high - b.low;
    return eq(spread, 0) ? 0 : ((b.volume ?? NaN) * (b.close - b.open)) / spread;
  });
  const maEv = A(ta.ema(S(ev), cfg.evSmoothing));
  // length := length > bar_index + 1 ? bar_index + 1 : length (one length per bar)
  const lens = bars.map((_b, i) => (cfg.length > i + 1 ? i + 1 : cfg.length));
  const mean = A(ta.sma(S(maEv), S(lens)));
  const std = A(ta.stdev(S(maEv), S(lens)));
  // (src - mean) / std: a plain division (x / 0 is +-infinity, 0 / 0 na)
  const score = maEv.map((x, i) => (x - mean[i]) / std[i]);
  const scoreS = S(score);
  const avgScore = A(cfg.maTypeInput === 'EMA' ? ta.ema(scoreS, cfg.smoothing)
    : cfg.maTypeInput === 'SMMA (RMA)' ? ta.rma(scoreS, cfg.smoothing) : ta.sma(scoreS, cfg.smoothing));

  // Divergences
  const { lbL, lbR, rangeLower, rangeUpper } = cfg;
  const pl = A(ta.pivotlow(scoreS, lbL, lbR));
  const ph = A(ta.pivothigh(scoreS, lbL, lbR));
  const plFound = pl.map((v) => !isNaN(v));
  const phFound = ph.map((v) => !isNaN(v));
  const oscLbr = (i: number) => (i - lbR >= 0 ? score[i - lbR] : NaN);
  const closeLbr = (i: number) => (i - lbR >= 0 ? bars[i - lbR].close : NaN);
  const bullCond: boolean[] = new Array(n).fill(false);
  const bearCond: boolean[] = new Array(n).fill(false);
  // ta.valuewhen(found, x, 1): x on the found bar before the latest one (the latest can be the current bar)
  const plOsc: number[] = [];
  const plClose: number[] = [];
  const phOsc: number[] = [];
  const phClose: number[] = [];
  // _inRange(found[1]): ta.barssince(found[1] == true), na before the first true
  let plSince = NaN;
  let phSince = NaN;
  for (let i = 0; i < n; i++) {
    const o = oscLbr(i);
    const c = closeLbr(i);
    const plPrev = i > 0 && plFound[i - 1];
    plSince = plPrev ? 0 : isNaN(plSince) ? NaN : plSince + 1;
    const inRangePl = rangeLower <= plSince && plSince <= rangeUpper;
    if (plFound[i]) {
      plOsc.push(o);
      plClose.push(c);
    }
    const vwPlOsc = plOsc.length >= 2 ? plOsc[plOsc.length - 2] : NaN;
    const vwPlClose = plClose.length >= 2 ? plClose[plClose.length - 2] : NaN;
    const oscHL = gt(o, vwPlOsc) && inRangePl;
    const priceLL = lt(c, vwPlClose);
    bullCond[i] = cfg.plotBull && priceLL && oscHL && plFound[i];

    const phPrev = i > 0 && phFound[i - 1];
    phSince = phPrev ? 0 : isNaN(phSince) ? NaN : phSince + 1;
    const inRangePh = rangeLower <= phSince && phSince <= rangeUpper;
    if (phFound[i]) {
      phOsc.push(o);
      phClose.push(c);
    }
    const vwPhOsc = phOsc.length >= 2 ? phOsc[phOsc.length - 2] : NaN;
    const vwPhClose = phClose.length >= 2 ? phClose[phClose.length - 2] : NaN;
    const oscLH = lt(o, vwPhOsc) && inRangePh;
    const priceHH = gt(c, vwPhClose);
    bearCond[i] = cfg.plotBear && priceHH && oscLH && phFound[i];
  }

  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const interval = barInterval(bars);
  const t = (i: number) => bars[i].time;
  const plots: Record<string, Point[]> = {
    plot0: bars.map((_b, i) => ({ time: t(i), value: fin(score[i]), color: color.orange })),
    plot1: bars.map((_b, i) => ({ time: t(i), value: fin(avgScore[i]), color: color.lime })),
    plot2: [],
    plot3: [],
  };
  const markers: MarkerData[] = [];
  // plot(found ? oscLbr : na, offset = -lbR, color = cond ? col : noneColor): the value of bar i is drawn on bar i - lbR
  for (let i = 0; i < n; i++) {
    if (i - lbR < 0) continue;
    const time = barTime(bars, i - lbR, interval);
    const o = fin(oscLbr(i));
    plots.plot2.push({ time, value: plFound[i] ? o : NaN, color: bullCond[i] ? BULL_COL : NONE_COL });
    plots.plot3.push({ time, value: phFound[i] ? o : NaN, color: bearCond[i] ? BEAR_COL : NONE_COL });
    // plotshape(cond ? oscLbr : na, offset = -lbR, shape.labelup / labeldown, location.absolute)
    if (bullCond[i] && !isNaN(o)) {
      markers.push({ time, position: 'atPriceBottom', price: o, shape: 'labelUp', color: BULL_COL, text: ' Bull ',
        textColor: color.white });
    }
    if (bearCond[i] && !isNaN(o)) {
      markers.push({ time, position: 'atPriceTop', price: o, shape: 'labelDown', color: BEAR_COL, text: ' Bear ',
        textColor: color.white });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: 2 },
    plots,
    hlines: [
      { value: 0, options: { title: 'Zero line', color: color.red, linestyle: 'dashed' } },
      { value: cfg.upper, options: { title: 'Upper threshold', color: color.gray, linestyle: 'solid' } },
      { value: cfg.lower, options: { title: 'Lower threshold', color: color.gray, linestyle: 'solid' } },
    ],
    fills: [
      { plot1: 'hline_lower', plot2: 'hline_upper', options: { title: 'Hlines Background' },
        colors: new Array<string>(n).fill(FILL_COL) },
    ],
    markers,
  };
}

export const EffectiveVolumeZScore = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
