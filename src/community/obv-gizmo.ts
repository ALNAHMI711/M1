/**
 * OBV (Delta or regular)
 *
 * Delta volume OBV: cumulative sum of buy volume - sell volume, with buy volume = volume * (close - low) / range
 * and sell volume = volume * (high - close) / range (0 on a bar with no range); or the regular OBV: cumulative sum
 * of sign(change(close)) * volume. The OBV can be smoothed by a moving average (SMA / EMA / VWMA / WMA). The signal
 * line is a moving average of the same type (VWMA / WMA of the unsmoothed OBV); the signal is yellow when the OBV
 * is above it, red otherwise. Optional "irregularities" colour the OBV green / red when one side of the volume is
 * more than twice the other against the close direction. Regular divergences of the OBV pivots against the close
 * are drawn as lines between the pivots.
 *
 * Reference: "OBV (Delta or regular)" by GizmoTheInvestor
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { barInterval, barTime } from '../bar-time';

export interface ObvGizmoInputs {
  /** Moving average type of the smoothed OBV and of the signal line */
  choice: 'SMA' | 'EMA' | 'VWMA' | 'WMA';
  /** Delta volume OBV (true) or regular OBV (false) */
  cumOBV: boolean;
  /** Smooth the OBV line */
  fast: boolean;
  /** Moving average length of the smoothed OBV */
  smaFast: number;
  /** Moving average length of the signal line */
  smaSlow: number;
  /** Colour the OBV when one volume side is more than twice the other */
  irr: boolean;
  plotBull: boolean;
  plotBear: boolean;
  /** Pivot lookback right */
  lbR: number;
  /** Pivot lookback left */
  lbL: number;
  rangeUpper: number;
  rangeLower: number;
}

export const defaultInputs: ObvGizmoInputs = {
  choice: 'VWMA',
  cumOBV: true,
  fast: false,
  smaFast: 20,
  smaSlow: 30,
  irr: false,
  plotBull: true,
  plotBear: true,
  lbR: 5,
  lbL: 5,
  rangeUpper: 60,
  rangeLower: 5,
};

const DIV_GROUP = 'Irregulatorries / Divergences';

export const inputConfig: InputConfig[] = [
  { id: 'choice', type: 'string', title: 'Ma type', defval: 'VWMA', options: ['SMA', 'EMA', 'VWMA', 'WMA'] },
  { id: 'cumOBV', type: 'bool', title: 'Delta volume', defval: true },
  { id: 'fast', type: 'bool', title: 'Smoothed OBV', defval: false },
  { id: 'smaFast', type: 'int', title: 'Smoothed OBV length', defval: 20 },
  { id: 'smaSlow', type: 'int', title: 'Ma conversion', defval: 30 },
  { id: 'irr', type: 'bool', title: 'irregulatorries', defval: false, group: DIV_GROUP },
  { id: 'plotBull', type: 'bool', title: 'Plot Bullish divergence', defval: true },
  { id: 'plotBear', type: 'bool', title: 'Plot Bearish divergence', defval: true },
  { id: 'lbR', type: 'int', title: 'Pivot Lookback Right', defval: 5, group: DIV_GROUP },
  { id: 'lbL', type: 'int', title: 'Pivot Lookback Left', defval: 5, group: DIV_GROUP },
  { id: 'rangeUpper', type: 'int', title: 'Max Lookback Range', defval: 60, group: DIV_GROUP },
  { id: 'rangeLower', type: 'int', title: 'Min Lookback Range', defval: 5, group: DIV_GROUP },
];

const BULL_COL = String(color.new('#00ff00', 0));
const BEAR_COL = String(color.new('#ff0000', 0));
const NONE_COL = String(color.new('#ff00ee', 100));
const DOUBLE_BUY_COL = '#00ff00';
const DOUBLE_SELL_COL = '#ff0000';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'OBV', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'signal', color: color.yellow, lineWidth: 1 },
  { id: 'plot2', title: 'Regular Bullish', color: BULL_COL, lineWidth: 1, display: 'pane' },
  { id: 'plot3', title: 'Regular Bearish', color: BEAR_COL, lineWidth: 1, display: 'pane' },
];

export const metadata = {
  title: 'OBV (Delta or regular)',
  shortTitle: 'OBV (Delta or regular)',
  overlay: false,
  format: 'volume',
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color?: string };

