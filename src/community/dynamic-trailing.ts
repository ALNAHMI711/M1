/**
 * Dynamic Trailing (Zeiierman)
 *
 * A trailing line built from three parts: a supertrend of hl2 with a band of `mult` x ATR, where the ATR is an SMA
 * of a true range of hl2 (`atrLen`) smoothed by an EMA (`atrSmooth`); dynamic support / resistance from a GD
 * curve (three chained HMAs of the high / low combined with the GD factor) plus / minus mult x ATR, smoothed by an
 * SMA; and the lowest / highest close of `len` bars plus the ATR. Above the supertrend line the trail is the
 * average of the supertrend, the support and the lowest close + ATR; below it, the average of the supertrend, the
 * resistance and the highest close + ATR. A cloud edge is set one ATR x cloud width away from the trail, on the
 * side of the close. Both are smoothed by an EMA (`plotSmooth`). The trail is drawn while the supertrend direction
 * does not change; the line and the cloud are green when the close is above the trail, red otherwise.
 *
 * Reference: "Dynamic Trailing (Zeiierman)" by Zeiierman
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Zeiierman
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface DynamicTrailingInputs {
  /** ATR multiplier of the supertrend and of the support / resistance distance */
  mult: number;
  /** Length of the GD curve and of the lowest / highest close */
  len: number;
  /** SMA length of the support / resistance */
  smooth: number;
  /** GD factor */
  gdFactor: number;
  /** SMA length of the true range */
  atrLen: number;
  /** EMA length of the ATR */
  atrSmooth: number;
  /** EMA length of the plotted trail and cloud */
  plotSmooth: number;
  /** Cloud width (x ATR) */
  cloudWidth: number;
  /** Colour when the close is below the trail */
  upcol: string;
  /** Colour when the close is above the trail */
  dncol: string;
}

export const defaultInputs: DynamicTrailingInputs = {
  mult: 7.5,
  len: 26,
  smooth: 15,
  gdFactor: -1.2,
  atrLen: 100,
  atrSmooth: 20,
  plotSmooth: 3,
  cloudWidth: 1.0,
  upcol: '#f23645',
  dncol: '#089981',
};

export const inputConfig: InputConfig[] = [
  { id: 'mult', type: 'float', title: 'Mult', defval: 7.5, min: 1, step: 0.1 },
  { id: 'len', type: 'int', title: 'Len', defval: 26, min: 2 },
  { id: 'smooth', type: 'int', title: 'Smoothness', defval: 15, min: 1, step: 1 },
  { id: 'gdFactor', type: 'float', title: 'GD Factor', defval: -1.2, step: 0.1 },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 100, min: 1 },
  { id: 'atrSmooth', type: 'int', title: 'ATR Smoothing', defval: 20, min: 1 },
  { id: 'plotSmooth', type: 'int', title: 'Plot Smoothing', defval: 3, min: 1 },
  { id: 'cloudWidth', type: 'float', title: 'Cloud width', defval: 1.0, min: 0, step: 0.5 },
  { id: 'upcol', type: 'color', title: 'Bearish Color', defval: '#f23645' },
  { id: 'dncol', type: 'color', title: 'Bullish Color', defval: '#089981' },
];

const CLOUD_LINE = String(color.new(color.gray, 100));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Smart Trailing', color: '#089981', lineWidth: 1, style: 'linebr' },
  { id: 'plot1', title: 'Cloud', color: CLOUD_LINE, lineWidth: 1, style: 'linebr', display: 'none' },
];

