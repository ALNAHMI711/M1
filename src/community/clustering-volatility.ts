/**
 * Clustering Volatility (ATR-ADR-ChaikinVol)
 *
 * Three volatility measures: the ATR, the ADR (SMA of the bar range high - low) and a Chaikin oscillator (EMA(short)
 * - EMA(long) of the cumulative accumulation / distribution line). Each one is normalized over a window (MinMax:
 * position between the lowest and highest value; Rank: rank of the current value in a buffer of the last values;
 * Zscore: MinMax of the z-score). The weighted sum of the three (weights summing to 1 when asked) is normalized again
 * between its lowest and highest value of the window, optionally inverted, clamped to 0..1 and smoothed with an EMA.
 * The smoothed score gives a cluster index (score * (clusters - 1), floored), whose colour can colour the bars. The
 * score line is lime below 0.2, red above 0.8 and yellow otherwise. The window is a fixed size, or 20 days of bars
 * (390 minutes per day, from the time between the last two bars; at least 20 bars).
 *
 * Reference: "Clustering Volatility (ATR-ADR-ChaikinVol) [Sam SDF-Solutions]" by SDF-Solutions
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, callsite, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface ClusteringVolatilityInputs {
  autoWindow: boolean;
  lookbackDays: number;
  fixedWindowSize: number;
  clusterCount: number;
  clustMethod: 'MinMax' | 'Rank' | 'Zscore';
  atrLength: number;
  adrLength: number;
  shortChLength: number;
  longChLength: number;
  wATR: number;
  wADR: number;
  wChaikin: number;
  normalizeWeights: boolean;
  invertClusters: boolean;
  scoreSmoothLength: number;
  showBarColor: boolean;
}

export const defaultInputs: ClusteringVolatilityInputs = {
  autoWindow: false,
  lookbackDays: 20.0,
  fixedWindowSize: 500,
  clusterCount: 5,
  clustMethod: 'MinMax',
  atrLength: 14,
  adrLength: 14,
  shortChLength: 5,
  longChLength: 20,
  wATR: 1.0,
  wADR: 1.0,
  wChaikin: 1.0,
  normalizeWeights: true,
  invertClusters: false,
  scoreSmoothLength: 5,
  showBarColor: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'autoWindow', type: 'bool', title: 'Auto Select Window?', defval: false },
  { id: 'lookbackDays', type: 'float', title: 'Lookback Days for Auto Selection', defval: 20.0 },
  { id: 'fixedWindowSize', type: 'int', title: 'Fixed Window Size', defval: 500, min: 20 },
  { id: 'clusterCount', type: 'int', title: 'Number of Clusters', defval: 5, min: 2, max: 9 },
  { id: 'clustMethod', type: 'string', title: 'Normalization Method', defval: 'MinMax', options: ['MinMax', 'Rank', 'Zscore'] },
  { id: 'atrLength', type: 'int', title: 'ATR Period', defval: 14 },
  { id: 'adrLength', type: 'int', title: 'ADR Period', defval: 14 },
  { id: 'shortChLength', type: 'int', title: 'Chaikin Short EMA Period', defval: 5 },
  { id: 'longChLength', type: 'int', title: 'Chaikin Long EMA Period', defval: 20 },
  { id: 'wATR', type: 'float', title: 'Weight ATR', defval: 1.0, step: 0.1 },
  { id: 'wADR', type: 'float', title: 'Weight ADR', defval: 1.0, step: 0.1 },
  { id: 'wChaikin', type: 'float', title: 'Weight Chaikin Osc', defval: 1.0, step: 0.1 },
  { id: 'normalizeWeights', type: 'bool', title: 'Normalize Weights to Sum to 1?', defval: true },
  { id: 'invertClusters', type: 'bool', title: 'Invert Cluster Order?', defval: false },
  { id: 'scoreSmoothLength', type: 'int', title: 'EMA Period for Score Smoothing', defval: 5 },
  { id: 'showBarColor', type: 'bool', title: 'Show Bar Colors?', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Score (0..1) [Smoothed]', color: color.yellow, lineWidth: 2 },
];

export const metadata = {
  title: 'Clustering Volatility (ATR-ADR-ChaikinVol) [Sam SDF-Solutions]',
  shortTitle: 'ClustVol (ATR-ADR-ChaikinVol)',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
/** Pine `x != y`: false when one side is na */
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !eq(a, b);

/** Cluster colours: index 0 when the cluster is na, then the clusters 0..8 */
const CLUSTER_COLORS = [
  color.gray, color.yellow, color.orange, color.red, color.fuchsia, color.lime, '#00FFFF', '#800080', '#008000', '#808080',
];

