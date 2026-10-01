/**
 * Aggregated Scores Oscillator
 *
 * The score is the sum of an SMA of the Omega ratio and an SMA of the Sortino ratio of the bar returns
 * r = close / close[1] - 1 over `period` bars. Omega = sum of the returns above the target return / sum of the
 * shortfalls below it. Sortino = mean return / downside deviation * sqrt(365). The bands average an expanding band
 * (mean +/- multiplier * standard deviation of all scores so far) and a rolling band (SMA +/- multiplier * stdev over
 * `rollingWindow` bars); the upper band is scaled by the upper band sensitivity. The score is red above the upper
 * threshold (overbought), green below the lower threshold (oversold) and white otherwise; the price pane background
 * shows the same zones.
 *
 * Reference: "Aggregated Scores Oscillator [Alpha Extract]" by AlphaExtract
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';

export interface AggregatedScoresOscillatorInputs {
  /** Calculation period of the Omega and Sortino ratios */
  period: number;
  /** Target return */
  targetReturn: number;
  /** Window of the rolling statistics */
  rollingWindow: number;
  /** Upper band multiplier (expanding) */
  upperMultiplier: number;
  /** Lower band multiplier (expanding) */
  lowerMultiplier: number;
  /** Rolling band multiplier */
  rollingMultiplier: number;
  /** Upper band sensitivity */
  upperBandAdjust: number;
  /** Omega SMA length */
  omegaSma: number;
  /** Sortino SMA length */
  sortinoSma: number;
}

export const defaultInputs: AggregatedScoresOscillatorInputs = {
  period: 150,
  targetReturn: 0,
  rollingWindow: 200,
  upperMultiplier: 1.75,
  lowerMultiplier: 1.5,
  rollingMultiplier: 1.8,
  upperBandAdjust: 0.9,
  omegaSma: 5,
  sortinoSma: 7,
};

export const inputConfig: InputConfig[] = [
  { id: 'period', type: 'int', title: 'Calculation Period', defval: 150, min: 10, max: 500 },
  { id: 'targetReturn', type: 'float', title: 'Target Return', defval: 0, step: 0.001 },
  { id: 'rollingWindow', type: 'int', title: 'Rolling Window', defval: 200, min: 50, max: 300 },
  { id: 'upperMultiplier', type: 'float', title: 'Upper Band Multiplier (Expanding)', defval: 1.75, min: 0.5, max: 3, step: 0.1 },
  { id: 'lowerMultiplier', type: 'float', title: 'Lower Band Multiplier (Expanding)', defval: 1.5, min: 0.5, max: 3, step: 0.1 },
  { id: 'rollingMultiplier', type: 'float', title: 'Rolling Band Multiplier', defval: 1.8, min: 0.5, max: 3, step: 0.1 },
  { id: 'upperBandAdjust', type: 'float', title: 'Upper Band Sensitivity', defval: 0.9, min: 0.5, max: 1, step: 0.01 },
  { id: 'omegaSma', type: 'int', title: 'Omega SMA Length', defval: 5, min: 1, max: 20 },
  { id: 'sortinoSma', type: 'int', title: 'Sortino SMA Length', defval: 7, min: 1, max: 20 },
];

const BULLISH = String(color.new('#00ff88', 0));
const BEARISH = String(color.new('#ff3366', 0));
const NEUTRAL = String(color.new('#ffffff', 20));
const UPPER_BAND = String(color.new('#ff0066', 30));
const LOWER_BAND = String(color.new('#00cc88', 30));
const OS_COL = String(color.new('#00ff88', 80));
const OB_COL = String(color.new('#ff3366', 80));
const CHANNEL_FILL = String(color.new(color.purple, 96));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Aggregated Score', color: NEUTRAL, lineWidth: 3 },
  { id: 'plot1', title: 'Upper Threshold', color: UPPER_BAND, lineWidth: 2 },
  { id: 'plot2', title: 'Lower Threshold', color: LOWER_BAND, lineWidth: 2 },
];

