/**
 * Gaussian RSI | NAL
 *
 * The RSI is smoothed by a Gaussian-weighted window (weights exp(-0.5 * ((i - (len - 1) / 2) / sigma)^2), na values
 * counted as 0), and a second, longer Gaussian filter of it gives a confluence line. The regime turns bullish when
 * the Gaussian RSI is above the upper threshold (and above the confluence line, when required) and bearish when it
 * is below the lower threshold (and below the confluence line); otherwise it keeps the last regime. The RSI line,
 * its glow, a fill to the 50 midline and the price candles take the regime colour; triangles mark the changes from
 * bearish to bullish and back.
 *
 * Reference: "Gaussian RSI | NAL" by NordicAlphaLab
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © NordicAlphaLab
 */

import { ta, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';

export interface GaussianRsiNalInputs {
  /** Colour set: 'Standard', 'Nordic' or 'Simple' */
  colMode: 'Standard' | 'Nordic' | 'Simple';
  src: SourceType;
  rsiLen: number;
  /** Gaussian filter length of the RSI */
  gaussLen: number;
  /** Gaussian filter sigma of the RSI */
  gaussSig: number;
  upperThreshold: number;
  lowerThreshold: number;
  /** The Gaussian RSI must also be above / below the confluence line */
  useGaussianConfluence: boolean;
  /** Gaussian filter length of the confluence line */
  confluenceLen: number;
  /** Gaussian filter sigma of the confluence line */
  confluenceSig: number;
}

export const defaultInputs: GaussianRsiNalInputs = {
  colMode: 'Standard',
  src: 'close',
  rsiLen: 14,
  gaussLen: 10,
  gaussSig: 5.0,
  upperThreshold: 55.0,
  lowerThreshold: 52.5,
  useGaussianConfluence: true,
  confluenceLen: 21,
  confluenceSig: 5.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'colMode', type: 'string', title: 'Color Mode', defval: 'Standard', options: ['Standard', 'Nordic', 'Simple'] },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'gaussLen', type: 'int', title: 'Gaussian Length', defval: 10, min: 1 },
  { id: 'gaussSig', type: 'float', title: 'Sigma', defval: 5.0, min: 0.1, step: 0.1 },
  { id: 'upperThreshold', type: 'float', title: 'Upper Threshold', defval: 55.0, step: 0.5 },
  { id: 'lowerThreshold', type: 'float', title: 'Lower Threshold', defval: 52.5, step: 0.5 },
  { id: 'useGaussianConfluence', type: 'bool', title: 'Require Gaussian Filter Confluence?', defval: true },
  { id: 'confluenceLen', type: 'int', title: 'Confluence Gaussian Length', defval: 21, min: 1 },
  { id: 'confluenceSig', type: 'float', title: 'Sigma', defval: 5.0, min: 0.1, step: 0.1 },
];

const STD_UP = String(color.rgb(0, 255, 200));
const STD_DN = String(color.rgb(32, 94, 144));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Long Threshold', color: String(color.new(STD_UP, 25)), lineWidth: 1 },
  { id: 'plot1', title: 'Short Threshold', color: String(color.new(STD_DN, 25)), lineWidth: 1 },
  { id: 'plot2', title: 'Midline', color: String(color.new(color.white, 85)), lineWidth: 1, display: 'pane' },
  { id: 'plot3', title: 'Gaussian RSI Glow', color: String(color.new(STD_UP, 75)), lineWidth: 7, display: 'pane' },
  { id: 'plot4', title: 'Gaussian RSI', color: STD_UP, lineWidth: 2 },
  { id: 'plot5', title: 'Gaussian Confluence', color: String(color.new(color.white, 35)), lineWidth: 1 },
];

