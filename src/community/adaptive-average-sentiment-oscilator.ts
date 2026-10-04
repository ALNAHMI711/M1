/**
 * Adaptive Average Sentiment Oscilator (Adaptive ASO autoATR)
 *
 * An average sentiment oscillator with adaptive smoothing. The efficiency ratio of the close (net change over
 * max_len bars / volume-weighted sum of the bar changes) sets the length (min_len to max_len), the offset and the
 * sigma of a dynamic ALMA. Bull sentiment of the bar ((src - low + high - open) * 50 / range) and of the group of
 * the last `length` bars (same formula with the group high / low / open) are averaged (or one of them by the mode),
 * weighted by log(volume + 1) and smoothed by the dynamic ALMA; bears = 100 - bulls. With the Gaussian rank
 * normalisation, each line becomes the percentage of the last N values below it (ties count half), where N moves
 * between 3 x length and 100-300 bars (from the close-volume correlation) by tanh(|z-score| / 2) of the ratio of a
 * fast to a slow normalised ATR. Bulls line coloured lime above the gray zone, red below it; gradient fills beyond
 * the OB / OS levels and a gray zone fill.
 *
 * Reference: "Adaptive ASO autoATR" by Zomzi
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, taCore, callsite, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export type AdaptiveAsoMode = 'Average' | 'Intra-bar' | 'Group';

export interface AdaptiveAverageSentimentOscilatorInputs {
  /** Data source */
  src: SourceType;
  /** Minimum ALMA length */
  minLen: number;
  /** Maximum ALMA length (also the efficiency ratio length) */
  maxLen: number;
  minOff: number;
  maxOff: number;
  minSig: number;
  maxSig: number;
  /** Overbought level */
  obLevel: number;
  /** Oversold level */
  osLevel: number;
  /** Width of the gray zone centred on 50 */
  gzWidth: number;
  /** Lines at 50 inside the gray zone */
  hideInGz: boolean;
  /** Gaussian rank normalisation */
  useNorm: boolean;
  mode: AdaptiveAsoMode;
}

export const defaultInputs: AdaptiveAverageSentimentOscilatorInputs = {
  src: 'hl2',
  minLen: 3,
  maxLen: 14,
  minOff: 0.175,
  maxOff: 0.275,
  minSig: 3.0,
  maxSig: 5.0,
  obLevel: 68.0,
  osLevel: 32.0,
  gzWidth: 15.0,
  hideInGz: false,
  useNorm: true,
  mode: 'Average',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Data Source', defval: 'hl2' },
  { id: 'minLen', type: 'int', title: 'Min. Length', defval: 3, min: 1 },
  { id: 'maxLen', type: 'int', title: 'Max. Length', defval: 14, min: 5 },
  { id: 'minOff', type: 'float', title: 'Min. Offset', defval: 0.175, min: 0.0, step: 0.025 },
  { id: 'maxOff', type: 'float', title: 'Max. Offset', defval: 0.275, min: 0.0, step: 0.025 },
  { id: 'minSig', type: 'float', title: 'Min. Sigma', defval: 3.0, min: 0.0, step: 0.25 },
  { id: 'maxSig', type: 'float', title: 'Max. Sigma', defval: 5.0, min: 0.0, step: 0.25 },
  { id: 'obLevel', type: 'float', title: 'Overbought Level (OB)', defval: 68.0, min: 50.1, max: 100.0 },
  { id: 'osLevel', type: 'float', title: 'Oversold Level (OS)', defval: 32.0, min: 0.0, max: 49.9 },
  { id: 'gzWidth', type: 'float', title: 'Zone Width (45 to 55)', defval: 15.0, min: 0.0 },
  { id: 'hideInGz', type: 'bool', title: 'Mute Sentiment Lines inside Gray Zone?', defval: false },
  { id: 'useNorm', type: 'bool', title: 'Enable Gaussian Rank Normalization?', defval: true },
  { id: 'mode', type: 'string', title: 'Calc Method', defval: 'Average', options: ['Average', 'Intra-bar', 'Group'] },
];

const BEARS_COLOR = String(color.new(color.gray, 60));
const OB_COLOR = String(color.new(color.red, 40));
const OS_COLOR = String(color.new(color.green, 40));
const GZ_COLOR = String(color.new(color.gray, 85));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Adaptive Bulls', color: color.gray, lineWidth: 3 },
  { id: 'plot1', title: 'Adaptive Bears', color: BEARS_COLOR, lineWidth: 1 },
  { id: 'plot2', title: 'Manual OB Level', color: OB_COLOR, lineWidth: 1 },
  { id: 'plot3', title: 'Manual OS Level', color: OS_COLOR, lineWidth: 1 },
  { id: 'plot4', title: 'GZ Upper', color: GZ_COLOR, lineWidth: 1 },
  { id: 'plot5', title: 'GZ Lower', color: GZ_COLOR, lineWidth: 1 },
];

