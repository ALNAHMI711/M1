/**
 * Zero-Lag GARCH Bands
 *
 * Bands around a zero-lag EMA baseline (EMA of x + (x - x[lag]), lag = floor((length - 1) / 2), with x = EMA 10 of
 * the source). The half width is source / band pressure * 100 * GARCH volatility. The GARCH variance mixes the
 * long-run variance (SMA of the lagged one-bar variance), the squared lagged log return and the lagged one-bar
 * variance; its weights are fitted on each bar by a grid search: beta (1..99) then gamma (1..100 - beta), each the
 * candidate with the lowest sum of squared errors against the realized variance (SMA of the squared returns) over
 * the lookback. The volatility is the square root of a zero-lag EMA of that variance. A close above the upper band
 * gives the bullish colour, below the lower band the bearish colour; the colour is kept between. Glow lines,
 * gradient fills from the bands to the midline and coloured candles.
 *
 * Reference: "Zero-Lag GARCH Bands | NAL" by NordicAlphaLab
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © NordicAlphaLab
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { PlotCandleData } from '../types';

export interface ZeroLagGarchBandsNalInputs {
  /** Colour mode: Standard, Nordic or Simple */
  colMode: 'Standard' | 'Nordic' | 'Simple';
  /** GARCH lookback (window of the fit and of the variance averages) */
  garchLookback: number;
  /** Length of the zero-lag EMA of the GARCH variance */
  garchSmoothLen: number;
  /** Baseline source */
  baselineSrc: SourceType;
  /** Zero-lag EMA baseline length */
  baselineLen: number;
  /** Band pressure: a higher value gives a tighter band */
  bandPressure: number;
}

export const defaultInputs: ZeroLagGarchBandsNalInputs = {
  colMode: 'Standard',
  garchLookback: 30,
  garchSmoothLen: 60,
  baselineSrc: 'close',
  baselineLen: 52,
  bandPressure: 30,
};

export const inputConfig: InputConfig[] = [
  { id: 'colMode', type: 'string', title: 'Color Mode', defval: 'Standard', options: ['Standard', 'Nordic', 'Simple'] },
  { id: 'garchLookback', type: 'int', title: 'GARCH Lookback', defval: 30, min: 2 },
  { id: 'garchSmoothLen', type: 'int', title: 'GARCH ZLEMA Smoothing', defval: 60, min: 1 },
  { id: 'baselineSrc', type: 'source', title: 'Source', defval: 'close' },
  { id: 'baselineLen', type: 'int', title: 'Baseline Length', defval: 52, min: 1 },
  { id: 'bandPressure', type: 'int', title: 'Band Pressure', defval: 30, min: 5 },
];

const STANDARD_UP = String(color.rgb(0, 255, 200));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Band', color: STANDARD_UP, lineWidth: 1 },
  { id: 'plot1', title: 'Lower Band', color: STANDARD_UP, lineWidth: 1 },
  { id: 'plot2', title: 'Midline', color: color.white, lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Upper Band Glow', color: String(color.new(STANDARD_UP, 50)), lineWidth: 5, display: 'pane' },
  { id: 'plot4', title: 'Lower Band Glow', color: String(color.new(STANDARD_UP, 50)), lineWidth: 5, display: 'pane' },
];

