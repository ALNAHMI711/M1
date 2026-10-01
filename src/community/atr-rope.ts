/**
 * ATR Rope
 *
 * A "rope" follows the source like rope stabilisation in a drawing application: it moves only by the part of the
 * source move that is beyond a threshold of ATR(length) * multiplier (a range filter). The rope colour shows its
 * direction (up / down), and turns to the flat colour when the source crosses the rope. While the direction is
 * flat, consolidation ranges are the running averages of the upper and lower ATR channel lines since the start of
 * the flat period, drawn with a fill; two alternating plot pairs separate consecutive ranges.
 *
 * Reference: "ATR Rope" by SamRecio
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface ATRRopeInputs {
  /** Source (Pine nz(source)) */
  src: SourceType;
  /** ATR length */
  len: number;
  /** ATR multiplier: threshold of the rope */
  multi: number;
  /** Show the consolidation ranges */
  rngTog: boolean;
  /** Show the ATR channel (upper / lower lines) */
  atrTog: boolean;
  upCol: string;
  downCol: string;
  flatCol: string;
  /** Fill colour of the consolidation ranges (the range lines use it without transparency) */
  rngCol: string;
}

export const defaultInputs: ATRRopeInputs = {
  src: 'close',
  len: 14,
  multi: 1.5,
  rngTog: true,
  atrTog: false,
  upCol: '#3daa45',
  downCol: '#ff033e',
  flatCol: '#004d92',
  rngCol: '#004d9233',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'len', type: 'int', title: 'ATR Len', defval: 14 },
  { id: 'multi', type: 'float', title: 'Multi', defval: 1.5, min: 0, step: 0.25 },
  { id: 'rngTog', type: 'bool', title: 'Consolidation Ranges', defval: true },
  { id: 'atrTog', type: 'bool', title: 'ATR Channel', defval: false },
  { id: 'upCol', type: 'color', title: 'Up Color', defval: '#3daa45' },
  { id: 'downCol', type: 'color', title: 'Down Color', defval: '#ff033e' },
  { id: 'flatCol', type: 'color', title: 'Flat Color', defval: '#004d92' },
  { id: 'rngCol', type: 'color', title: 'Range Color', defval: '#004d9233' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Rope', color: '#004d92', lineWidth: 3 },
  { id: 'plot1', title: 'Upper', color: '#004d92', lineWidth: 1, visible: 'atrTog' },
  { id: 'plot2', title: 'Lower', color: '#004d92', lineWidth: 1, visible: 'atrTog' },
  { id: 'plot3', title: 'Range High 1', color: '#004d92', lineWidth: 1, style: 'linebr', visible: 'rngTog' },
  { id: 'plot4', title: 'Range Low 1', color: '#004d92', lineWidth: 1, style: 'linebr', visible: 'rngTog' },
  { id: 'plot5', title: 'Range High 2', color: '#004d92', lineWidth: 1, style: 'linebr', visible: 'rngTog' },
  { id: 'plot6', title: 'Range Low 2', color: '#004d92', lineWidth: 1, style: 'linebr', visible: 'rngTog' },
];

