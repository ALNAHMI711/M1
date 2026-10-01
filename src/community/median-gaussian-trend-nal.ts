/**
 * Median Gaussian Trend | NAL
 *
 * The rolling median of the source is smoothed by a Gaussian filter (weights exp(-0.5 * ((i - (len - 1) / 2) /
 * sigma)^2) over `len` bars). Bands: the filtered line +- a Gaussian-weighted standard deviation of it (weights
 * exp(-((i / period) / 2)^2) over `period` bars) times the upper / lower multipliers. The trend turns up when the close
 * is above the upper band and down when it is below the lower band, and keeps its state in between. Candles, bands,
 * glow lines and gradient fills from each band to the band midline take the trend colour.
 *
 * Reference: "Median Gaussian Trend | NAL" by NordicAlphaLab
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © NordicAlphaLab
 */

import { ta, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { PlotCandleData } from '../types';

export interface MedianGaussianTrendNalInputs {
  /** Colour set: 'Standard', 'Nordic' or 'Simple' */
  colMode: 'Standard' | 'Nordic' | 'Simple';
  src: SourceType;
  /** Length of the median and of the Gaussian filter */
  baseLen: number;
  /** Sigma of the Gaussian filter */
  gaussianSig: number;
  /** Length of the Gaussian deviation */
  sdLen: number;
  /** Upper band multiplier */
  sdMul: number;
  /** Lower band multiplier */
  sdMulb: number;
}

export const defaultInputs: MedianGaussianTrendNalInputs = {
  colMode: 'Standard',
  src: 'close',
  baseLen: 16,
  gaussianSig: 5,
  sdLen: 20,
  sdMul: 2.5,
  sdMulb: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'colMode', type: 'string', title: 'Color Mode', defval: 'Standard', options: ['Standard', 'Nordic', 'Simple'] },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'baseLen', type: 'int', title: 'Gaussian Length', defval: 16 },
  { id: 'gaussianSig', type: 'float', title: 'Sigma', defval: 5, step: 0.1 },
  { id: 'sdLen', type: 'int', title: 'Gaussian Volatility Length', defval: 20 },
  { id: 'sdMul', type: 'float', title: 'Upper Band', defval: 2.5, step: 0.1 },
  { id: 'sdMulb', type: 'float', title: 'Lower Band', defval: 2, step: 0.1 },
];

const COLOURS: Record<string, [string, string, string]> = {
  Standard: [String(color.rgb(0, 255, 200)), String(color.rgb(32, 94, 144)), color.gray],
  Nordic: [String(color.rgb(46, 161, 255)), String(color.rgb(150, 154, 169)), color.gray],
  Simple: [color.lime, color.red, color.gray],
};

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Band', color: color.gray, lineWidth: 1 },
  { id: 'plot1', title: 'Lower Band', color: color.gray, lineWidth: 1 },
  { id: 'plot2', title: 'Band Midline', color: color.white, lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Upper Band Glow', color: String(color.new(color.gray, 50)), lineWidth: 5 },
  { id: 'plot4', title: 'Lower Band Glow', color: String(color.new(color.gray, 50)), lineWidth: 5 },
];