export const metadata = {
  title: 'Adaptive ASO autoATR',
  shortTitle: 'Adaptive ASO',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS) && !(b - a > EPS);
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
/** Pine nz(): na and +-infinity give the replacement */
const nz = (v: number, r = 0) => (Number.isFinite(v) ? v : r);
/** Pine math.max / math.min: na when an argument is na */
const max = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.max(a, b));
const min = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.min(a, b));
/** Pine int(math.round(x)): half away from zero; na stays na */
const roundInt = (x: number) => (isNaN(x) ? NaN : Math.sign(x) * Math.round(Math.abs(x)));

export function calculate(
  bars: Bar[],
  inputs: Partial<AdaptiveAverageSentimentOscilatorInputs> = {},
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const { minLen, maxLen, minOff, maxOff, minSig, maxSig } = cfg;
  const gzUpper = 50.0 + cfg.gzWidth / 2;
  const gzLower = 50.0 - cfg.gzWidth / 2;

  const close = bars.map((b) => b.close);
  const volume = bars.map((b) => b.volume ?? NaN);
  const src = A(getSourceSeries(bars, cfg.src));

  // Efficiency ratio
  const absChange = close.map((c, i) => (i > 0 ? Math.abs(c - close[i - 1]) : NaN));
  const vwma = A(ta.vwma(S(absChange), maxLen, S(volume)));
  // ATR ratio
  const atrFast = A(ta.atr(bars, 14));
  const atrSlow = A(ta.atr(bars, 100));
  const volRatio = close.map((c, i) => {
    const natrFast = (atrFast[i] / max(c, 1e-10)) * 100;
    const natrSlow = (atrSlow[i] / max(c, 1e-10)) * 100;
    return nz(natrFast / max(natrSlow, 1e-10), 1.0);
  });
  const vrMean = A(ta.sma(S(volRatio), 200));
  const vrStdev = A(ta.stdev(S(volRatio), 200));
  const corr = A(ta.correlation(S(close), S(volume), 50));

  // is_frozen = ta.sma(high - low, 5) == 0 or ta.change(close) == 0 and ta.change(volume) == 0
  // (lazy or / and: each ta.change only runs on the bars where its operand is evaluated)
  const rangeSma = A(ta.sma(S(bars.map((b) => b.high - b.low)), 5));
  const leftFrozen = rangeSma.map((v) => eq(v, 0));
  const closeChange = callsite.whenCalled(leftFrozen.map((f) => !f), (x) => taCore.change(x, 1), close) as number[];
  const volCalled = leftFrozen.map((f, i) => !f && eq(closeChange[i], 0));
  const volChange = callsite.whenCalled(volCalled, (x) => taCore.change(x, 1), volume) as number[];
  const isFrozen = leftFrozen.map((f, i) => f || (volCalled[i] && eq(volChange[i], 0)));

  const currLen: number[] = new Array(n);
  const currOff: number[] = new Array(n);
  const currSig: number[] = new Array(n);
  const dynNormLen: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const erChange = Math.abs(close[i] - nz(i >= maxLen ? close[i - maxLen] : NaN, close[i]));
    const erVol = vwma[i] * maxLen;
    const er = max(0.0, min(1.0, nz(erChange / max(erVol, 1e-10), 0.0)));
    currLen[i] = roundInt(max(minLen, min(maxLen, maxLen - er * (maxLen - minLen))));
    currOff[i] = max(minOff, min(maxOff, minOff + er * (maxOff - minOff)));
    currSig[i] = max(minSig, min(maxSig, maxSig - er * (maxSig - minSig)));

    const vrZ = eq(vrStdev[i], 0) ? 0.0 : (volRatio[i] - vrMean[i]) / vrStdev[i];
    const autoMaxLen = roundInt(max(100, min(300, 200 + corr[i] * 100)));
    const autoMinLen = roundInt(max(10, currLen[i] * 3));
    const x = Math.abs(vrZ) / 2.0;
    const ex = Math.exp(x);
    const enx = Math.exp(-x);
    const vrTanh = (ex - enx) / max(ex + enx, 1e-10);
    const vrGaussScaled = max(0.0, min(1.0, vrTanh));
    const finalGaussScale = isFrozen[i] ? 0.0 : vrGaussScaled;
    dynNormLen[i] = roundInt(autoMaxLen - finalGaussScale * (autoMaxLen - autoMinLen));
  }

  // Sentiment
  const vData = volume.map((v) => Math.log((gt(v, 0) ? v : 1.0) + 1));
  const lowestSite = callsite.lowest();
  const highestSite = callsite.highest();
  const tempBulls: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const intrarange = b.high - b.low;
    const k1 = eq(intrarange, 0) ? 1.0 : intrarange;
    const groupLow = lowestSite(b.low, currLen[i]);
    const groupHigh = highestSite(b.high, currLen[i]);
    const back = i - (currLen[i] - 1);
    const groupOpen = nz(back >= 0 && back <= i ? bars[back].open : NaN, b.open);
    const k2 = max(groupHigh - groupLow, 1e-10);
    const intrabarBulls = ((src[i] - b.low + b.high - b.open) * 50) / k1;
    const groupBulls = ((src[i] - groupLow + groupHigh - groupOpen) * 50) / k2;
    tempBulls[i] = cfg.mode === 'Average' ? (intrabarBulls + groupBulls) / 2
      : cfg.mode === 'Intra-bar' ? intrabarBulls : groupBulls;
  }
  const weighted = tempBulls.map((t, i) => t * vData[i]);

  // f_alma_dynamic(_src, _len, _off, _sig)
  const alma = (s: number[], i: number): number => {
    const l = Math.max(2, Math.trunc(currLen[i]));
    const m = currOff[i] * (l - 1);
    const sd = l / currSig[i];
    const s22 = 2 * (sd * sd);
    let v = 0.0;
    let w = 0.0;
    for (let k = 0; k <= l - 1; k++) {
      const diff = k - m;
      const weight = Math.exp(-(diff * diff) / s22);
      v += nz(i - k >= 0 ? s[i - k] : NaN) * weight;
      w += weight;
    }
    return v / Math.max(w, 1e-10);
  };
  const bullsRaw = new Array<number>(n);
  for (let i = 0; i < n; i++) bullsRaw[i] = alma(weighted, i) / max(alma(vData, i), 1e-10);
  const bearsRaw = bullsRaw.map((v) => 100 - v);

  // f_dynamic_rank_vector(data, dynamic_len): share of the last `limit` values below data (ties count half)
  const rank = (data: number[], i: number): number => {
    const limit = max(5, dynNormLen[i]);
    if (isNaN(limit)) return NaN; // for _i = 1 to na: no loop; 0 / na
    let count = 0.0;
    for (let k = 1; k <= limit; k++) {
      const past = i - k >= 0 ? data[i - k] : NaN;
      if (gt(data[i], past)) count += 1.0;
      else if (eq(data[i], past)) count += 0.5;
    }
    return (count / limit) * 100;
  };
  const bullsNorm = bullsRaw.map((v, i) => (cfg.useNorm ? rank(bullsRaw, i) : v));
  const bearsNorm = bearsRaw.map((v, i) => (cfg.useNorm ? rank(bearsRaw, i) : v));

  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const filteredBulls: number[] = new Array(n);
  const filteredBears: number[] = new Array(n);
  const asoColor: string[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const inGrayZone = ge(bullsNorm[i], gzLower) && le(bullsNorm[i], gzUpper);
    filteredBulls[i] = cfg.hideInGz && inGrayZone ? 50.0 : bullsNorm[i];
    filteredBears[i] = cfg.hideInGz && inGrayZone ? 50.0 : bearsNorm[i];
    asoColor[i] = gt(filteredBulls[i], gzUpper) ? color.lime : lt(filteredBulls[i], gzLower) ? color.red : color.gray;
  }

  const t = (i: number) => bars[i].time;
  const constant = (v: number, c: string) => bars.map((_b, i) => ({ time: t(i), value: v, color: c }));
  const fillArr = <T>(v: T) => new Array<T>(n).fill(v);
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((_b, i) => ({ time: t(i), value: fin(filteredBulls[i]), color: asoColor[i] })),
      plot1: bars.map((_b, i) => ({ time: t(i), value: fin(filteredBears[i]), color: BEARS_COLOR })),
      plot2: constant(cfg.obLevel, OB_COLOR),
      plot3: constant(cfg.osLevel, OS_COLOR),
      plot4: constant(gzUpper, GZ_COLOR),
      plot5: constant(gzLower, GZ_COLOR),
    },
    hlines: [{ value: 50, options: { title: 'Median', color: String(color.new(color.gray, 80)), linestyle: 'dashed' } }],
    fills: [
      // fill(p_bulls, p_ob, bulls > ob ? bulls : ob, ob, color.new(lime, 50), color.new(lime, 95))
      { plot1: 'plot0', plot2: 'plot2', gradient: {
        topValue: filteredBulls.map((v) => (gt(v, cfg.obLevel) ? v : cfg.obLevel)),
        bottomValue: fillArr(cfg.obLevel),
        topColor: fillArr<string | null>(String(color.new(color.lime, 50))),
        bottomColor: fillArr<string | null>(String(color.new(color.lime, 95))) } },
      // fill(p_bulls, p_os, bulls < os ? bulls : os, os, color.new(red, 95), color.new(red, 50))
      { plot1: 'plot0', plot2: 'plot3', gradient: {
        topValue: filteredBulls.map((v) => (lt(v, cfg.osLevel) ? v : cfg.osLevel)),
        bottomValue: fillArr(cfg.osLevel),
        topColor: fillArr<string | null>(String(color.new(color.red, 95))),
        bottomColor: fillArr<string | null>(String(color.new(color.red, 50))) } },
      // fill(p_gz_u, p_gz_l, color.new(color.gray, 95))
      { plot1: 'plot4', plot2: 'plot5', colors: fillArr(String(color.new(color.gray, 95))) },
    ],
  };
}

export const AdaptiveAverageSentimentOscilator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
