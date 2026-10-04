/**
 * MADZ - Moving Average Deviation Z-Score
 *
 * The percentage deviation of the close from a moving average of the source, (close - ma) / ma, is turned into a
 * z-score over `Z-Score Lookback Period` bars ((x - sma) / stdev; a zero stdev is replaced by 0.000001) and smoothed
 * with a volume-weighted moving average. The line is green below the oversold level, red above the overbought level
 * and gray otherwise. Optional dynamic bands at +-3 standard deviations of MADZ; the background is red / green when
 * MADZ is beyond them.
 *
 * Reference: "MADZ - Moving Average Deviation Z-Score" by MiesOnCharts
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © MiesOnCharts
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BgColorData } from '../types';

export type MadzMaType = 'SMA' | 'EMA' | 'WMA' | 'VWMA' | 'HMA' | 'RMA';

export interface MadzMovingAverageDeviationZScoreInputs {
  /** Moving average length */
  length: number;
  /** Moving average source */
  src: SourceType;
  /** Moving average type */
  maType: MadzMaType;
  /** Number of bars of the z-score */
  lookback: number;
  /** VWMA length of the z-score */
  smoothLength: number;
  obLevel: number;
  osLevel: number;
  /** Standard deviation length of the dynamic bands */
  dynLength: number;
  showDynBands: boolean;
  /** Background colour when MADZ is beyond the dynamic bands */
  showExtreme: boolean;
}

export const defaultInputs: MadzMovingAverageDeviationZScoreInputs = {
  length: 150,
  src: 'close',
  maType: 'VWMA',
  lookback: 85,
  smoothLength: 14,
  obLevel: 1.5,
  osLevel: -1.5,
  dynLength: 60,
  showDynBands: false,
  showExtreme: true,
};

const G_MA = 'Moving Average Settings';
const G_Z = 'Z-Score & Smoothing';
const G_LEVELS = 'Threshold Levels';
const G_DISPLAY = 'Display Options';

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 150, min: 1, group: G_MA },
  { id: 'src', type: 'source', title: 'Source', defval: 'close', group: G_MA },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'VWMA', options: ['SMA', 'EMA', 'WMA', 'VWMA', 'HMA', 'RMA'], group: G_MA },
  { id: 'lookback', type: 'int', title: 'Z-Score Lookback Period', defval: 85, min: 1, group: G_Z,
    tooltip: 'Number of bars used to calculate the Z-Score (longer = smoother, shorter = more reactive)' },
  { id: 'smoothLength', type: 'int', title: 'Smoothing Period', defval: 14, min: 1, group: G_Z },
  { id: 'obLevel', type: 'float', title: 'Overbought Level (+%)', defval: 1.5, step: 0.01, group: G_LEVELS },
  { id: 'osLevel', type: 'float', title: 'Oversold Level (-%)', defval: -1.5, step: 0.01, group: G_LEVELS },
  { id: 'dynLength', type: 'int', title: 'Dynamic Bands Length', defval: 60, min: 1, group: G_DISPLAY },
  { id: 'showDynBands', type: 'bool', title: 'Show Dynamic Extreme Bands', defval: false, group: G_DISPLAY },
  { id: 'showExtreme', type: 'bool', title: 'Highlight Extreme Zones (Background)', defval: true, group: G_DISPLAY },
];

const OB_COLOR = String(color.rgb(255, 0, 0));
const OS_COLOR = String(color.rgb(0, 255, 21));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MADZ', color: color.gray, lineWidth: 2 },
  { id: 'plot1', title: 'Dynamic OB Band', color: OB_COLOR, lineWidth: 1 },
  { id: 'plot2', title: 'Dynamic OS Band', color: OS_COLOR, lineWidth: 1 },
  { id: 'plot3', title: 'Midline', color: color.white, lineWidth: 1 },
  { id: 'plot4', title: 'Overbought', color: OB_COLOR, lineWidth: 1, style: 'circles' },
  { id: 'plot5', title: 'Oversold', color: OS_COLOR, lineWidth: 1, style: 'circles' },
];

export const metadata = {
  title: 'MADZ - Moving Average Deviation Z-Score',
  shortTitle: 'MADZ',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<MadzMovingAverageDeviationZScoreInputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const src = getSourceSeries(bars, cfg.src);
  const volume = S(bars.map((b) => b.volume ?? NaN));

  let maS: Series;
  switch (cfg.maType) {
    case 'EMA': maS = ta.ema(src, cfg.length); break;
    case 'WMA': maS = ta.wma(src, cfg.length); break;
    case 'VWMA': maS = ta.vwma(src, cfg.length, volume); break;
    case 'HMA': maS = ta.hma(src, cfg.length); break;
    case 'RMA': maS = ta.rma(src, cfg.length); break;
    default: maS = ta.sma(src, cfg.length);
  }
  const ma = A(maS);

  // percDev = (close - ma) / ma (a plain division)
  const percDev = bars.map((b, i) => (b.close - ma[i]) / ma[i]);
  // zscore(percDev, lookback): stdDev == 0 ? 0.000001 : stdDev
  const mean = A(ta.sma(S(percDev), cfg.lookback));
  const sd = A(ta.stdev(S(percDev), cfg.lookback));
  const rawZ = percDev.map((v, i) => (v - mean[i]) / (eq(sd[i], 0) ? 0.000001 : sd[i]));
  const madz = A(ta.vwma(S(rawZ), cfg.smoothLength, volume));

  const valSd = A(ta.stdev(S(madz), cfg.dynLength));
  const valOb = valSd.map((v) => v * 3);
  const valOs = valSd.map((v) => -v * 3);

  const lineColor = (i: number) => (lt(madz[i], cfg.osLevel) ? OS_COLOR : gt(madz[i], cfg.obLevel) ? OB_COLOR : color.gray);
  const obBg = String(color.new(OB_COLOR, 50));
  const osBg = String(color.new(OS_COLOR, 50));
  const noBg = String(color.new(color.black, 100));

  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const bgColors: BgColorData[] = [];
  if (cfg.showExtreme) {
    for (let i = 0; i < n; i++) {
      const c = gt(madz[i], valOb[i]) ? obBg : lt(madz[i], valOs[i]) ? osBg : noBg;
      bgColors.push({ time: bars[i].time, color: c });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: fin(madz[i]), color: lineColor(i) })),
      plot1: bars.map((b, i) => ({ time: b.time, value: cfg.showDynBands ? fin(valOb[i]) : NaN, color: OB_COLOR })),
      plot2: bars.map((b, i) => ({ time: b.time, value: cfg.showDynBands ? fin(valOs[i]) : NaN, color: OS_COLOR })),
      plot3: bars.map((b) => ({ time: b.time, value: 0, color: color.white })),
      plot4: bars.map((b) => ({ time: b.time, value: cfg.obLevel, color: OB_COLOR })),
      plot5: bars.map((b) => ({ time: b.time, value: cfg.osLevel, color: OS_COLOR })),
    },
    bgColors,
  };
}

export const MadzMovingAverageDeviationZScore = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