export const metadata = {
  title: 'Dynamic Trailing (Zeiierman)',
  shortTitle: 'Dynamic Trailing (Zeiierman)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
/** Pine nz() */
const nz = (x: number) => (isNaN(x) ? 0 : x);

export function calculate(bars: Bar[], inputs: Partial<DynamicTrailingInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const close = bars.map((b) => b.close);
  const hl2 = bars.map((b) => (b.high + b.low) / 2);

  // ATR(hl2, atrLen): tr = max(src[1] - min(low, src[1]), max(high - low, src[1] - high)) (na on bar 0); SMA
  const tr = bars.map((b, i) => {
    const p = i > 0 ? hl2[i - 1] : NaN;
    return Math.max(p - Math.min(b.low, p), Math.max(b.high - b.low, p - b.high));
  });
  const rawAtr = A(ta.sma(S(tr), cfg.atrLen));
  const atr = A(ta.ema(S(rawAtr), cfg.atrSmooth));

  // supertrend(mult) on hl2
  const t: number[] = new Array(n).fill(NaN);
  const d: number[] = new Array(n).fill(NaN);
  let lPrev = NaN;
  let uPrev = NaN;
  let tPrev = NaN;
  for (let i = 0; i < n; i++) {
    let u = hl2[i] + cfg.mult * atr[i];
    let l = hl2[i] - cfg.mult * atr[i];
    const prevL = nz(lPrev);
    const prevU = nz(uPrev);
    const close1 = i > 0 ? close[i - 1] : NaN;
    l = gt(l, prevL) || lt(close1, prevL) ? l : prevL;
    u = lt(u, prevU) || gt(close1, prevU) ? u : prevU;
    const atr1 = i > 0 ? atr[i - 1] : NaN;
    // d := na(atr[1]) ? 1 : prevT == prevU ? close > u ? -1 : 1 : close < l ? 1 : -1
    let dir: number;
    if (isNaN(atr1)) dir = 1;
    else if (eq(tPrev, prevU)) dir = gt(close[i], u) ? -1 : 1;
    else dir = lt(close[i], l) ? 1 : -1;
    d[i] = dir;
    t[i] = dir === -1 ? l : u;
    lPrev = l;
    uPrev = u;
    tPrev = t[i];
  }

  // gd(src, len, f): three chained HMAs combined with the GD factor
  const gd = (src: number[]) => {
    const f = cfg.gdFactor;
    const e1 = A(ta.hma(S(src), cfg.len));
    const e2 = A(ta.hma(S(e1), cfg.len));
    const e3 = A(ta.hma(S(e2), cfg.len));
    const c1 = -f * f * f;
    const c2 = 3 * f * f + 3 * f * f * f;
    const c3 = -6 * f * f - 3 * f - 3 * f * f * f;
    const c4 = 1 + 3 * f + f * f * f + 3 * f * f;
    return src.map((x, i) => c1 * e3[i] + c2 * e2[i] + c3 * e1[i] + c4 * x);
  };
  const gdHigh = gd(bars.map((b) => b.high));
  const gdLow = gd(bars.map((b) => b.low));
  const up = A(ta.sma(S(gdHigh.map((x, i) => x + atr[i] * cfg.mult)), cfg.smooth));
  const down = A(ta.sma(S(gdLow.map((x, i) => x - atr[i] * cfg.mult)), cfg.smooth));

  // Trends(): ta.lowest / ta.highest sit in the two branches of the ternary, so each one only runs on the bars where
  // its branch is taken (rule found with probe plots of the values used):
  // - the source history is a ring of len + 1 slots indexed by bar_index, written only on those bars; close_[k] is
  //   the slot of bar i - k, which still holds an older call (len + 1 bars before) when the branch did not run on
  //   bar i - k; a slot never written is skipped;
  // - the extreme is kept with its bar; it is replaced by a new close that passes it, and the window
  //   close_[0 .. len - 1] is scanned again when the extreme is len bars old (the oldest bar wins a tie);
  // - na before bar len - 1.
  const ring = cfg.len + 1;
  const makeExtreme = (isLow: boolean) => {
    const buf: number[] = new Array(ring).fill(NaN);
    let ext = NaN;
    let extBar = -1;
    return (i: number, x: number) => {
      buf[i % ring] = x;
      if (isNaN(ext) || i - extBar >= cfg.len) {
        ext = NaN;
        for (let k = 0; k < cfg.len && i - k >= 0; k++) {
          const v = buf[(i - k) % ring];
          if (!isNaN(v) && (isNaN(ext) || (isLow ? v <= ext : v >= ext))) {
            ext = v;
            extBar = i - k;
          }
        }
      } else if (isLow ? x < ext : x > ext) {
        ext = x;
        extBar = i;
      }
      return i < cfg.len - 1 ? NaN : ext;
    };
  };
  const lowest = makeExtreme(true);
  const highest = makeExtreme(false);
  const tA: number[] = new Array(n);
  const tZ: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (gt(close[i], t[i])) {
      tA[i] = (t[i] + down[i] + (lowest(i, close[i]) + atr[i])) / 3;
    } else {
      tA[i] = (t[i] + up[i] + (highest(i, close[i]) + atr[i])) / 3;
    }
    tZ[i] = gt(close[i], tA[i]) ? tA[i] + atr[i] * cfg.cloudWidth : tA[i] - atr[i] * cfg.cloudWidth;
  }

  const tAPlot = A(ta.ema(S(tA), cfg.plotSmooth));
  const tZPlot = A(ta.ema(S(tZ), cfg.plotSmooth));

  const dnFill = String(color.new(cfg.dncol, 80));
  const upFill = String(color.new(cfg.upcol, 80));
  const above = (i: number) => gt(close[i], tAPlot[i]);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      // plot(sig and (d < 0 and d[1] < 0 or d > 0 and d[1] > 0) ? tA_plot : na, 'Smart Trailing', trendColor, linebr)
      plot0: bars.map((b, i) => {
        const same = i > 0 && ((d[i] < 0 && d[i - 1] < 0) || (d[i] > 0 && d[i - 1] > 0));
        return { time: b.time, value: same ? tAPlot[i] : NaN, color: above(i) ? cfg.dncol : cfg.upcol };
      }),
      // plot(sig ? tZ_plot : na, 'Cloud', color.new(color.gray, 100), display = display.none, linebr)
      plot1: bars.map((b, i) => ({ time: b.time, value: tZPlot[i], color: CLOUD_LINE })),
    },
    // fill(sigL, zoneL, close > tA_plot ? color.new(dncol, 80) : color.new(upcol, 80), 'Cloud')
    fills: [
      { plot1: 'plot0', plot2: 'plot1', options: { title: 'Cloud' }, colors: bars.map((_b, i) => (above(i) ? dnFill : upFill)) },
    ],
  };
}

export const DynamicTrailing = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
