/**
 * MACD Pro
 *
 * MACD = EMA(src, fast) - EMA(src, slow), signal = EMA(MACD, signal length), histogram = MACD - signal. The MACD
 * Leader adds to each EMA the EMA of the source distance to it, scaled by the leader factor:
 * i1 = EMA(src, fast) + factor * EMA(src - EMA(src, fast), fast), i2 likewise with the slow length, leader = i1 - i2.
 * The MACD line colour shows the market regime: lime when the 10-bar momentum of the close is positive and the
 * absolute change of SMA(close, 14) is above its 21-bar SMA, red when the momentum is negative with the same trend
 * strength, blue otherwise. Histogram columns are strong / faded lime above zero (rising / not rising) and strong /
 * faded red below zero (falling / not falling).
 *
 * Reference: "MACD Pro" by VEGAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © VEGAlgo
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface MacdProInputs {
  /** Fast EMA period */
  fastPeriod: number;
  /** Slow EMA period */
  slowPeriod: number;
  /** Signal EMA period */
  signalPeriod: number;
  /** Price source */
  source: SourceType;
  /** Draw the MACD Leader */
  enableLeader: boolean;
  /** Leader sensitivity */
  leaderFactor: number;
  /** Draw the histogram */
  showHistogram: boolean;
}

export const defaultInputs: MacdProInputs = {
  fastPeriod: 12,
  slowPeriod: 26,
  signalPeriod: 9,
  source: 'close',
  enableLeader: true,
  leaderFactor: 1.0,
  showHistogram: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastPeriod', type: 'int', title: 'Fast EMA Period', defval: 12, min: 1, max: 100 },
  { id: 'slowPeriod', type: 'int', title: 'Slow EMA Period', defval: 26, min: 1, max: 200 },
  { id: 'signalPeriod', type: 'int', title: 'Signal Period', defval: 9, min: 1, max: 50 },
  { id: 'source', type: 'source', title: 'Price Source', defval: 'close' },
  { id: 'enableLeader', type: 'bool', title: 'Enable Leader', defval: true },
  { id: 'leaderFactor', type: 'float', title: 'Leader Sensitivity', defval: 1.0, min: 0.5, max: 2.0, step: 0.1 },
  { id: 'showHistogram', type: 'bool', title: 'Show Histogram', defval: true },
];

const MACD_BULL = String(color.new(color.lime, 20));
const MACD_BEAR = String(color.new(color.red, 20));
const MACD_NEUTRAL = String(color.new('#2e5a8f', 40));
const SIGNAL_COL = String(color.new('#b3b0c2', 30));
const LEADER_COL = String(color.new('#49e0e8', 0));
const HIST_BULL_STRONG = String(color.new(color.lime, 0));
const HIST_BULL_WEAK = String(color.new(color.lime, 60));
const HIST_BEAR_STRONG = String(color.new(color.red, 0));
const HIST_BEAR_WEAK = String(color.new(color.red, 60));
const ZERO_COL = String(color.new(color.white, 80));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MACD Line', color: MACD_NEUTRAL, lineWidth: 2 },
  { id: 'plot1', title: 'Signal Line', color: SIGNAL_COL, lineWidth: 1 },
  { id: 'plot2', title: 'MACD Leader', color: LEADER_COL, lineWidth: 1 },
  { id: 'plot3', title: 'MACD Histogram', color: HIST_BULL_STRONG, lineWidth: 1, style: 'histogram' },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline0', price: 0, title: 'Zero Line', color: ZERO_COL, linestyle: 'dashed' },
];

export const metadata = {
  title: 'MACD Pro',
  shortTitle: 'VEGA MACD Pro',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(bars: Bar[], inputs: Partial<MacdProInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const src = getSourceSeries(bars, cfg.source);
  const s = A(src);
  const close = S(bars.map((b) => b.close));

  // MACD
  const fastEma = A(ta.ema(src, cfg.fastPeriod));
  const slowEma = A(ta.ema(src, cfg.slowPeriod));
  const macd = fastEma.map((f, i) => f - slowEma[i]);
  const signal = A(ta.ema(S(macd), cfg.signalPeriod));
  const hist = macd.map((m, i) => m - signal[i]);

  // Leader: sema / lema are the same EMAs as fast_ema / slow_ema
  const e1 = A(ta.ema(S(s.map((v, i) => v - fastEma[i])), cfg.fastPeriod));
  const e2 = A(ta.ema(S(s.map((v, i) => v - slowEma[i])), cfg.slowPeriod));
  const leader = fastEma.map((f, i) => {
    const i1 = f + cfg.leaderFactor * e1[i];
    const i2 = slowEma[i] + cfg.leaderFactor * e2[i];
    return cfg.enableLeader ? i1 - i2 : NaN;
  });

  // Market regime
  const momentum = A(ta.mom(close, 10));
  const smaClose = A(ta.sma(close, 14));
  const trendStrength = smaClose.map((v, i) => (i > 0 ? Math.abs(v - smaClose[i - 1]) : NaN));
  const trendStrengthAvg = A(ta.sma(S(trendStrength), 21));

  const plot0 = [];
  const plot1 = [];
  const plot2 = [];
  const plot3 = [];
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    const strong = gt(trendStrength[i], trendStrengthAvg[i]);
    const bullish = gt(momentum[i], 0) && strong;
    const bearish = lt(momentum[i], 0) && strong;
    const macdColor = bullish ? MACD_BULL : bearish ? MACD_BEAR : MACD_NEUTRAL;
    const h = hist[i];
    const h1 = i > 0 ? hist[i - 1] : NaN;
    const histColor = gt(h, 0) ? (gt(h, h1) ? HIST_BULL_STRONG : HIST_BULL_WEAK) : lt(h, h1) ? HIST_BEAR_STRONG : HIST_BEAR_WEAK;
    plot0.push({ time: t, value: macd[i], color: macdColor });
    plot1.push({ time: t, value: signal[i], color: SIGNAL_COL });
    plot2.push({ time: t, value: leader[i], color: LEADER_COL });
    plot3.push({ time: t, value: cfg.showHistogram ? h : NaN, color: histColor });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2, plot3 },
    hlines: [{ value: 0, options: { title: 'Zero Line', color: ZERO_COL, linestyle: 'dashed' } }],
  };
}

export const MacdPro = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
