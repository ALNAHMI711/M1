/**
 * Moving Volume-Weighted Avg Price, % Channel, BBs
 *
 * Moving VWAP: sum(source * volume) / sum(volume) over the last `windowLen` bars (fewer bars at the start of the
 * history; bars with an na source or volume are skipped; na when the volume sum is not above 0). Percentage bands
 * at VWAP * (1 +- percent / 100) with a fill, and optional standard deviation bands at
 * VWAP +- stdev(source, stdDevLen) * multiplier with a fill.
 *
 * Reference: "Moving Volume-Weighted Avg Price, % Channel, BBs" by NeanderTraderBC
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Copyright © 2025 t00mietum (aka TV "NeanderTraderBC").
 */

import {
  ta, getSourceSeries, color,
  type IndicatorResult, type InputConfig, type PlotConfig, type FillConfig, type Bar, type SourceType,
} from 'oakscriptjs';

export interface MovingVolumeWeightedAvgPriceChannelBbsInputs {
  /** Price source */
  priceSource: SourceType;
  /** VWAP window length (bars) */
  windowLen: number;
  /** Show the percentage bands */
  showBand1: boolean;
  /** Percentage points of the bands */
  percentBandMult1: number;
  /** Show the standard deviation bands */
  showBand2: boolean;
  /** Standard deviation multiplier */
  stdDevBandMult1: number;
  /** Standard deviation length */
  stdDevLen: number;
}

export const defaultInputs: MovingVolumeWeightedAvgPriceChannelBbsInputs = {
  priceSource: 'ohlc4',
  windowLen: 23,
  showBand1: true,
  percentBandMult1: 2.0,
  showBand2: false,
  stdDevBandMult1: 2.25,
  stdDevLen: 17,
};

export const inputConfig: InputConfig[] = [
  { id: 'priceSource', type: 'source', title: 'Source', defval: 'ohlc4', group: 'CVWAP settings' },
  { id: 'windowLen', type: 'int', title: 'VWAP Window Length (bars)', defval: 23, min: 1, max: 5000, group: 'CVWAP settings' },
  { id: 'showBand1', type: 'bool', title: 'Show Percentage Bands', defval: true, group: 'Bands settings' },
  { id: 'percentBandMult1', type: 'float', title: 'Percentage Points', defval: 2.0, min: 0, step: 0.25, group: 'Bands settings' },
  { id: 'showBand2', type: 'bool', title: 'Show StdDev Bands', defval: false, group: 'Bands settings' },
  { id: 'stdDevBandMult1', type: 'float', title: 'StdDev Multiplier', defval: 2.25, min: 0, step: 0.25, group: 'Bands settings' },
  { id: 'stdDevLen', type: 'int', title: 'StdDev Length', defval: 17, min: 1, max: 999, step: 1, group: 'Bands settings' },
];

const UPPER_PCT_COL = String(color.new(color.green, 50));
const LOWER_PCT_COL = String(color.new(color.red, 50));
const PCT_FILL_COL = String(color.new(color.green, 95));
const STD_COL = String(color.rgb(0, 64, 255, 60));
const STD_FILL_COL = String(color.rgb(0, 255, 255, 96));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VWAP', color: color.yellow, lineWidth: 1 },
  { id: 'plot1', title: 'Upper Percentage Band', color: UPPER_PCT_COL, lineWidth: 1 },
  { id: 'plot2', title: 'Lower Percentage Band', color: LOWER_PCT_COL, lineWidth: 1 },
  { id: 'plot3', title: 'Upper StdDev Band', color: STD_COL, lineWidth: 1 },
  { id: 'plot4', title: 'Lower StdDev Band', color: STD_COL, lineWidth: 1 },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill_pct', plot1: 'plot1', plot2: 'plot2', color: PCT_FILL_COL, title: 'Percentage Band Fill' },
  { id: 'fill_std', plot1: 'plot3', plot2: 'plot4', color: STD_FILL_COL, title: 'StdDev Band Fill' },
];

export const metadata = {
  title: 'Moving Volume-Weighted Avg Price, % Channel, BBs v4.0.1',
  shortTitle: 'MVWAP+',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<MovingVolumeWeightedAvgPriceChannelBbsInputs> = {},
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const srcSeries = getSourceSeries(bars, cfg.priceSource);
  const price = srcSeries.toArray().map((v) => v ?? NaN);
  const volume = bars.map((b) => b.volume ?? NaN);

  // for i = 0 to math.min(windowLen - 1, bar_index): sums of price * volume and of volume (na values skipped)
  const vwap: number[] = new Array(n);
  for (let k = 0; k < n; k++) {
    let sumPriceVolume = 0;
    let sumVol = 0;
    const last = Math.min(cfg.windowLen - 1, k);
    for (let i = 0; i <= last; i++) {
      const p = price[k - i];
      const v = volume[k - i];
      if (!isNaN(p) && !isNaN(v)) {
        sumPriceVolume += p * v;
        sumVol += v;
      }
    }
    vwap[k] = gt(sumVol, 0) ? sumPriceVolume / sumVol : NaN;
  }

  const stdDev = ta.stdev(srcSeries, cfg.stdDevLen).toArray().map((v) => v ?? NaN);
  const pct = cfg.percentBandMult1 / 100;

  const t = (i: number) => bars[i].time;
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((_b, i) => ({ time: t(i), value: vwap[i], color: color.yellow })),
      plot1: bars.map((_b, i) => ({
        time: t(i), value: cfg.showBand1 ? vwap[i] + vwap[i] * pct : NaN, color: UPPER_PCT_COL,
      })),
      plot2: bars.map((_b, i) => ({
        time: t(i), value: cfg.showBand1 ? vwap[i] - vwap[i] * pct : NaN, color: LOWER_PCT_COL,
      })),
      plot3: bars.map((_b, i) => ({
        time: t(i), value: cfg.showBand2 ? vwap[i] + stdDev[i] * cfg.stdDevBandMult1 : NaN, color: STD_COL,
      })),
      plot4: bars.map((_b, i) => ({
        time: t(i), value: cfg.showBand2 ? vwap[i] - stdDev[i] * cfg.stdDevBandMult1 : NaN, color: STD_COL,
      })),
    },
    fills: [
      { plot1: 'plot1', plot2: 'plot2', options: { title: 'Percentage Band Fill' }, colors: new Array<string>(n).fill(PCT_FILL_COL) },
      { plot1: 'plot3', plot2: 'plot4', options: { title: 'StdDev Band Fill' }, colors: new Array<string>(n).fill(STD_FILL_COL) },
    ],
  };
}

export const MovingVolumeWeightedAvgPriceChannelBbs = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
};
