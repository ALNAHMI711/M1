/**
 * Ultra Clean Support / Resistance Levels
 *
 * Pivot highs / lows (left / right lengths) of the high / low, read one bar later. The last pivot high is the
 * resistance level and the last pivot low the support level; each level is held until the next pivot. A level is
 * not coloured (not drawn) on the bar where its value changes, so each level is a separate flat segment. Each level
 * is drawn twice: shifted back by right length + 1 bars (on the pivot bar) and without a shift.
 *
 * Reference: "Ultra Clean Support / Resistance Levels" by Stocktitian
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Stocktitian
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { barInterval, barTime } from '../bar-time';

export interface UltraCleanSupportResistanceLevelsInputs {
  /** Pivot left length */
  pvtLenL: number;
  /** Pivot right length */
  pvtLenR: number;
}

export const defaultInputs: UltraCleanSupportResistanceLevelsInputs = {
  pvtLenL: 25,
  pvtLenR: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'pvtLenL', type: 'int', title: 'Pivot Length Left Hand Side', defval: 25, min: 1 },
  { id: 'pvtLenR', type: 'int', title: 'Pivot Length Right Hand Side', defval: 5, min: 1 },
];

const RES_COLOR = '#4c0042';
const SUP_COLOR = '#004c0a';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Resistance', color: RES_COLOR, lineWidth: 2 },
  { id: 'plot1', title: 'Support', color: SUP_COLOR, lineWidth: 2 },
  { id: 'plot2', title: 'Resistance 2', color: RES_COLOR, lineWidth: 2 },
  { id: 'plot3', title: 'Support 2', color: SUP_COLOR, lineWidth: 2 },
];

export const metadata = {
  title: 'Ultra Clean Support / Resistance Levels',
  shortTitle: 'U C Sup Res',
  overlay: true,
};

/** Pine `!=`: beyond 1e-10; false when a value is na */
const ne = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) > 1e-10;

type Point = { time: number; value: number; color: string };

export function calculate(
  bars: Bar[],
  inputs: Partial<UltraCleanSupportResistanceLevelsInputs> = {},
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const shunt = 1;
  // maxLvlLen = 0: the levels are always drawn (the ta.barssince counts are not used)

  const pvthi_ = A(ta.pivothigh(S(bars.map((b) => b.high)), cfg.pvtLenL, cfg.pvtLenR));
  const pvtlo_ = A(ta.pivotlow(S(bars.map((b) => b.low)), cfg.pvtLenL, cfg.pvtLenR));

  // pvthis := na(pvthi) ? pvthis[1] : pvthi, with pvthi = pvthi_[Shunt]
  const pvthis: number[] = new Array(n);
  const pvtlos: number[] = new Array(n);
  let hi = NaN;
  let lo = NaN;
  for (let i = 0; i < n; i++) {
    const ph = i >= shunt ? pvthi_[i - shunt] : NaN;
    const pl = i >= shunt ? pvtlo_[i - shunt] : NaN;
    if (!isNaN(ph)) hi = ph;
    if (!isNaN(pl)) lo = pl;
    pvthis[i] = hi;
    pvtlos[i] = lo;
  }
  // hipc = ta.change(pvthis) != 0 ? na : color (na change: coloured)
  const hipc = pvthis.map((v, i) => (i > 0 && ne(v - pvthis[i - 1], 0) ? 'transparent' : RES_COLOR));
  const lopc = pvtlos.map((v, i) => (i > 0 && ne(v - pvtlos[i - 1], 0) ? 'transparent' : SUP_COLOR));

  // offset = -pvtLenR - Shunt: the value of bar i is drawn on bar i - k
  const k = cfg.pvtLenR + shunt;
  const interval = barInterval(bars);
  const shifted = (vals: number[], cols: string[]): Point[] => {
    const out: Point[] = [];
    for (let i = k; i < n; i++) out.push({ time: barTime(bars, i - k, interval), value: vals[i], color: cols[i] });
    return out;
  };
  const plain = (vals: number[], cols: string[]): Point[] =>
    bars.map((b, i) => ({ time: b.time, value: vals[i], color: cols[i] }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: shifted(pvthis, hipc),
      plot1: shifted(pvtlos, lopc),
      plot2: plain(pvthis, hipc),
      plot3: plain(pvtlos, lopc),
    },
  };
}

export const UltraCleanSupportResistanceLevels = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