export function calculate(
  bars: Bar[],
  inputs: Partial<ClusteringVolatilityInputs> = {},
): IndicatorResult & { barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  // Window: currentRes = (time - time[1]) / 60000 (minutes; na on the first bar), barsPerDay = 390 / currentRes
  const windowSize = bars.map((b, i) => {
    if (!cfg.autoWindow) return cfg.fixedWindowSize;
    const currentRes = i > 0 ? ((b.time as number) - (bars[i - 1].time as number)) * 1000 / 60000 : NaN;
    const autoWindowFloat = cfg.lookbackDays * (390.0 / currentRes);
    return gt(autoWindowFloat, 20) ? Math.round(autoWindowFloat) : 20;
  });

  // f_minmax(src, len): one ta.lowest / ta.highest pair per call site, with the series length windowSize
  const minmaxSite = () => {
    const lowest = callsite.lowest();
    const highest = callsite.highest();
    return (src: number, len: number) => {
      const mn = lowest(src, len);
      const mx = highest(src, len);
      const rg = mx - mn;
      return !isNaN(rg) && ne(rg, 0) ? (src - mn) / rg : NaN;
    };
  };

  // f_rankNorm(src, len): var buffer of the last len non-na values; rank of the newest value in the sorted copy
  const rankSite = () => {
    const buffer: number[] = [];
    return (src: number, len: number) => {
      if (!isNaN(src)) buffer.push(src);
      if (buffer.length > len) buffer.shift();
      const size = buffer.length;
      if (size <= 1) return NaN;
      const temp = [...buffer].sort((a, b) => a - b);
      const currentVal = buffer[size - 1];
      for (let k = 0; k < size; k++) if (ge(temp[k], currentVal)) return k / (size - 1);
      return NaN;
    };
  };

  // f_normalize(src) for one call site: the whole series (the method is an input, so one branch runs on every bar)
  const normalize = (src: number[]): number[] => {
    if (cfg.clustMethod === 'MinMax') {
      const site = minmaxSite();
      return src.map((v, i) => site(v, windowSize[i]));
    }
    if (cfg.clustMethod === 'Rank') {
      const site = rankSite();
      return src.map((v, i) => site(v, windowSize[i]));
    }
    // f_zscoreNorm: ta.sma / ta.stdev with the series length windowSize
    const meanVal = A(ta.sma(S(src), S(windowSize)));
    const stdDev = A(ta.stdev(S(src), S(windowSize)));
    // z = (stdDev != 0) ? (src - meanVal) / stdDev : 0 (na stdDev gives 0)
    const z = src.map((v, i) => (ne(stdDev[i], 0) ? (v - meanVal[i]) / stdDev[i] : 0));
    const site = minmaxSite();
    return z.map((v, i) => site(v, windowSize[i]));
  };

  // Volatility measures
  const atrValue = A(ta.atr(bars, cfg.atrLength));
  const adrValue = A(ta.sma(S(bars.map((b) => b.high - b.low)), cfg.adrLength));
  // adValue = (high == low) ? 0 : volume * ((close - low) - (high - close)) / (high - low); adLine := nz(adLine[1]) + adValue
  const adLine: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const vol = b.volume ?? NaN;
    const adValue = eq(b.high, b.low) ? 0 : (vol * ((b.close - b.low) - (b.high - b.close))) / (b.high - b.low);
    const prev = i > 0 && !isNaN(adLine[i - 1]) ? adLine[i - 1] : 0;
    adLine[i] = prev + adValue;
  }
  const emaShort = A(ta.ema(S(adLine), cfg.shortChLength));
  const emaLong = A(ta.ema(S(adLine), cfg.longChLength));
  const chaikinOsc = emaShort.map((v, i) => v - emaLong[i]);

  const normATR = normalize(atrValue);
  const normADR = normalize(adrValue);
  const normChaikin = normalize(chaikinOsc);

  const totalWeight = cfg.wATR + cfg.wADR + cfg.wChaikin;
  const useNorm = cfg.normalizeWeights && ne(totalWeight, 0);
  const wAtr = useNorm ? cfg.wATR / totalWeight : cfg.wATR;
  const wAdr = useNorm ? cfg.wADR / totalWeight : cfg.wADR;
  const wCh = useNorm ? cfg.wChaikin / totalWeight : cfg.wChaikin;

  // Score normalized over the window, inverted when asked, clamped to 0..1 (na stays na)
  const scoreLowest = callsite.lowest();
  const scoreHighest = callsite.highest();
  const scoreNormalized: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    let rawScore = 0.0;
    rawScore += isNaN(normATR[i]) ? 0 : normATR[i] * wAtr;
    rawScore += isNaN(normADR[i]) ? 0 : normADR[i] * wAdr;
    rawScore += isNaN(normChaikin[i]) ? 0 : normChaikin[i] * wCh;
    const scoreMin = scoreLowest(rawScore, windowSize[i]);
    const scoreMax = scoreHighest(rawScore, windowSize[i]);
    const scoreRange = scoreMax - scoreMin;
    let s = isNaN(scoreRange) || eq(scoreRange, 0) ? NaN : (rawScore - scoreMin) / scoreRange;
    if (cfg.invertClusters) s = 1.0 - s;
    scoreNormalized[i] = isNaN(s) ? NaN : Math.max(0, Math.min(s, 1));
  }
  const smoothedScore = A(ta.ema(S(scoreNormalized), cfg.scoreSmoothLength));

  const plot0 = bars.map((b, i) => {
    const s = smoothedScore[i];
    const c = lt(s, 0.2) ? color.lime : gt(s, 0.8) ? color.red : color.yellow;
    return { time: b.time, value: Number.isFinite(s) ? s : NaN, color: c };
  });

  // barcolor(showBarColor ? barColor : na)
  const barColors: BarColorData[] = [];
  if (cfg.showBarColor) {
    for (let i = 0; i < n; i++) {
      const s = smoothedScore[i];
      let idx = 0;
      if (!isNaN(s)) {
        const clusterFloor = Math.floor(s * (cfg.clusterCount - 1));
        const clusterIndex = clusterFloor < 0 ? 0 : clusterFloor > cfg.clusterCount - 1 ? cfg.clusterCount - 1 : clusterFloor;
        idx = clusterIndex + 1;
      }
      barColors.push({ time: bars[i].time as number, color: CLUSTER_COLORS[idx] });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
    barColors,
  };
}

export const ClusteringVolatility = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
