/**
 * Sigmoid RSI | NAL
 *
 * The RSI is centred on 50 and passed through a logistic function: raw = 100 * sigmoid(RSI - 50). It is smoothed by
 * an adaptive EMA whose alpha = 2 / (len + 1) * (0.5 + sigmoid(feed)), clamped to 0.01..1, where the feed is the
 * change of the ATR over the weight change window (volatility). The signal line is the same adaptive EMA of the
 * Sigmoid RSI with the change of an RSI (weight lookback) as feed (momentum). The state turns long above the long
 * threshold (and above the signal line with confluence), short below the short threshold (and below the signal line);
 * it colours the line, the price candles and the bars, and its transitions give Buy / Sell triangles. The areas
 * beyond the thresholds are filled.
 *
 * Reference: "Sigmoid RSI | NAL" by NordicAlphaLab
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © NordicAlphaLab
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData, MarkerData, PlotCandleData } from '../types';

export interface SigmoidRsiNalInputs {
  /** Colour mode: 'Standard', 'Nordic' or 'Simple' */
  colMode: 'Standard' | 'Nordic' | 'Simple';
  src: SourceType;
  rsiLen: number;
  /** Length of the adaptive EMA of the Sigmoid RSI */
  rsiSmoothLen: number;
  longThres: number;
  shortThres: number;
  /** RSI / ATR length of the weight feeds */
  modLen: number;
  /** Change window (bars) of the weight feeds */
  changeL: number;
  /** Long / short state also needs the Sigmoid RSI above / below its signal line */
  boolCon: boolean;
  /** Length of the adaptive EMA signal line */
  rsiSignalLen: number;
}

export const defaultInputs: SigmoidRsiNalInputs = {
  colMode: 'Standard',
  src: 'close',
  rsiLen: 9,
  rsiSmoothLen: 14,
  longThres: 72,
  shortThres: 40,
  modLen: 14,
  changeL: 2,
  boolCon: true,
  rsiSignalLen: 40,
};

const TP = 'Measures how much the selected Weight Source has changed compared with its value X bars ago. Lower values '
  + 'react faster and may be noisier; higher values respond more slowly and emphasize broader shifts.';

export const inputConfig: InputConfig[] = [
  { id: 'colMode', type: 'string', title: 'Color Mode', defval: 'Standard', options: ['Standard', 'Nordic', 'Simple'], group: 'Visuals' },
  { id: 'src', type: 'source', title: 'Source', defval: 'close', group: 'RSI' },
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 9, min: 1, group: 'RSI' },
  { id: 'rsiSmoothLen', type: 'int', title: 'Sigmoid RSI Smoothing', defval: 14, min: 1, group: 'RSI' },
  { id: 'longThres', type: 'int', title: 'Long Threshold', defval: 72, min: 1, group: 'RSI' },
  { id: 'shortThres', type: 'int', title: 'Short Threshold', defval: 40, min: 1, group: 'RSI' },
  { id: 'modLen', type: 'int', title: 'Weight Lookback', defval: 14, min: 1, group: 'Sigmoid Weights' },
  { id: 'changeL', type: 'int', title: 'Weight Change Window (Bars)', defval: 2, min: 1, group: 'Sigmoid Weights', tooltip: TP },
  { id: 'boolCon', type: 'bool', title: 'Sigmoid EMA Confluence?', defval: true, group: 'Confluence' },
  { id: 'rsiSignalLen', type: 'int', title: 'Signal Length', defval: 40, min: 1, group: 'Confluence' },
];

const STD_UP = String(color.rgb(0, 255, 200));
const STD_DN = String(color.rgb(32, 94, 144));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Sigmoid RSI', color: STD_UP, lineWidth: 2 },
  { id: 'plot1', title: 'Sigmoid RSI Glow', color: String(color.new(STD_UP, 78)), lineWidth: 7, display: 'pane' },
  { id: 'plot2', title: 'Sigmoid RSI MA', color: color.gray, lineWidth: 1 },
  { id: 'plot3', title: 'Long Threshold', color: STD_UP, lineWidth: 1 },
  { id: 'plot4', title: 'Short Threshold', color: STD_DN, lineWidth: 1 },
  { id: 'plot5', title: 'Midline', color: String(color.new(color.gray, 75)), lineWidth: 1, display: 'pane' },
  { id: 'plot6', title: 'Upper Fill Anchor', color: String(color.new(STD_UP, 100)), lineWidth: 1, display: 'pane' },
  { id: 'plot7', title: 'Lower Fill Anchor', color: String(color.new(STD_DN, 100)), lineWidth: 1, display: 'pane' },
];