export const metadata = {
  title: 'Zero-Lag GARCH Bands | NAL',
  shortTitle: 'Zero-Lag GARCH Bands',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; na operands give false */
const EPS = 1e-10;
const gt = (a: number, b: number): boolean => a - b > EPS;
const lt = (a: number, b: number): boolean => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<ZeroLagGarchBandsNalInputs> = {},
): Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const lookback = cfg.garchLookback;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const nz = (v: number, r: number) => (isNaN(v) ? r : v);
  const close = bars.map((b) => b.close);

  const [colUp, colDn, colNu] = cfg.colMode === 'Nordic'
    ? [String(color.rgb(46, 161, 255)), String(color.rgb(150, 154, 169)), color.gray]
    : cfg.colMode === 'Simple'
      ? [color.lime, color.red, color.gray]
      : [STANDARD_UP, String(color.rgb(32, 94, 144)), color.gray];

  // Lagged return / variance components
  const logReturn = close.map((_c, i) => {
    const c1 = i >= 1 ? close[i - 1] : NaN;
    const c2 = i >= 2 ? close[i - 2] : NaN;
    return !isNaN(c2) && gt(c1, 0.0) && gt(c2, 0.0) ? Math.log(c1 / c2) : 0.0;
  });
  // nz(ta.variance(close[1], 1), 0.0): the variance of one value (running sums, as Pine)
  const laggedVariance = A(ta.variance(S(close.map((_c, i) => (i >= 1 ? close[i - 1] : NaN))), 1)).map((v) => nz(v, 0.0));
  const squaredLogReturn = logReturn.map((r) => Math.pow(r, 2.0));
  const realizedVariance = A(ta.sma(S(squaredLogReturn), lookback)).map((v, i) => nz(v, squaredLogReturn[i]));
  const longRunVariance = A(ta.sma(S(laggedVariance), lookback)).map((v, i) => nz(v, laggedVariance[i]));

  // math.sum(x, lookback) inside the two loops: one call site each. Its history has one value per bar (the value of
  // its last call in that bar), so each call gives x + the last values of the lookback - 1 previous bars.
  const lambdaSum = new LoopSum(lookback);
  const gammaSum = new LoopSum(lookback);
  const variance: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const lagged = laggedVariance[i];
    const sq = squaredLogReturn[i];
    const realized = realizedVariance[i];
    const lambdaSse: number[] = [];
    for (let c = 1; c <= 99; c++) {
      const w = c / 100.0;
      const est = w * lagged + (1.0 - w) * sq;
      lambdaSse.push(lambdaSum.call(Math.pow(est - realized, 2.0)));
    }
    lambdaSum.commit();
    const betaIndex = indexOfMin(lambdaSse) + 1;

    const gammaSse: number[] = [];
    for (let g = 1; g <= 100 - betaIndex; g++) {
      const bw = betaIndex / 100.0;
      const gw = g / 100.0;
      const aw = 1.0 - bw - gw;
      const est = gw * longRunVariance[i] + aw * sq + bw * lagged;
      gammaSse.push(gammaSum.call(Math.pow(est - realized, 2.0)));
    }
    gammaSum.commit();
    const gammaIndex = indexOfMin(gammaSse) + 1;

    const beta = betaIndex / 100.0;
    const gamma = gammaIndex / 100.0;
    const alpha = 1.0 - beta - gamma;
    variance[i] = gamma * longRunVariance[i] + alpha * sq + beta * lagged;
  }

  // f_zlema(source, len) = ta.ema(source + (source - source[lag]), len), lag = floor((len - 1) / 2)
  const zlema = (x: number[], len: number) => {
    const lag = Math.floor((len - 1) / 2);
    return A(ta.ema(S(x.map((v, i) => (i >= lag ? v + (v - x[i - lag]) : NaN))), len));
  };
  const src = A(getSourceSeries(bars, cfg.baselineSrc));
  const baseline = zlema(A(ta.ema(S(src), 10)), cfg.baselineLen);
  const projected = zlema(variance, cfg.garchSmoothLen);

  const upper: number[] = new Array(n);
  const lower: number[] = new Array(n);
  const mid: number[] = new Array(n);
  const plotColor: string[] = new Array(n);
  let score = 0;
  for (let i = 0; i < n; i++) {
    const volMult = Math.sqrt(Math.max(projected[i], 0.0)) * 100.0;
    upper[i] = baseline[i] + (src[i] / cfg.bandPressure) * volMult;
    lower[i] = baseline[i] - (src[i] / cfg.bandPressure) * volMult;
    // score := close > upperBand ? 1 : close < lowerBand ? -1 : nz(score[1], 0)
    score = gt(close[i], upper[i]) ? 1 : lt(close[i], lower[i]) ? -1 : score;
    // previousPlotColor = na(plotColor[1]) ? col_nu : plotColor[1]
    const prev = i > 0 ? plotColor[i - 1] : colNu;
    plotColor[i] = score === 1 ? colUp : score === -1 ? colDn : prev;
    mid[i] = (upper[i] + lower[i]) / 2;
  }

  const glow = plotColor.map((c) => String(color.new(c, 50)));
  const top = plotColor.map((c) => String(color.new(c, 30)));
  const bottom = plotColor.map((c) => String(color.new(c, 100)));
  const candles: PlotCandleData[] = bars.map((b, i) => ({
    time: b.time, open: b.open, high: b.high, low: b.low, close: b.close,
    color: plotColor[i], wickColor: plotColor[i], borderColor: plotColor[i], forceOverlay: true,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: upper[i], color: plotColor[i] })),
      plot1: bars.map((b, i) => ({ time: b.time, value: lower[i], color: plotColor[i] })),
      plot2: bars.map((b, i) => ({ time: b.time, value: mid[i], color: color.white })),
      plot3: bars.map((b, i) => ({ time: b.time, value: upper[i], color: glow[i] })),
      plot4: bars.map((b, i) => ({ time: b.time, value: lower[i], color: glow[i] })),
    },
    // fill(upperPlot, midPlot, upperBand, midLine, color.new(plotColor, 30), color.new(plotColor, 100)); same below
    fills: [
      { plot1: 'plot0', plot2: 'plot2', options: { title: 'Plots Background' },
        gradient: { topValue: upper.slice(), bottomValue: mid.slice(), topColor: top, bottomColor: bottom } },
      { plot1: 'plot1', plot2: 'plot2', options: { title: 'Plots Background' },
        gradient: { topValue: lower.slice(), bottomValue: mid.slice(), topColor: top.slice(), bottomColor: bottom.slice() } },
    ],
    // plotcandle(open, high, low, close, "Bar Color", plotColor, plotColor, bordercolor = plotColor,
    //            display = display.pane, force_overlay = true)
    plotCandles: { barColor: candles },
  };
}

/**
 * array.indexof(arr, array.min(arr)): array.min skips na; array.indexof compares as Pine `==` (within 1e-10), so it
 * gives the first value within 1e-10 of the smallest one; -1 when every value is na.
 */
function indexOfMin(values: number[]): number {
  let min = NaN;
  for (const v of values) if (!isNaN(v) && (isNaN(min) || v < min)) min = v;
  if (isNaN(min)) return -1;
  return values.findIndex((v) => !isNaN(v) && !(Math.abs(v - min) > EPS));
}

/**
 * Pine math.sum(x, len) of one call site called several times per bar (in a loop): each call gives x + the values
 * of the len - 1 previous bars where it ran (na before); the value kept for a bar is the one of its last call.
 */
class LoopSum {
  private hist: number[] = [];
  private last = NaN;
  constructor(private readonly len: number) {}
  call(x: number): number {
    this.last = x;
    const h = this.hist.length;
    if (h < this.len - 1) return NaN;
    let s = x;
    for (let k = 1; k < this.len; k++) s += this.hist[h - k];
    return s;
  }
  commit(): void {
    this.hist.push(this.last);
    if (this.hist.length > this.len) this.hist.shift();
  }
}

export const ZeroLagGarchBandsNal = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