export const metadata = {
  title: 'Aggregated Scores Oscillator [Alpha Extract]',
  shortTitle: 'Aggregated Scores Oscillator [Alpha Extract]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
/** Pine x != 0: false when x is na or within 1e-10 of 0 */
const nonZero = (x: number) => !isNaN(x) && Math.abs(x) > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<AggregatedScoresOscillatorInputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const { period, targetReturn } = cfg;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  // dailyReturn = close / close[1] - 1
  const ret = bars.map((b, i) => (i > 0 ? b.close / bars[i - 1].close - 1 : NaN));
  // excess / deficit terms: an na return compares false, so the term is 0
  const up = ret.map((r) => (gt(r, targetReturn) ? r - targetReturn : 0));
  const down = ret.map((r) => (lt(r, targetReturn) ? targetReturn - r : 0));
  const downSq = ret.map((r) => {
    const d = lt(r, targetReturn) ? r - targetReturn : 0;
    return d * d;
  });

  const omega: number[] = new Array(n).fill(NaN);
  const sortino: number[] = new Array(n).fill(NaN);
  const meanReturn = A(ta.sma(S(ret), period));
  for (let i = 0; i < n; i++) {
    // math.sum(x, period): na until period bars
    let excess = NaN;
    let deficit = NaN;
    if (i >= period - 1) {
      excess = 0;
      deficit = 0;
      for (let j = i - period + 1; j <= i; j++) {
        excess += up[j];
        deficit += down[j];
      }
    }
    omega[i] = nonZero(deficit) ? excess / deficit : NaN;
    // for i = 0 to period - 1: dailyReturn[i] before the first bar is na (term 0)
    let dd = 0;
    for (let j = 0; j < period; j++) {
      if (i - j >= 0) dd += downSq[i - j];
    }
    dd = Math.sqrt(dd / period);
    sortino[i] = nonZero(dd) ? (meanReturn[i] / dd) * Math.sqrt(365) : NaN;
  }
  const omegaSmaValue = A(ta.sma(S(omega), cfg.omegaSma));
  const sortinoSmaValue = A(ta.sma(S(sortino), cfg.sortinoSma));
  const score = omegaSmaValue.map((o, i) => o + sortinoSmaValue[i]);

  // Rolling statistics
  const rollingMean = A(ta.sma(S(score), cfg.rollingWindow));
  const rollingStd = A(ta.stdev(S(score), cfg.rollingWindow));

  const upper: number[] = new Array(n);
  const lower: number[] = new Array(n);
  const ob: boolean[] = new Array(n);
  const os: boolean[] = new Array(n);
  // Expanding statistics (var float cumulativeSum = 0, cumulativeSquareSum = 0, var int count = 0)
  let cumSum = 0;
  let cumSq = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    const s = score[i];
    if (!isNaN(s)) {
      cumSum += s;
      cumSq += s * s;
      count += 1;
    }
    const expandingMean = count === 0 ? NaN : cumSum / count;
    const variance = (count === 0 ? NaN : cumSq / count) - expandingMean * expandingMean;
    const expandingStd = Math.sqrt(variance);
    const expUpper = expandingMean + expandingStd * cfg.upperMultiplier;
    const expLower = expandingMean - expandingStd * cfg.lowerMultiplier;
    const rollUpper = rollingMean[i] + rollingStd[i] * cfg.rollingMultiplier;
    const rollLower = rollingMean[i] - rollingStd[i] * cfg.rollingMultiplier;
    upper[i] = ((expUpper + rollUpper) / 2) * cfg.upperBandAdjust;
    lower[i] = (expLower + rollLower) / 2;
    ob[i] = gt(s, upper[i]);
    os[i] = lt(s, lower[i]);
  }

  const bgColors: BgColorData[] = [];
  for (let i = 0; i < n; i++) {
    // bgcolor(OB ? OBCol : OS ? OSCol : na, force_overlay = true)
    if (ob[i]) bgColors.push({ time: bars[i].time, color: OB_COL, forceOverlay: true });
    else if (os[i]) bgColors.push({ time: bars[i].time, color: OS_COL, forceOverlay: true });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: score[i], color: ob[i] ? BEARISH : os[i] ? BULLISH : NEUTRAL })),
      plot1: bars.map((b, i) => ({ time: b.time, value: upper[i], color: UPPER_BAND })),
      plot2: bars.map((b, i) => ({ time: b.time, value: lower[i], color: LOWER_BAND })),
    },
    hlines: [
      { value: 0, options: { title: '━━━ Zero Line ━━━', color: String(color.new(color.gray, 50)), linestyle: 'dashed', linewidth: 1 } },
    ],
    fills: [
      { plot1: 'plot1', plot2: 'plot2', options: { title: 'Channel Fill', color: CHANNEL_FILL } },
    ],
    bgColors,
  };
}

export const AggregatedScoresOscillator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
