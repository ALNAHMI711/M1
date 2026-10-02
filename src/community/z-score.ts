/**
 * Z-Score
 *
 * z = (source - sma(source, length)) / stdev(source, length). Over the same length, the highest (100th percentile)
 * and lowest (0th percentile, linear interpolation) z-scores, the mean z-score (SMA) and the root mean square of
 * the z-score (sqrt(sma(z * z, length))), plotted as a positive and a negative line.
 *
 * Reference: "Z-Score" by joecalledher
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface ZScoreInputs {
  /** Length of the mean, the deviation and the z-score statistics */
  length: number;
  /** Source */
  source: SourceType;
  colorScore: string;
  colorHigh: string;
  colorLow: string;
  colorAverage: string;
  colorRms: string;
}

export const defaultInputs: ZScoreInputs = {
  length: 20,
  source: 'close',
  colorScore: color.orange,
  colorHigh: color.red,
  colorLow: color.blue,
  colorAverage: color.purple,
  colorRms: color.white,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'colorScore', type: 'color', title: 'Z-Score', defval: color.orange },
  { id: 'colorHigh', type: 'color', title: 'High', defval: color.red },
  { id: 'colorLow', type: 'color', title: 'Low', defval: color.blue },
  { id: 'colorAverage', type: 'color', title: 'Average', defval: color.purple },
  { id: 'colorRms', type: 'color', title: 'RMS', defval: color.white },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Z-Score', color: color.orange, lineWidth: 1 },
  { id: 'plot1', title: 'High', color: color.red, lineWidth: 1 },
  { id: 'plot2', title: 'Low', color: color.blue, lineWidth: 1 },
  { id: 'plot3', title: 'Average', color: color.purple, lineWidth: 1 },
  { id: 'plot4', title: 'Pos RMS', color: color.white, lineWidth: 1 },
  { id: 'plot5', title: 'Neg RMS', color: color.white, lineWidth: 1 },
];

export const metadata = {
  title: 'Z-Score',
  shortTitle: 'Zscore',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<ZScoreInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const { length } = cfg;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  const src = A(getSourceSeries(bars, cfg.source));
  const mean = A(ta.sma(S(src), length));
  const deviation = A(ta.stdev(S(src), length));
  // zscore = displacement / deviation: a plain division (x / 0 is +-infinity, 0 / 0 NaN), passed as it is to the
  // ta functions; plots show na for non-finite values
  const zscore = src.map((x, i) => (x - mean[i]) / deviation[i]);
  const zS = S(zscore);
  const zranklo = A(ta.percentile_linear_interpolation(zS, length, 0));
  const zrankhi = A(ta.percentile_linear_interpolation(zS, length, 100));
  const zmean = A(ta.sma(zS, length));
  const zrms = A(ta.sma(S(zscore.map((z) => z * z)), length)).map((v) => Math.sqrt(v));

  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const line = (values: number[], c: string) => bars.map((b, i) => ({ time: b.time, value: fin(values[i]), color: c }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: line(zscore, cfg.colorScore),
      plot1: line(zrankhi, cfg.colorHigh),
      plot2: line(zranklo, cfg.colorLow),
      plot3: line(zmean, cfg.colorAverage),
      plot4: line(zrms, cfg.colorRms),
      plot5: line(zrms.map((v) => v * -1), cfg.colorRms),
    },
  };
}

export const ZScore = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
