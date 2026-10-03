/**
 * Volatility Halo
 *
 * Bands around a zero-lag EMA baseline (EMA of src + (src - src[lag]), lag = (length - 1) / 2): width = ATR *
 * multiple * a GARCH regime multiplier. The GARCH(1,1) conditional variance of the log returns uses the long-run
 * variance (EMA of the squared returns), the last squared return and the previous conditional variance; its
 * coefficients are fitted on each bar by a grid search (beta, then gamma) of the 5-value sum of squared errors, or
 * fixed (alpha 0.10, beta 0.85, gamma 0.05). The multiplier is the projected volatility (zero-lag EMA 7 of the
 * variance, square root) over its EMA, smoothed by a zero-lag EMA and clamped between the min and max multipliers.
 * A close above the upper band gives the bullish colour, below the lower band the bearish colour; the colour is
 * kept between. Glow lines, regime fills to the baseline and coloured candles.
 *
 * Reference: "Volatility Halo | NAL" by NordicAlphaLab
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © NordicAlphaLab
 */

import { ta, Series, getSourceSeries, color, callsite, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { PlotCandleData } from '../types';

export interface VolatilityHaloNalInputs {
  /** Colour mode: Standard, Nordic or Simple */
  colMode: 'Standard' | 'Nordic' | 'Simple';
  src: SourceType;
  /** ZLEMA baseline length */
  baselineLen: number;
  atrLen: number;
  atrMult: number;
  /** Fit the GARCH coefficients on each bar */
  useAdaptiveCoefficients: boolean;
  /** EMA length of the long-run variance */
  longRunLen: number;
  /** EMA length of the regime normalisation */
  regimeLen: number;
  /** ZLEMA length of the multiplier smoothing */
  multSmooth: number;
  minMult: number;
  maxMult: number;
}

export const defaultInputs: VolatilityHaloNalInputs = {
  colMode: 'Standard',
  src: 'close',
  baselineLen: 50,
  atrLen: 24,
  atrMult: 1.8,
  useAdaptiveCoefficients: true,
  longRunLen: 80,
  regimeLen: 60,
  multSmooth: 20,
  minMult: 0.5,
  maxMult: 0.9,
};

export const inputConfig: InputConfig[] = [
  { id: 'colMode', type: 'string', title: 'Color Mode', defval: 'Standard', options: ['Standard', 'Nordic', 'Simple'] },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'baselineLen', type: 'int', title: 'ZLEMA Baseline Length', defval: 50, min: 1 },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 24, min: 1 },
  { id: 'atrMult', type: 'float', title: 'ATR Multiple', defval: 1.8, min: 0.1, step: 0.1 },
  { id: 'useAdaptiveCoefficients', type: 'bool', title: 'Use Adaptive GARCH Coefficients?', defval: true },
  { id: 'longRunLen', type: 'int', title: 'Long-Run Variance Length', defval: 80, min: 2 },
  { id: 'regimeLen', type: 'int', title: 'Regime Normalization Length', defval: 60, min: 2 },
  { id: 'multSmooth', type: 'int', title: 'Multiplier Smoothing', defval: 20, min: 1 },
  { id: 'minMult', type: 'float', title: 'Min Multiplier', defval: 0.5, min: 0.1, step: 0.05 },
  { id: 'maxMult', type: 'float', title: 'Max Multiplier', defval: 0.9, min: 0.1, step: 0.05 },
];

const STANDARD_UP = String(color.rgb(0, 255, 200));
const BASELINE_COL = String(color.new(color.white, 65));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Band', color: STANDARD_UP, lineWidth: 1 },
  { id: 'plot1', title: 'Lower Band', color: STANDARD_UP, lineWidth: 1 },
  { id: 'plot2', title: 'ZLEMA Baseline', color: BASELINE_COL, lineWidth: 1 },
  { id: 'plot3', title: 'Upper Band Glow', color: String(color.new(STANDARD_UP, 75)), lineWidth: 6 },
  { id: 'plot4', title: 'Lower Band Glow', color: String(color.new(STANDARD_UP, 75)), lineWidth: 6 },
];

export const metadata = {
  title: 'Volatility Halo | NAL',
  shortTitle: 'Volatility Halo',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false); a != b false with na */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;
const nz = (x: number, y = 0) => (isNaN(x) ? y : x);