export const metadata = {
  title: 'ATR Rope',
  shortTitle: 'ATR Rope',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<ATRRopeInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const nz = (v: number) => (isNaN(v) ? 0 : v);

  // src = nz(input.source(close)); atr = ta.atr(len) * multi
  const src = getSourceSeries(bars, cfg.src).toArray().map((v) => nz(v ?? NaN));
  const atr = ta.atr(bars, cfg.len).toArray().map((v) => (v ?? NaN) * cfg.multi);

  const rope: number[] = new Array(n);
  const upper: number[] = new Array(n);
  const lower: number[] = new Array(n);
  const dir: number[] = new Array(n);
  const cHi: number[] = new Array(n);
  const cLo: number[] = new Array(n);
  const ff: boolean[] = new Array(n);

  let ropeVar = NaN; // var float _rope = _src (first bar)
  let dirVar = 0; // var dir = 0
  let cHiVar = NaN; // var float c_hi = na
  let cLoVar = NaN; // var float c_lo = na
  let hSum = 0; // var float h_sum = 0
  let lSum = 0; // var float l_sum = 0
  let cCount = 0; // var int c_count = 0
  let ffVar = true; // var ff = true
  for (let i = 0; i < n; i++) {
    // rope_smoother(src, atr): _rope += max(|_move| - nz(_threshold), 0) * sign(_move)
    if (i === 0) ropeVar = src[0];
    const move = src[i] - ropeVar;
    ropeVar += Math.max(Math.abs(move) - nz(atr[i]), 0) * Math.sign(move);
    rope[i] = ropeVar;
    upper[i] = ropeVar + atr[i];
    lower[i] = ropeVar - atr[i];

    // dir := rope > rope[1] ? 1 : rope < rope[1] ? -1 : dir (rope[1] is na on the first bar)
    const prevRope = i > 0 ? rope[i - 1] : NaN;
    dirVar = gt(rope[i], prevRope) ? 1 : lt(rope[i], prevRope) ? -1 : dirVar;
    // if ta.cross(src, rope): dir := 0. Pine's cross needs a strict inequality on the previous bar too
    // (src[1] < rope[1] before a cross up, src[1] > rope[1] before a cross down): a bar where src == rope does
    // not start a cross. ta.cross compares exactly (no 1e-10 tolerance).
    if (i > 0) {
      const crossUp = src[i] > rope[i] && src[i - 1] < rope[i - 1];
      const crossDown = src[i] < rope[i] && src[i - 1] > rope[i - 1];
      if (crossUp || crossDown) dirVar = 0;
    }
    dir[i] = dirVar;

    // if dir == 0: if dir[1] != 0 -> reset the sums and flip ff; accumulate upper / lower
    // (dir[1] is na on the first bar: na != 0 is false)
    if (dirVar === 0) {
      if (i > 0 && dir[i - 1] !== 0) {
        hSum = 0;
        lSum = 0;
        cCount = 0;
        ffVar = !ffVar;
      }
      hSum += upper[i];
      lSum += lower[i];
      cCount += 1;
      cHiVar = hSum / cCount;
      cLoVar = lSum / cCount;
    }
    cHi[i] = cHiVar;
    cLo[i] = cLoVar;
    ff[i] = ffVar;
  }

  // col = dir > 0 ? up_col : dir < 0 ? down_col : flat_col
  const col = (i: number) => (dir[i] > 0 ? cfg.upCol : dir[i] < 0 ? cfg.downCol : cfg.flatCol);
  // Range lines: color.new(rng_col, 0)
  const rngLine = String(color.new(cfg.rngCol, 0));
  const fillCol = cfg.rngTog ? cfg.rngCol : 'transparent';

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      // plot(rope, linewidth = 3, color = col, force_overlay = true)
      plot0: bars.map((b, i) => ({ time: b.time, value: rope[i], color: col(i) })),
      // plot(upper / lower, color = col, display = atr_tog ? display.all : display.none)
      plot1: bars.map((b, i) => ({ time: b.time, value: upper[i], color: col(i) })),
      plot2: bars.map((b, i) => ({ time: b.time, value: lower[i], color: col(i) })),
      // h1 = plot(ff ? na : c_hi), l1 = plot(ff ? na : c_lo), h2 = plot(ff ? c_hi : na), l2 = plot(ff ? c_lo : na)
      plot3: bars.map((b, i) => ({ time: b.time, value: ff[i] ? NaN : cHi[i], color: rngLine })),
      plot4: bars.map((b, i) => ({ time: b.time, value: ff[i] ? NaN : cLo[i], color: rngLine })),
      plot5: bars.map((b, i) => ({ time: b.time, value: ff[i] ? cHi[i] : NaN, color: rngLine })),
      plot6: bars.map((b, i) => ({ time: b.time, value: ff[i] ? cLo[i] : NaN, color: rngLine })),
    },
    // fill(h1, l1, rng_col); fill(h2, l2, rng_col) (display = rng_tog ? display.all : display.none)
    fills: [
      { plot1: 'plot3', plot2: 'plot4', colors: new Array<string>(n).fill(fillCol) },
      { plot1: 'plot5', plot2: 'plot6', colors: new Array<string>(n).fill(fillCol) },
    ],
    markers: [],
  };
}

export const ATRRope = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
