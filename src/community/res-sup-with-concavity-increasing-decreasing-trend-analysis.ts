/**
 * Res/Sup With Concavity and Increasing / Decreasing Trend Analysis
 *
 * Resistance = highest high of 20 bars, support = lowest low of 20 bars; each level snaps back to its own value of
 * k bars ago (k = 1..19, in that order) when it is within 0.1 % of it. An x-cross marks a high at or above the
 * previous resistance (above the bar) and a low at or below the previous support (below the bar).
 * Two thick lines: SMA(high, 50) + 10 % of the close, yellow when the source is above the SMA 50 bars ago (first
 * derivative up), else dark red; SMA(hlc3, 10) + 12 % of the close, orange when that difference grew over 20 bars
 * (second derivative up), else black. The fill between them is green when both are up, white when one is up, else
 * red. The background is yellow when the 10-bar linear regression of the source stayed within `rangeAccuracy` of
 * its value 10 bars before on the last six bars (a range), else black (both at 90 % transparency).
 *
 * Reference: "Res/Sup" by Celar (published as "Res/Sup With Concavity & Increasing / Decreasing Trend Analysis")
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Celar
 */

import { taCore, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';

export interface ResSupWithConcavityInputs {
  /** Source of the first derivative and of the linear regression */
  src: SourceType;
  /** Relative range of the linear regression that counts as a range */
  rangeAccuracy: number;
}

export const defaultInputs: ResSupWithConcavityInputs = {
  src: 'hlc3',
  rangeAccuracy: 0.005,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'src', defval: 'hlc3' },
  { id: 'rangeAccuracy', type: 'float', title: 'Range Accuracy', defval: 0.005 },
];

const RED = String(color.new(color.red, 0));
const GREEN = String(color.new(color.green, 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Resistance', color: RED, lineWidth: 1 },
  { id: 'plot1', title: 'Support', color: GREEN, lineWidth: 1 },
  { id: 'plot2', title: 'First Derivative', color: color.yellow, lineWidth: 3 },
  { id: 'plot3', title: 'Second Derivative', color: color.orange, lineWidth: 3 },
];

export const metadata = {
  title: 'Res/Sup',
  shortTitle: 'Res/Sup',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<ResSupWithConcavityInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const src = getSourceSeries(bars, cfg.src).toArray().map((v) => v ?? NaN);
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  const hlc3 = bars.map((b) => (b.high + b.low + b.close) / 3);
  const at = (a: number[], i: number) => (i >= 0 ? a[i] : NaN);

  const d = taCore.sma(high, 50);
  const d2 = taCore.sma(hlc3, 10);
  const rawRes = taCore.highest(high, 20);
  const rawSup = taCore.lowest(low, 20);

  // Res := Res[k] when Res is within margin of Res[k]; Res[k] is the final Res of k bars ago
  const margin = 0.001;
  const res: number[] = new Array(n);
  const sup: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    let r = rawRes[i];
    for (let k = 1; k <= 19; k++) {
      const rk = at(res, i - k);
      // The last test uses Sup_19 in its upper limit, as the Pine source
      const upper = k === 19 ? rk + at(sup, i - k) * margin : rk + rk * margin;
      if (ge(r, rk - rk * margin) && le(r, upper)) r = rk;
    }
    res[i] = r;
    let s = rawSup[i];
    for (let k = 1; k <= 19; k++) {
      const sk = at(sup, i - k);
      if (ge(s, sk - sk * margin) && le(s, sk + sk * margin)) s = sk;
    }
    sup[i] = s;
  }

  const markers: MarkerData[] = [];
  for (let i = 0; i < n; i++) {
    // bo_circ_R = high >= Res[1] ? close : na; plotshape(bo_circ_R, style = shape.xcross) (location.abovebar)
    if (ge(high[i], at(res, i - 1)) && !isNaN(bars[i].close)) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'xcross', color: RED });
    }
    // bo_circ_S = low <= Sup[1] ? close : na; plotshape(bo_circ_S, style = shape.xcross, location = location.belowbar)
    if (le(low[i], at(sup, i - 1)) && !isNaN(bars[i].close)) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'xcross', color: GREEN });
    }
  }

  // delsrc = src - d[50]; del2src = delsrc - delsrc[20]
  const delsrc = src.map((x, i) => x - at(d, i - 50));
  const del2src = delsrc.map((x, i) => x - at(delsrc, i - 20));
  const fillColors = bars.map((_b, i) => (gt(delsrc[i], 0) && gt(del2src[i], 0) ? '#43D973'
    : gt(delsrc[i], 0) || gt(del2src[i], 0) ? color.white : color.red));

  // Range: the linear regression within rangeAccuracy of its value 10 bars before
  const linReg = taCore.linreg(src, 10, 0);
  const vari = cfg.rangeAccuracy;
  const rangeEnd = linReg.map((l, i) => {
    const l10 = at(linReg, i - 10);
    return ge(l, l10 - l10 * vari) && le(l, l10 + l10 * vari) ? at(hlc3, i - 20) : NaN;
  });
  const yellowBg = String(color.new(color.yellow, 90));
  const blackBg = String(color.new(color.black, 90));
  const bgColors: BgColorData[] = bars.map((b, i) => {
    let inRange = true;
    for (let j = 0; j <= 5 && inRange; j++) inRange = eq(at(rangeEnd, i - j), at(hlc3, i - 20 - j));
    return { time: b.time, color: inRange ? yellowBg : blackBg };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: res[i], color: RED })),
      plot1: bars.map((b, i) => ({ time: b.time, value: sup[i], color: GREEN })),
      plot2: bars.map((b, i) => ({
        time: b.time, value: d[i] + b.close * 0.1, color: gt(delsrc[i], 0) ? color.yellow : '#D10101',
      })),
      plot3: bars.map((b, i) => ({
        time: b.time, value: d2[i] + b.close * 0.12, color: gt(del2src[i], 0.015899) ? color.orange : color.black,
      })),
    },
    fills: [{ plot1: 'plot2', plot2: 'plot3', colors: fillColors }],
    markers,
    bgColors,
  };
}

export const ResSupWithConcavity = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