export const metadata = {
  title: 'Median Gaussian Trend | NAL',
  shortTitle: 'Median Gaussian Trend',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

/** x[i] at bar b: na before the first bar */
const hist = (x: number[], b: number, i: number) => (b - i >= 0 ? x[b - i] : NaN);

export function calculate(
  bars: Bar[],
  inputs: Partial<MedianGaussianTrendNalInputs> = {},
): IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const [colUp, colDn, colNu] = COLOURS[cfg.colMode] ?? COLOURS.Standard;
  const src = getSourceSeries(bars, cfg.src);

  // median_raw = ta.median(fil_src, base_len)
  const medianRaw = ta.median(src, cfg.baseLen).toArray().map((v) => v ?? NaN);

  // gaussianFilter(median_raw, base_len, gaussian_sig): (len - 1) / 2 is a float division in Pine v6
  const len = cfg.baseLen;
  const medianBase: number[] = new Array(n);
  for (let b = 0; b < n; b++) {
    let totalWeight = 0.0;
    let weightedSum = 0.0;
    for (let i = 0; i <= len - 1; i++) {
      const weight = Math.exp(-0.5 * Math.pow((i - (len - 1) / 2) / cfg.gaussianSig, 2));
      totalWeight += weight;
      weightedSum += hist(medianRaw, b, i) * weight;
    }
    medianBase[b] = weightedSum / totalWeight;
  }

  // gaussianDeviation(median_base, sd_len): i / period is a float division in Pine v6
  const period = cfg.sdLen;
  const weights: number[] = [];
  let sumw = 0.0;
  for (let i = 0; i <= period - 1; i++) {
    const w = Math.exp(-Math.pow(i / period / 2, 2));
    weights.push(w);
    sumw += w;
  }
  const sdRange: number[] = new Array(n);
  for (let b = 0; b < n; b++) {
    let wmean = 0.0;
    for (let i = 0; i <= period - 1; i++) wmean += hist(medianBase, b, i) * weights[i];
    wmean = wmean / sumw;
    let wvar = 0.0;
    for (let i = 0; i <= period - 1; i++) {
      const diff = hist(medianBase, b, i) - wmean;
      wvar += Math.pow(diff, 2) * weights[i];
    }
    sdRange[b] = Math.sqrt(wvar / sumw);
  }

  const upper = medianBase.map((m, b) => m + sdRange[b] * cfg.sdMul);
  const lower = medianBase.map((m, b) => m - sdRange[b] * cfg.sdMulb);
  const midli = upper.map((u, b) => (u + lower[b]) / 2);

  // NAL := close > upper ? 1 : close < lower ? -1 : NAL[1] (NAL[1] is na on the first bar)
  const col: string[] = new Array(n);
  let nal = NaN;
  for (let b = 0; b < n; b++) {
    const c = bars[b].close;
    nal = gt(c, upper[b]) ? 1 : gt(lower[b], c) ? -1 : nal;
    col[b] = eq(nal, 1) ? colUp : eq(nal, -1) ? colDn : colNu;
  }

  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const plot = (values: number[], colour: (b: number) => string) =>
    bars.map((bar, b) => ({ time: bar.time, value: fin(values[b]), color: colour(b) }));
  const glow = col.map((c) => String(color.new(c, 50)));
  const fillTop = col.map((c) => String(color.new(c, 30)));
  const fillBottom = col.map((c) => String(color.new(c, 100)));

  // plotcandle(open, high, low, close, "Bar Color", col, col, bordercolor = col, display = display.pane,
  //   force_overlay = true)
  const candles: PlotCandleData[] = bars.map((bar, b) => ({
    time: bar.time, open: bar.open, high: bar.high, low: bar.low, close: bar.close,
    color: col[b], wickColor: col[b], borderColor: col[b], forceOverlay: true,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: plot(upper, (b) => col[b]),
      plot1: plot(lower, (b) => col[b]),
      plot2: plot(midli, () => color.white),
      plot3: plot(upper, (b) => glow[b]),
      plot4: plot(lower, (b) => glow[b]),
    },
    fills: [
      // fill(u, m, upper, midli, color.new(col, 30), color.new(col, 100))
      { plot1: 'plot0', plot2: 'plot2', gradient: { topValue: upper, bottomValue: midli,
        topColor: fillTop, bottomColor: fillBottom } },
      // fill(l, m, lower, midli, color.new(col, 30), color.new(col, 100))
      { plot1: 'plot1', plot2: 'plot2', gradient: { topValue: lower, bottomValue: midli,
        topColor: fillTop, bottomColor: fillBottom } },
    ],
    plotCandles: { barColor: candles },
  };
}

export const MedianGaussianTrendNal = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
