/**
 * PCR Market Regime Indicator
 *
 * Price change ratio: raw = (close - close[len]) / (highest(high, len) - lowest(low, len)) * 100 (0 when the range is
 * 0 or na), smoothed by an EMA, with an EMA signal line. The regime is 1 when the PCR is above the neutral zone
 * for at least the hold bars, -1 when it is below -zone for at least the hold bars, 0 inside the zone (else it
 * keeps its value). The background shows the regime (green / red / gray); horizontal lines at 100, 70, 0, -70, -100.
 *
 * Reference: "PCR Market Regime Indicator" by Aleksin_Aleksandar
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';

export interface PcrMarketRegimeIndicatorInputs {
  /** PCR length */
  pcrLen: number;
  /** Minimum hold bars */
  holdBars: number;
  /** Neutral zone (+/- around 0) */
  zone: number;
  /** EMA smoothing length of the raw PCR */
  smoothLen: number;
  showEMA: boolean;
  emaLen: number;
  show100: boolean;
  show70: boolean;
  show0: boolean;
  showNeg70: boolean;
  showNeg100: boolean;
}

export const defaultInputs: PcrMarketRegimeIndicatorInputs = {
  pcrLen: 80,
  holdBars: 1,
  zone: 1.0,
  smoothLen: 3,
  showEMA: true,
  emaLen: 10,
  show100: true,
  show70: true,
  show0: true,
  showNeg70: true,
  showNeg100: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'pcrLen', type: 'int', title: 'PCR Length', defval: 80 },
  { id: 'holdBars', type: 'int', title: 'Min Hold Bars', defval: 1 },
  { id: 'zone', type: 'float', title: 'Neutral Zone (+/- around 0)', defval: 1.0 },
  { id: 'smoothLen', type: 'int', title: 'Smoothing', defval: 3 },
  { id: 'showEMA', type: 'bool', title: 'Show EMA', defval: true },
  { id: 'emaLen', type: 'int', title: 'EMA Length', defval: 10 },
  { id: 'show100', type: 'bool', title: 'Show 100', defval: true },
  { id: 'show70', type: 'bool', title: 'Show 70', defval: true },
  { id: 'show0', type: 'bool', title: 'Show 0', defval: true },
  { id: 'showNeg70', type: 'bool', title: 'Show -70', defval: true },
  { id: 'showNeg100', type: 'bool', title: 'Show -100', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'PCR', color: color.lime, lineWidth: 2 },
  { id: 'plot1', title: 'PCR EMA', color: color.purple, lineWidth: 2 },
];

export const metadata = {
  title: 'PCR Market Regime Indicator',
  shortTitle: 'PCR Market Regime Indicator',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(bars: Bar[], inputs: Partial<PcrMarketRegimeIndicatorInputs> = {}): IndicatorResult & { bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const len = cfg.pcrLen;

  // f_pcr(_length): _r != 0 ? _c / _r * 100 : 0 (an na range compares false: 0)
  const hh = A(ta.highest(S(bars.map((b) => b.high)), len));
  const ll = A(ta.lowest(S(bars.map((b) => b.low)), len));
  const raw = bars.map((b, i) => {
    const c = i >= len ? b.close - bars[i - len].close : NaN;
    const r = hh[i] - ll[i];
    return !isNaN(r) && Math.abs(r) > EPS ? (c / r) * 100 : 0;
  });
  const pcr = A(ta.ema(S(raw), cfg.smoothLen));
  const pcrEma = A(ta.ema(S(pcr), cfg.emaLen));

  // Zones, hold (ta.barssince(not above) >= holdBars) and the regime state
  const above = pcr.map((v) => gt(v, cfg.zone));
  const below = pcr.map((v) => lt(v, -cfg.zone));
  const sinceNotAbove = A(ta.barssince(S(above.map((x) => (x ? 0 : 1)))));
  const sinceNotBelow = A(ta.barssince(S(below.map((x) => (x ? 0 : 1)))));
  const bgUp = String(color.new(color.green, 85));
  const bgDown = String(color.new(color.red, 85));
  const bgFlat = String(color.new(color.gray, 85));
  const bgColors: BgColorData[] = [];
  let regime = 0;
  for (let i = 0; i < n; i++) {
    const neutral = !above[i] && !below[i];
    if (above[i] && sinceNotAbove[i] >= cfg.holdBars) regime = 1;
    else if (below[i] && sinceNotBelow[i] >= cfg.holdBars) regime = -1;
    else if (neutral) regime = 0;
    bgColors.push({ time: bars[i].time, color: regime === 1 ? bgUp : regime === -1 ? bgDown : bgFlat });
  }

  const hlines: NonNullable<IndicatorResult['hlines']> = [];
  const level = (show: boolean, value: number, title: string, c: string) => {
    if (show) hlines.push({ value, options: { title, color: c, linestyle: 'dashed' } });
  };
  level(cfg.show100, 100, '100', color.blue);
  level(cfg.show70, 70, '70', color.green);
  level(cfg.show0, 0, '0', String(color.rgb(251, 251, 253)));
  level(cfg.showNeg70, -70, '-70', color.red);
  level(cfg.showNeg100, -100, '-100', color.maroon);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: pcr[i], color: gt(pcr[i], 0) ? color.lime : color.red })),
      plot1: bars.map((b, i) => ({ time: b.time, value: cfg.showEMA ? pcrEma[i] : NaN, color: color.purple })),
    },
    hlines,
    bgColors,
  };
}

export const PcrMarketRegimeIndicator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