export const metadata = {
  title: 'Sigmoid RSI | NAL',
  shortTitle: 'Sigmoid RSI',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** f_clamp(value, min, max) = math.max(min, math.min(value, max)) (na when value is na) */
const clamp = (v: number, lo: number, hi: number) => (isNaN(v) ? NaN : Math.max(lo, Math.min(v, hi)));
/** sigmoid_function(x) = 1 / (1 + exp(-clamp(nz(x), -60, 60))) */
const sigmoid = (x: number) => 1.0 / (1.0 + Math.exp(-clamp(isNaN(x) ? 0 : x, -60.0, 60.0)));

/** f_sigmoid_ema(source, feed, len): sigmoidEma := na(sigmoidEma[1]) ? source : sigmoidEma[1] + alpha * (source - sigmoidEma[1]) */
function sigmoidEma(source: number[], feed: number[], len: number): number[] {
  const out: number[] = new Array(source.length);
  const baseAlpha = 2.0 / (len + 1.0);
  let prev = NaN;
  for (let i = 0; i < source.length; i++) {
    const alpha = clamp(baseAlpha * (0.5 + sigmoid(feed[i])), 0.01, 1.0);
    const v = isNaN(prev) ? source[i] : prev + alpha * (source[i] - prev);
    out[i] = v;
    prev = v;
  }
  return out;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<SigmoidRsiNalInputs> = {},
): Omit<IndicatorResult, 'markers'> & {
  markers: MarkerData[]; barColors: BarColorData[]; plotCandles: Record<string, PlotCandleData[]>;
} {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const src = getSourceSeries(bars, cfg.src);

  const [colUp, colDn, colNu] = cfg.colMode === 'Nordic'
    ? [String(color.rgb(0, 96, 175)), String(color.rgb(150, 154, 169)), color.gray]
    : cfg.colMode === 'Simple'
      ? [color.lime, color.red, color.gray]
      : [STD_UP, STD_DN, color.gray];

  const rsiRaw = A(ta.rsi(src, cfg.rsiLen));
  const sigmoidRsiRaw = rsiRaw.map((r) => 100.0 * sigmoid(r - 50.0));
  // momentumFeed = ta.change(ta.rsi(src, modLen), changeL); volatilityFeed = ta.change(ta.atr(modLen), changeL)
  const momentumFeed = A(ta.change(ta.rsi(src, cfg.modLen), cfg.changeL));
  const volatilityFeed = A(ta.change(ta.atr(bars, cfg.modLen), cfg.changeL));

  const sigRsi = sigmoidEma(sigmoidRsiRaw, volatilityFeed, cfg.rsiSmoothLen);
  const sigSignal = sigmoidEma(sigRsi, momentumFeed, cfg.rsiSignalLen);

  // var int NAL = 0; NAL := ... : NAL[1] (NAL[1] is na on the first bar)
  const nal: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const prev = i > 0 ? nal[i - 1] : NaN;
    const s = sigRsi[i];
    nal[i] = gt(s, cfg.longThres) && (gt(s, sigSignal[i]) || !cfg.boolCon) ? 1
      : lt(s, cfg.shortThres) && (lt(s, sigSignal[i]) || !cfg.boolCon) ? -1 : prev;
  }

  const t = (i: number) => bars[i].time;
  const plotColor = nal.map((x) => (x === 1 ? colUp : x === -1 ? colDn : colNu));
  const upFill = String(color.new(colUp, 100));
  const dnFill = String(color.new(colDn, 100));
  const mid = String(color.new(colNu, 75));
  const plots = {
    plot0: bars.map((_b, i) => ({ time: t(i), value: sigRsi[i], color: plotColor[i] })),
    plot1: bars.map((_b, i) => ({ time: t(i), value: sigRsi[i], color: String(color.new(plotColor[i], 78)) })),
    plot2: bars.map((_b, i) => ({ time: t(i), value: sigSignal[i], color: color.gray })),
    plot3: bars.map((_b, i) => ({ time: t(i), value: cfg.longThres, color: colUp })),
    plot4: bars.map((_b, i) => ({ time: t(i), value: cfg.shortThres, color: colDn })),
    plot5: bars.map((_b, i) => ({ time: t(i), value: 50.0, color: mid })),
    // plot(rsi_bullish ? sigmoidRSI : na, 'Upper Fill Anchor', color.new(col_up, 100), display = display.pane)
    plot6: bars.map((_b, i) => ({ time: t(i), value: gt(sigRsi[i], cfg.longThres) ? sigRsi[i] : NaN, color: upFill })),
    plot7: bars.map((_b, i) => ({ time: t(i), value: lt(sigRsi[i], cfg.shortThres) ? sigRsi[i] : NaN, color: dnFill })),
  };

  // fill(p_upper_fill, p_long, color.new(col_up, 86)); fill(p_lower_fill, p_short, color.new(col_dn, 86))
  const upFillCol = String(color.new(colUp, 86));
  const dnFillCol = String(color.new(colDn, 86));
  const fills = [
    { plot1: 'plot6', plot2: 'plot3', colors: bars.map(() => upFillCol) },
    { plot1: 'plot7', plot2: 'plot4', colors: bars.map(() => dnFillCol) },
  ];

  // plotcandle(open, high, low, close, 'Candles', plotColor, wickcolor, bordercolor, force_overlay = true, display.pane)
  const candles: PlotCandleData[] = bars.map((b, i) => ({
    time: b.time, open: b.open, high: b.high, low: b.low, close: b.close,
    color: plotColor[i], wickColor: plotColor[i], borderColor: plotColor[i], forceOverlay: true,
  }));
  const barColors: BarColorData[] = bars.map((b, i) => ({ time: b.time, color: plotColor[i] }));

  const markers: MarkerData[] = [];
  for (let i = 1; i < n; i++) {
    // bullish_transition = NAL == 1 and NAL[1] == -1 (and the reverse)
    if (nal[i] === 1 && nal[i - 1] === -1) {
      markers.push({ time: t(i), position: 'belowBar', shape: 'triangleUp', color: colUp, text: '𝓑𝓾𝔂',
        textColor: colUp, size: 'tiny', forceOverlay: true });
    }
    if (nal[i] === -1 && nal[i - 1] === 1) {
      markers.push({ time: t(i), position: 'aboveBar', shape: 'triangleDown', color: colDn, text: '𝓢𝓮𝓵𝓵',
        textColor: colDn, size: 'tiny', forceOverlay: true });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills,
    markers,
    barColors,
    plotCandles: { Candles: candles },
  };
}

export const SigmoidRsiNal = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