export function calculate(bars: Bar[], inputs: Partial<ObvGizmoInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const volume = bars.map((b) => b.volume ?? NaN);
  const volumeS = S(volume);

  // buyVolume / sellVolume: (high == low) ? 0 : volume * (close - low) / (high - low), ... (high - close) / ...
  const buyVolume = bars.map((b, i) => (eq(b.high, b.low) ? 0 : (volume[i] * (b.close - b.low)) / (b.high - b.low)));
  const sellVolume = bars.map((b, i) => (eq(b.high, b.low) ? 0 : (volume[i] * (b.high - b.close)) / (b.high - b.low)));

  // obvChoice = cumOBV ? ta.cum(deltaVolume) : ta.cum(math.sign(ta.change(close)) * volume)
  let obvChoice: number[];
  if (cfg.cumOBV) {
    obvChoice = A(ta.cum(S(buyVolume.map((bv, i) => bv - sellVolume[i]))));
  } else {
    const change = A(ta.change(S(bars.map((b) => b.close))));
    obvChoice = A(ta.cum(S(change.map((c, i) => Math.sign(c) * volume[i]))));
  }
  const obvChoiceS = S(obvChoice);

  let obv: number[];
  if (cfg.fast) {
    switch (cfg.choice) {
      case 'SMA': obv = A(ta.sma(obvChoiceS, cfg.smaFast)); break;
      case 'EMA': obv = A(ta.ema(obvChoiceS, cfg.smaFast)); break;
      case 'VWMA': obv = A(ta.vwma(obvChoiceS, cfg.smaFast, volumeS)); break;
      default: obv = A(ta.wma(obvChoiceS, cfg.smaFast)); break;
    }
  } else {
    obv = obvChoice;
  }
  const obvS = S(obv);

  let smaObv: number[];
  switch (cfg.choice) {
    case 'SMA': smaObv = A(ta.sma(obvS, cfg.smaSlow)); break;
    case 'EMA': smaObv = A(ta.ema(obvS, cfg.smaSlow)); break;
    case 'VWMA': smaObv = A(ta.vwma(obvChoiceS, cfg.smaSlow, volumeS)); break;
    default: smaObv = A(ta.wma(obvChoiceS, cfg.smaSlow)); break;
  }

  const obvColor = (i: number) => {
    const closePrev = i > 0 ? bars[i - 1].close : NaN;
    const doubleBuy = cfg.irr && gt(buyVolume[i], sellVolume[i] * 2) && lt(bars[i].close, closePrev);
    const doubleSell = cfg.irr && gt(sellVolume[i], buyVolume[i] * 2) && ge(bars[i].close, closePrev);
    return doubleBuy ? DOUBLE_BUY_COL : doubleSell ? DOUBLE_SELL_COL : color.blue;
  };

  // Divergences
  const { lbL, lbR, rangeLower, rangeUpper } = cfg;
  const plFound = A(ta.pivotlow(obvS, lbL, lbR)).map((v) => !isNaN(v));
  const phFound = A(ta.pivothigh(obvS, lbL, lbR)).map((v) => !isNaN(v));
  const obvLbr = (i: number) => (i - lbR >= 0 ? obv[i - lbR] : NaN);
  const closeLbr = (i: number) => (i - lbR >= 0 ? bars[i - lbR].close : NaN);
  const bullCond: boolean[] = new Array(n).fill(false);
  const bearCond: boolean[] = new Array(n).fill(false);
  // ta.valuewhen(found, x, 1): x on the found bar before the latest one (the latest can be the current bar)
  const plObv: number[] = [];
  const plClose: number[] = [];
  const phObv: number[] = [];
  const phClose: number[] = [];
  // _inRange(found[1]): ta.barssince(found[1] == true), na before the first true
  let plSince = NaN;
  let phSince = NaN;
  for (let i = 0; i < n; i++) {
    const o = obvLbr(i);
    const c = closeLbr(i);

    const plPrev = i > 0 && plFound[i - 1];
    plSince = plPrev ? 0 : isNaN(plSince) ? NaN : plSince + 1;
    const inRangePl = rangeLower <= plSince && plSince <= rangeUpper;
    if (plFound[i]) {
      plObv.push(o);
      plClose.push(c);
    }
    const vwPlObv = plObv.length >= 2 ? plObv[plObv.length - 2] : NaN;
    const vwPlClose = plClose.length >= 2 ? plClose[plClose.length - 2] : NaN;
    const obvHL = ge(o, vwPlObv) && inRangePl;
    const priceLL = lt(c, vwPlClose);
    bullCond[i] = cfg.plotBull && priceLL && obvHL && plFound[i];

    const phPrev = i > 0 && phFound[i - 1];
    phSince = phPrev ? 0 : isNaN(phSince) ? NaN : phSince + 1;
    const inRangePh = rangeLower <= phSince && phSince <= rangeUpper;
    if (phFound[i]) {
      phObv.push(o);
      phClose.push(c);
    }
    const vwPhObv = phObv.length >= 2 ? phObv[phObv.length - 2] : NaN;
    const vwPhClose = phClose.length >= 2 ? phClose[phClose.length - 2] : NaN;
    const obvLH = le(o, vwPhObv) && inRangePh;
    const priceHH = gt(c, vwPhClose);
    bearCond[i] = cfg.plotBear && priceHH && obvLH && phFound[i];
  }

  const interval = barInterval(bars);
  const t = (i: number) => bars[i].time;
  const plots: Record<string, Point[]> = {
    plot0: bars.map((_b, i) => ({ time: t(i), value: obv[i], color: obvColor(i) })),
    // smaObvColor = obv > smaObv ? color.yellow : color.red
    plot1: bars.map((_b, i) => ({ time: t(i), value: smaObv[i], color: gt(obv[i], smaObv[i]) ? color.yellow : color.red })),
    plot2: [],
    plot3: [],
  };
  // plot(found ? obv[lbR] : na, offset = -lbR, color = cond ? col : noneColor): the value of bar i is drawn on bar i - lbR
  for (let i = 0; i < n; i++) {
    if (i - lbR < 0) continue;
    const time = barTime(bars, i - lbR, interval);
    const o = obvLbr(i);
    plots.plot2.push({ time, value: plFound[i] ? o : NaN, color: bullCond[i] ? BULL_COL : NONE_COL });
    plots.plot3.push({ time, value: phFound[i] ? o : NaN, color: bearCond[i] ? BEAR_COL : NONE_COL });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, format: metadata.format },
    plots,
  };
}

export const ObvGizmo = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
