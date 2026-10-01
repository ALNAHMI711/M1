/**
 * Buyers & Sellers / Range
 *
 * Buying pressure bp = close - min(low, close[1]) and selling pressure sp = max(high, close[1]) - close (minus the
 * lower / upper wick with the Body / Range option). Each one is divided by the true range, smoothed by an EMA of
 * `BSP Length` bars, then by a 10-pole Gaussian filter, and scaled to percent. The lines are coloured by their
 * direction; four fills between them show which side leads and whether it grows or falls. A dashed line at 50 %.
 *
 * Reference: "Buyers & Sellers / Range" by fract
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © fract
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface BuyersSellersRangeInputs {
  /** EMA length of the pressure / true range ratios */
  ln: number;
  /** Body / Range: subtract the relevant wick from the pressures */
  sw: boolean;
}

export const defaultInputs: BuyersSellersRangeInputs = {
  ln: 10,
  sw: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'ln', type: 'int', title: 'BSP Length', defval: 10, min: 1 },
  {
    id: 'sw', type: 'bool', title: 'Body / Range', defval: false,
    tooltip: 'BSP Body / Range where Bullish & Bearish Body = Buying & Selling Pressure - Relevant Wick',
  },
];

const BP_GROW = '#40af40';
const BP_FALL = '#2962ff';
const SP_GROW = '#f23645';
const SP_FALL = '#f57f17';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'BP/ATR', color: BP_FALL, lineWidth: 1 },
  { id: 'plot1', title: 'SP/ATR', color: SP_FALL, lineWidth: 1 },
];

export const metadata = {
  title: 'Buyers & Sellers / Range',
  shortTitle: 'BSP/ATR',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** 10-pole Gaussian filter gaus(source) of the script; nz() of the previous values */
function gaus(source: number[]): number[] {
  const pi = Math.PI;
  const beta = (1 - Math.cos((2 * pi) / 10)) / (Math.pow(2, 0.1) - 1);
  const alpha = -beta + Math.sqrt(Math.pow(beta, 2) + 2 * beta);
  const out: number[] = new Array(source.length);
  const f = (i: number, k: number) => {
    const v = i - k >= 0 ? out[i - k] : NaN;
    return isNaN(v) ? 0 : v;
  };
  for (let i = 0; i < source.length; i++) {
    out[i] = Math.pow(alpha, 10) * source[i] + 10 * (1 - alpha) * f(i, 1) - 45 * Math.pow(1 - alpha, 2) * f(i, 2)
      + 120 * Math.pow(1 - alpha, 3) * f(i, 3) - 210 * Math.pow(1 - alpha, 4) * f(i, 4)
      + 252 * Math.pow(1 - alpha, 5) * f(i, 5) - 210 * Math.pow(1 - alpha, 6) * f(i, 6)
      + 120 * Math.pow(1 - alpha, 7) * f(i, 7) - 45 * Math.pow(1 - alpha, 8) * f(i, 8)
      + 10 * Math.pow(1 - alpha, 9) * f(i, 9) - Math.pow(1 - alpha, 10) * f(i, 10);
  }
  return out;
}

export function calculate(bars: Bar[], inputs: Partial<BuyersSellersRangeInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  // ta.tr: na on the first bar (no previous close)
  const tr = A(ta.tr(bars, false));
  const bpRatio: number[] = new Array(n);
  const spRatio: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const prevClose = i > 0 ? bars[i - 1].close : NaN;
    const uw = b.high - Math.max(b.open, b.close);
    const lw = Math.min(b.open, b.close) - b.low;
    // math.min / math.max with an na argument give na
    const bp = b.close - Math.min(b.low, prevClose) - (cfg.sw ? lw : 0);
    const sp = Math.max(b.high, prevClose) - b.close - (cfg.sw ? uw : 0);
    // plain division: x / 0 is +-infinity, 0 / 0 NaN (ta.ema skips both)
    bpRatio[i] = bp / tr[i];
    spRatio[i] = sp / tr[i];
  }
  const bptr = gaus(A(ta.ema(S(bpRatio), cfg.ln))).map((v) => v * 100);
  const sptr = gaus(A(ta.ema(S(spRatio), cfg.ln))).map((v) => v * 100);

  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const prev = (a: number[], i: number) => (i > 0 ? a[i - 1] : NaN);
  const plot0 = bars.map((b, i) => ({ time: b.time, value: fin(bptr[i]), color: gt(bptr[i], prev(bptr, i)) ? BP_GROW : BP_FALL }));
  const plot1 = bars.map((b, i) => ({ time: b.time, value: fin(sptr[i]), color: gt(sptr[i], prev(sptr, i)) ? SP_GROW : SP_FALL }));

  const c1 = String(color.rgb(0, 255, 0, 85));
  const c2 = String(color.rgb(0, 68, 255, 85));
  const c3 = String(color.rgb(255, 0, 0, 85));
  const c4 = String(color.rgb(255, 172, 48, 85));
  const none = 'transparent';
  const fills = [
    // fill(bpp, spp, bptr > sptr and bptr > bptr[1] ? color.rgb(0, 255, 0, 85) : na)
    { plot1: 'plot0', plot2: 'plot1', colors: bars.map((_b, i) => (gt(bptr[i], sptr[i]) && gt(bptr[i], prev(bptr, i)) ? c1 : none)) },
    // fill(bpp, spp, bptr > sptr and bptr < bptr[1] ? color.rgb(0, 68, 255, 85) : na)
    { plot1: 'plot0', plot2: 'plot1', colors: bars.map((_b, i) => (gt(bptr[i], sptr[i]) && lt(bptr[i], prev(bptr, i)) ? c2 : none)) },
    // fill(bpp, spp, bptr < sptr and sptr > sptr[1] ? color.rgb(255, 0, 0, 85) : na)
    { plot1: 'plot0', plot2: 'plot1', colors: bars.map((_b, i) => (lt(bptr[i], sptr[i]) && gt(sptr[i], prev(sptr, i)) ? c3 : none)) },
    // fill(bpp, spp, bptr < sptr and sptr < sptr[1] ? color.rgb(255, 172, 48, 85) : na)
    { plot1: 'plot0', plot2: 'plot1', colors: bars.map((_b, i) => (lt(bptr[i], sptr[i]) && lt(sptr[i], prev(sptr, i)) ? c4 : none)) },
  ];

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1 },
    // hline(50, '50%', color.gray, hline.style_dashed, 1, false)
    hlines: [{ value: 50, options: { title: '50%', color: color.gray, linestyle: 'dashed', linewidth: 1 } }],
    fills,
  };
}

export const BuyersSellersRange = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