export const metadata = {
  title: 'Gaussian RSI | NAL',
  shortTitle: 'Gaussian RSI',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** gaussianFilter(source, len, sigma): na values (and bars before the first one) count as 0 */
function gaussianFilter(source: number[], len: number, sigma: number): number[] {
  const w: number[] = [];
  for (let k = 0; k <= len - 1; k++) w.push(Math.exp(-0.5 * Math.pow((k - (len - 1) / 2.0) / sigma, 2.0)));
  return source.map((v, i) => {
    let totalWeight = 0;
    let weightedSum = 0;
    for (let k = 0; k <= len - 1; k++) {
      const x = i - k >= 0 ? source[i - k] : NaN;
      totalWeight += w[k];
      weightedSum += (isNaN(x) ? 0 : x) * w[k];
    }
    // totalWeight != 0.0 ? weightedSum / totalWeight : source
    return totalWeight !== 0 ? weightedSum / totalWeight : v;
  });
}

export function calculate(
  bars: Bar[],
  inputs: Partial<GaussianRsiNalInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const [colUp, colDn, colNu] = cfg.colMode === 'Nordic'
    ? [String(color.rgb(46, 161, 255)), String(color.rgb(150, 154, 169)), color.gray]
    : cfg.colMode === 'Simple'
      ? [color.lime, color.red, color.gray]
      : [STD_UP, STD_DN, color.gray];

  const rsi = ta.rsi(getSourceSeries(bars, cfg.src), cfg.rsiLen).toArray().map((v) => v ?? NaN);
  const gRsi = gaussianFilter(rsi, cfg.gaussLen, cfg.gaussSig);
  const conf = gaussianFilter(gRsi, cfg.confluenceLen, cfg.confluenceSig);

  // NAL := bullSignal ? 1 : bearSignal ? -1 : nz(NAL[1], 0)
  const nal: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const bull = gt(gRsi[i], cfg.upperThreshold) && (!cfg.useGaussianConfluence || gt(gRsi[i], conf[i]));
    const bear = lt(gRsi[i], cfg.lowerThreshold) && (!cfg.useGaussianConfluence || lt(gRsi[i], conf[i]));
    nal[i] = bull ? 1 : bear ? -1 : i > 0 ? nal[i - 1] : 0;
  }
  const col = nal.map((x) => (x === 1 ? colUp : x === -1 ? colDn : colNu));

  const t = (i: number) => bars[i].time;
  const longCol = String(color.new(colUp, 25));
  const shortCol = String(color.new(colDn, 25));
  const midCol = String(color.new(color.white, 85));
  const confCol = String(color.new(color.white, 35));

  const candles: PlotCandleData[] = [];
  const markers: MarkerData[] = [];
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    // plotcandle(open, high, low, close, "Bar Color", col, col, bordercolor = col, force_overlay = true, display.pane)
    candles.push({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, color: col[i], wickColor: col[i],
      borderColor: col[i], forceOverlay: true });
    // plotshape(NAL == 1 and NAL[1] == -1, "Bullish Transition", shape.triangleup, location.belowbar, text = "𝓑𝓾𝔂",
    //   color = col_up, textcolor = col_up, size.tiny, force_overlay = true, display.pane); bearish: mirror
    if (i > 0 && nal[i] === 1 && nal[i - 1] === -1) {
      markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: colUp, text: '𝓑𝓾𝔂', textColor: colUp,
        size: 'tiny', forceOverlay: true });
    }
    if (i > 0 && nal[i] === -1 && nal[i - 1] === 1) {
      markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: colDn, text: '𝓢𝓮𝓵𝓵', textColor: colDn,
        size: 'tiny', forceOverlay: true });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((_b, i) => ({ time: t(i), value: cfg.upperThreshold, color: longCol })),
      plot1: bars.map((_b, i) => ({ time: t(i), value: cfg.lowerThreshold, color: shortCol })),
      plot2: bars.map((_b, i) => ({ time: t(i), value: 50.0, color: midCol })),
      // plot(Gauss_RSI, "Gaussian RSI Glow", color = color.new(col, 75), linewidth = 7, display = display.pane)
      plot3: bars.map((_b, i) => ({ time: t(i), value: gRsi[i], color: String(color.new(col[i], 75)) })),
      plot4: bars.map((_b, i) => ({ time: t(i), value: gRsi[i], color: col[i] })),
      // plot(useGaussianConfluence ? Gaussian_Confluence : na, "Gaussian Confluence", color.new(color.white, 35))
      plot5: bars.map((_b, i) => ({ time: t(i), value: cfg.useGaussianConfluence ? conf[i] : NaN, color: confCol })),
    },
    fills: [
      // fill(upperPlot, midPlot, color.new(col_up, 90), title = "Upper Zone")
      { plot1: 'plot0', plot2: 'plot2', colors: new Array<string>(n).fill(String(color.new(colUp, 90))) },
      // fill(lowerPlot, midPlot, color.new(col_dn, 90), title = "Lower Zone")
      { plot1: 'plot1', plot2: 'plot2', colors: new Array<string>(n).fill(String(color.new(colDn, 90))) },
      // fill(rsiPlot, midPlot, color.new(col, 92), title = "RSI Regime Fill")
      { plot1: 'plot4', plot2: 'plot2', colors: col.map((c) => String(color.new(c, 92))) },
    ],
    markers,
    plotCandles: { barColor: candles },
  };
}

export const GaussianRsiNal = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
