/**
 * Efficiency Ratio Trend
 *
 * A step line that moves to the source only when the source leaves a band around the line. The band half width
 * blends two standard deviations of 2 * source with the Kaufman efficiency ratio er = |change(src, length)| /
 * sum(|change(src)|, length): dev = er * stdev(2 * src, fast) + (1 - er) * stdev(2 * src, slow). The trend turns up
 * (or down) when the relative step of the line is at least 1 % of ATR(14) / line; the line is cyan in an up trend and
 * purple otherwise.
 *
 * Reference: "Efficiency Ratio Trend [Achira Meegasthanne]" by achirameegasthanne
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, math, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface EfficiencyRatioTrendInputs {
  /** Sensitivity input of the Pine script (not used by its computation) */
  markrtStairsSen: number;
  /** Efficiency ratio length */
  length: number;
  /** Fast standard deviation length */
  fastLen: number;
  /** Slow standard deviation length */
  slowLen: number;
  src: SourceType;
}

export const defaultInputs: EfficiencyRatioTrendInputs = {
  markrtStairsSen: 2.0,
  length: 200,
  fastLen: 100,
  slowLen: 400,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'markrtStairsSen', type: 'float', title: '', defval: 2.0, min: 0.01 },
  { id: 'length', type: 'int', title: 'Length', defval: 200 },
  { id: 'fastLen', type: 'int', title: 'Fast Length', defval: 100 },
  { id: 'slowLen', type: 'int', title: 'Slow Length', defval: 400 },
  { id: 'src', type: 'source', title: 'Src', defval: 'close' },
];

const BULL_COL = String(color.new('#0df1c6', 20));
const BEAR_COL = '#871ee9';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Plot', color: BULL_COL, lineWidth: 3, style: 'stepline_diamond' },
];

export const metadata = {
  title: 'Efficiency Ratio Trend',
  shortTitle: 'Efficiency Ratio Trend',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
/** Pine a != b: false when a value is na */
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;

export function calculate(bars: Bar[], inputs: Partial<EfficiencyRatioTrendInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const srcS = getSourceSeries(bars, cfg.src);
  const src = A(srcS);

  // er = math.abs(ta.change(src, length)) / math.sum(math.abs(ta.change(src)), length)
  const chgLen = A(ta.change(srcS, cfg.length));
  const absChg = A(ta.change(srcS)).map((v) => Math.abs(v));
  const sumAbs = A(math.sum(S(absChg), cfg.length) as Series);
  const src2 = S(src.map((v) => v * 2));
  const sdFast = A(ta.stdev(src2, cfg.fastLen));
  const sdSlow = A(ta.stdev(src2, cfg.slowLen));
  const atr = A(ta.atr(bars, 14));

  const aArr: number[] = new Array(n);
  const isBull: boolean[] = new Array(n);
  let trend = 0; // var int trend = 0
  for (let i = 0; i < n; i++) {
    const er = Math.abs(chgLen[i]) / sumAbs[i];
    const dev = er * sdFast[i] + (1 - er) * sdSlow[i];
    // a := src > nz(a[1], src) + dev ? src : src < nz(a[1], src) - dev ? src : nz(a[1], src)
    const prevA = i > 0 && !isNaN(aArr[i - 1]) ? aArr[i - 1] : src[i];
    const a = gt(src[i], prevA + dev) ? src[i] : lt(src[i], prevA - dev) ? src[i] : prevA;
    aArr[i] = a;

    // delta = (a - a[1]) / a[1]
    const a1 = i > 0 ? aArr[i - 1] : NaN;
    const delta = (a - a1) / a1;
    // price_scale = a != 0 ? a : close; volatility_pct = atr / price_scale; threshold = volatility_pct * 0.01
    const priceScale = ne(a, 0) ? a : bars[i].close;
    const threshold = (atr[i] / priceScale) * 0.01;
    // if math.abs(delta) >= threshold: trend := delta > 0 ? 1 : 0 (else unchanged)
    if (ge(Math.abs(delta), threshold)) trend = gt(delta, 0) ? 1 : 0;
    isBull[i] = trend === 1;
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      // plot(a, color = isBullms ? bullCol : bearCol, linewidth = 3, style = plot.style_stepline_diamond, editable = false)
      plot0: bars.map((b, i) => ({
        time: b.time,
        value: Number.isFinite(aArr[i]) ? aArr[i] : NaN,
        color: isBull[i] ? BULL_COL : BEAR_COL,
      })),
    },
  };
}

export const EfficiencyRatioTrend = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
