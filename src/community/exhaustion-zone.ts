/**
 * Exhaustion Zone
 *
 * A rebound line under the price. atr = sma(atr(atrLength), atrSmooth) (0 while na). The highest of
 * low - 2 * atr over highestLength bars and the lowest of low + 2 * atr over lowestLength bars (0 while na) give, on
 * the previous bar, mid = (highest + lowest) / 2 - (highest + lowest) * lineFactor. The rebound line is
 * sma(mid, smaLength) + atr[1] * atrFactor, with a second line at rebound * lineScale and a fill between them. The
 * background and the bars are green when the low is at or below the rebound line.
 *
 * Reference: "Exhaustion Zone [by rukich]" by rukich
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © rukich
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, BgColorData } from '../types';

export interface ExhaustionZoneInputs {
  /** ATR length */
  atrLength: number;
  /** SMA length of the ATR */
  atrSmooth: number;
  /** Length of the highest of low - 2 * atr */
  highestLength: number;
  /** Length of the lowest of low + 2 * atr */
  lowestLength: number;
  /** SMA length of the rebound line */
  smaLength: number;
  lineFactor: number;
  atrFactor: number;
  /** Scale of the second line */
  lineScale: number;
}

export const defaultInputs: ExhaustionZoneInputs = {
  atrLength: 14,
  atrSmooth: 34,
  highestLength: 13,
  lowestLength: 50,
  smaLength: 55,
  lineFactor: 0.236,
  atrFactor: 0.5,
  lineScale: 0.86,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14 },
  { id: 'atrSmooth', type: 'int', title: 'ATR Smoothing', defval: 34 },
  { id: 'highestLength', type: 'int', title: 'Highest Period', defval: 13 },
  { id: 'lowestLength', type: 'int', title: 'Lowest Period', defval: 50 },
  { id: 'smaLength', type: 'int', title: 'SMA Length', defval: 55 },
  { id: 'lineFactor', type: 'float', title: 'Line Factor', defval: 0.236 },
  { id: 'atrFactor', type: 'float', title: 'ATR Factor', defval: 0.5 },
  { id: 'lineScale', type: 'float', title: 'Line Scale', defval: 0.86 },
];

const REBOUND_COL = String(color.new(color.green, 70));
const SCALED_COL = String(color.new(color.green, 50));
const FILL_COL = String(color.new(color.green, 70));
const BG_COL = String(color.new(color.green, 90));
const BAR_COL = String(color.new(color.green, 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Rebound Line', color: REBOUND_COL, lineWidth: 1 },
  { id: 'plot1', title: 'Scaled Line 1', color: SCALED_COL, lineWidth: 1 },
  { id: 'plot2', title: 'Scaled Line 2', color: SCALED_COL, lineWidth: 5 },
];

export const metadata = {
  title: 'Exhaustion Zone [by rukich]',
  shortTitle: 'Exhaustion Zone [by rukich]',
  overlay: true,
};

/** Pine a <= b: not (a - b > 1e-10), false with na */
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > 1e-10);
/** na(x) ? 0.0 : x */
const nz0 = (x: number) => (isNaN(x) ? 0 : x);

export function calculate(
  bars: Bar[],
  inputs: Partial<ExhaustionZoneInputs> = {},
): IndicatorResult & { barColors: BarColorData[]; bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  // atr = ta.sma(ta.atr(atrLength), atrSmooth); na -> 0
  const atr = A(ta.sma(ta.atr(bars, cfg.atrLength), cfg.atrSmooth)).map(nz0);
  // highest_s = ta.highest(low - atr * 2, highestLength); lowest_f = ta.lowest(low + atr * 2, lowestLength); na -> 0
  const highestS = A(ta.highest(S(bars.map((b, i) => b.low - atr[i] * 2)), cfg.highestLength)).map(nz0);
  const lowestF = A(ta.lowest(S(bars.map((b, i) => b.low + atr[i] * 2)), cfg.lowestLength)).map(nz0);

  // adjusted_mid = (highest_s[1] + lowest_f[1]) / 2 - (highest_s[1] + lowest_f[1]) * lineFactor; na -> 0
  const adjustedMid = bars.map((_b, i) => {
    if (i === 0) return 0;
    const s = highestS[i - 1] + lowestF[i - 1];
    return nz0(s / 2 - s * cfg.lineFactor);
  });
  const rebSma = A(ta.sma(S(adjustedMid), cfg.smaLength)).map(nz0);

  const plot0: { time: number; value: number; color: string }[] = [];
  const plot1: { time: number; value: number; color: string }[] = [];
  const plot2: { time: number; value: number; color: string }[] = [];
  const barColors: BarColorData[] = [];
  const bgColors: BgColorData[] = [];
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    // rebound_line = reb_sma + atr[1] * atrFactor; na -> 0
    const rebound = nz0(rebSma[i] + (i > 0 ? atr[i - 1] : NaN) * cfg.atrFactor);
    const scaled = nz0(rebound * cfg.lineScale);
    plot0.push({ time: t, value: rebound, color: REBOUND_COL });
    plot1.push({ time: t, value: scaled, color: SCALED_COL });
    plot2.push({ time: t, value: scaled, color: SCALED_COL });
    // signal_cond = low <= rebound_line
    if (le(bars[i].low, rebound)) {
      bgColors.push({ time: t, color: BG_COL });
      barColors.push({ time: t, color: BAR_COL });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2 },
    // fill(h_rebound, l_rebound, color.new(color.green, 70), title = 'Fill Area')
    fills: [{ plot1: 'plot0', plot2: 'plot2', options: { title: 'Fill Area' }, colors: new Array<string>(n).fill(FILL_COL) }],
    barColors,
    bgColors,
  };
}

export const ExhaustionZone = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