export function calculate(
  bars: Bar[],
  inputs: Partial<VolatilityHaloNalInputs> = {},
): IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const close = bars.map((b) => b.close);

  const [colUp, colDn, colNu] = cfg.colMode === 'Nordic'
    ? [String(color.rgb(46, 161, 255)), String(color.rgb(150, 154, 169)), color.gray]
    : cfg.colMode === 'Simple'
      ? [color.lime, color.red, color.gray]
      : [STANDARD_UP, String(color.rgb(32, 94, 144)), color.gray];

  // f_zlema(source, len): ta.ema(source + (source - nz(source[lag], source)), len), lag = floor((len - 1) / 2)
  const zlema = (x: number[], len: number) => {
    const lag = Math.floor((len - 1) / 2);
    const zl = x.map((v, i) => v + (v - (i - lag >= 0 ? nz(x[i - lag], v) : v)));
    return A(ta.ema(S(zl), len));
  };

  const src = A(getSourceSeries(bars, cfg.src));
  const baseline = zlema(src, cfg.baselineLen);
  const atr = A(ta.atr(bars, cfg.atrLen));

  // GARCH regime multiplier
  const shock = close.map((c, i) => {
    const p = i > 0 ? close[i - 1] : NaN;
    const r = gt(c, 0) && gt(p, 0) ? Math.log(c / p) : 0.0;
    return Math.pow(r, 2.0);
  });
  const lrEma = A(ta.ema(S(shock), cfg.longRunLen));
  const longRun = lrEma.map((v, i) => nz(v, shock[i]));
  const condVar: number[] = new Array(n).fill(NaN);
  // math.sum(x, 5) inside the loops: one call site each (one history value per bar, the value of its last call)
  const betaSum = callsite.sum();
  const gammaSum = callsite.sum();
  for (let i = 0; i < n; i++) {
    const fitTarget = nz(i >= 1 ? shock[i - 1] : NaN, shock[i]);
    const fitShock = nz(i >= 2 ? shock[i - 2] : NaN, fitTarget);
    const fitLongRun = nz(i >= 2 ? longRun[i - 2] : NaN, longRun[i]);
    const fitCond = nz(i >= 2 ? condVar[i - 2] : NaN, fitLongRun);
    let betaIndex = 85;
    let gammaIndex = 5;
    // bar_index > 10
    if (cfg.useAdaptiveCoefficients && i > 10) {
      let best = NaN;
      for (let b = 1; b <= 99; b++) {
        const bw = b / 100.0;
        const est = bw * fitCond + (1.0 - bw) * fitShock;
        const sse = betaSum(i, Math.pow(est - fitTarget, 2.0), 5);
        if (!isNaN(sse) && (isNaN(best) || lt(sse, best))) {
          best = sse;
          betaIndex = b;
        }
      }
      let bestG = NaN;
      for (let g = 1; g <= 100 - betaIndex; g++) {
        const bw = betaIndex / 100.0;
        const gw = g / 100.0;
        const aw = 1.0 - bw - gw;
        const est = gw * fitLongRun + aw * fitShock + bw * fitCond;
        const sse = gammaSum(i, Math.pow(est - fitTarget, 2.0), 5);
        if (!isNaN(sse) && (isNaN(bestG) || lt(sse, bestG))) {
          bestG = sse;
          gammaIndex = g;
        }
      }
    }
    const coefSum = Math.max(0.1 + 0.85 + 0.05, 0.000001);
    const beta = cfg.useAdaptiveCoefficients ? betaIndex / 100.0 : 0.85 / coefSum;
    const gamma = cfg.useAdaptiveCoefficients ? gammaIndex / 100.0 : 0.05 / coefSum;
    const alpha = cfg.useAdaptiveCoefficients ? Math.max(1.0 - beta - gamma, 0.0) : 0.1 / coefSum;
    const prevCond = nz(i >= 1 ? condVar[i - 1] : NaN, longRun[i]);
    condVar[i] = gamma * longRun[i] + alpha * shock[i] + beta * prevCond;
  }
  const projected = zlema(condVar, 7);
  const vol = projected.map((v) => (isNaN(v) ? NaN : Math.sqrt(Math.max(v, 0.0))));
  const regimeEma = A(ta.ema(S(vol), cfg.regimeLen));
  const regimeBase = regimeEma.map((v, i) => nz(v, vol[i]));
  const rawMult = vol.map((v, i) => (ne(regimeBase[i], 0) ? v / regimeBase[i] : 1.0));
  const smoothMult = zlema(rawMult, cfg.multSmooth);
  const regimeMult = smoothMult.map((v) => (isNaN(v) ? NaN : Math.max(cfg.minMult, Math.min(v, cfg.maxMult))));

  const upper: number[] = new Array(n);
  const lower: number[] = new Array(n);
  const plotColor: string[] = new Array(n);
  let nal = 0;
  for (let i = 0; i < n; i++) {
    const width = atr[i] * cfg.atrMult * regimeMult[i];
    upper[i] = baseline[i] + width;
    lower[i] = baseline[i] - width;
    // NAL := close > upperBand ? 1 : close < lowerBand ? -1 : nz(NAL[1], 0)
    nal = gt(close[i], upper[i]) ? 1 : lt(close[i], lower[i]) ? -1 : nal;
    // previousPlotColor = na(plotColor[1]) ? col_nu : plotColor[1]
    const prev = i > 0 ? plotColor[i - 1] : colNu;
    plotColor[i] = nal === 1 ? colUp : nal === -1 ? colDn : prev;
  }

  const glow = plotColor.map((c) => String(color.new(c, 75)));
  const fillCol = plotColor.map((c) => String(color.new(c, 88)));
  const candles: PlotCandleData[] = bars.map((b, i) => ({
    time: b.time, open: b.open, high: b.high, low: b.low, close: b.close,
    color: plotColor[i], wickColor: plotColor[i], borderColor: plotColor[i], forceOverlay: true,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: upper[i], color: plotColor[i] })),
      plot1: bars.map((b, i) => ({ time: b.time, value: lower[i], color: plotColor[i] })),
      plot2: bars.map((b, i) => ({ time: b.time, value: baseline[i], color: BASELINE_COL })),
      // display.pane: drawn on the chart, not in the status line
      plot3: bars.map((b, i) => ({ time: b.time, value: upper[i], color: glow[i] })),
      plot4: bars.map((b, i) => ({ time: b.time, value: lower[i], color: glow[i] })),
    },
    fills: [
      { plot1: 'plot0', plot2: 'plot2', options: { title: 'Upper Regime Fill' }, colors: fillCol },
      { plot1: 'plot1', plot2: 'plot2', options: { title: 'Lower Regime Fill' }, colors: fillCol },
    ],
    // plotcandle(open, high, low, close, "Colored Candles", plotColor, plotColor, bordercolor = plotColor,
    //            force_overlay = true, display = display.pane)
    plotCandles: { coloredCandles: candles },
  };
}

export const VolatilityHaloNal = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
