/**
 * Deviation Symmetry Breaker
 *
 * The centre line is a double median of the source (a median over the first length, then a median of it over the
 * second length). The bands are centre + stdev(centre, deviation length) * upper multiplier and centre - stdev *
 * lower multiplier. A cross of the source above the upper band sets the trend up, a cross below the lower band sets
 * it down. The candles are drawn in the indicator pane and on the price pane, blue in an up trend and red in a down
 * trend (no colour before the first signal).
 *
 * Reference: "Deviation Symmetry Breaker ~ C H I P A" by C_H_I_P_A
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';

export interface DeviationSymmetryBreakerInputs {
  src: SourceType;
  /** First Median Length */
  length: number;
  /** Second Median Length (Smoother) */
  secondMedianLen: number;
  /** Deviation Band Length */
  deviationLen: number;
  upperBandMult: number;
  lowerBandMult: number;
}

export const defaultInputs: DeviationSymmetryBreakerInputs = {
  src: 'close',
  length: 33,
  secondMedianLen: 34,
  deviationLen: 25,
  upperBandMult: 1.72,
  lowerBandMult: -1.12,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'length', type: 'int', title: 'First Median Length', defval: 33, min: 1 },
  { id: 'secondMedianLen', type: 'int', title: 'Second Median Length (Smoother)', defval: 34, min: 1 },
  { id: 'deviationLen', type: 'int', title: 'Deviation Band Length', defval: 25, min: 1 },
  { id: 'upperBandMult', type: 'float', title: 'Upper Band Multiplier', defval: 1.72, step: 0.01 },
  { id: 'lowerBandMult', type: 'float', title: 'Lower Band Multiplier', defval: -1.12, step: 0.01 },
];

const BAND_COL = String(color.rgb(180, 180, 255));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Band', color: BAND_COL, lineWidth: 1 },
  { id: 'plot1', title: 'Lower Band', color: BAND_COL, lineWidth: 1 },
];

export const metadata = {
  title: 'Deviation Symmetry Breaker ~ C H I P A',
  shortTitle: 'Deviation Symmetry Breaker ~ C H I P A',
  overlay: false,
};

export function calculate(
  bars: Bar[],
  inputs: Partial<DeviationSymmetryBreakerInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  const src = getSourceSeries(bars, cfg.src);
  const firstMedian = ta.median(src, cfg.length);
  const centerlineS = ta.median(firstMedian, cfg.secondMedianLen);
  const centerline = A(centerlineS);
  const symmetryDev = A(ta.stdev(centerlineS, cfg.deviationLen));

  const upper = centerline.map((c, i) => c + symmetryDev[i] * cfg.upperBandMult);
  const lower = centerline.map((c, i) => c - symmetryDev[i] * cfg.lowerBandMult);
  // ta.crossover(src, upper_band) / ta.crossunder(src, lower_band): exact comparisons
  const longSignal = ta.crossover(src, Series.fromArray(bars, upper)).toArray();
  const shortSignal = ta.crossunder(src, Series.fromArray(bars, lower)).toArray();

  const up = String(color.rgb(0, 180, 255));
  const down = String(color.rgb(255, 80, 60));
  const pane: PlotCandleData[] = [];
  const overlay: PlotCandleData[] = [];
  const plot0: { time: number; value: number }[] = [];
  const plot1: { time: number; value: number }[] = [];
  let trend = 0; // var trend = 0
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    if (longSignal[i]) trend = 1;
    if (shortSignal[i]) trend = -1;
    plot0.push({ time: b.time as number, value: upper[i] });
    plot1.push({ time: b.time as number, value: lower[i] });
    // coloring = trend == 1 ? rgb(0, 180, 255) : trend == -1 ? rgb(255, 80, 60) : na
    const c = trend === 1 ? up : trend === -1 ? down : 'transparent';
    const candle = { time: b.time as number, open: b.open, high: b.high, low: b.low, close: b.close, color: c, wickColor: c, borderColor: c };
    pane.push(candle);
    // the second plotcandle has force_overlay = true
    overlay.push({ ...candle, forceOverlay: true });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1 },
    markers: [],
    plotCandles: { barColoring: pane, barColoringOverlay: overlay },
  };
}

export const DeviationSymmetryBreaker = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
