/**
 * Volatility Band Cloud with Overextension Signals
 *
 * An SMA basis of the source with inner and outer bands at basis +- deviation * stdev over the same length. The
 * bands are filled as a cloud (extension zones between the inner and outer bands, neutral zones between the inner
 * bands and the basis). An "Upper" triangle above the bar marks a source crossover of the upper outer band, a
 * "Lower" triangle below the bar a source crossunder of the lower outer band.
 *
 * Reference: "Volatility Band Cloud with Overextension Signals" by Retire_by_50
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface VolatilityBandCloudWithOverextensionSignalsInputs {
  /** Basis length */
  length: number;
  source: SourceType;
  innerDeviation: number;
  outerDeviation: number;
  showCenterLine: boolean;
  showBandCloud: boolean;
  showMarkers: boolean;
}

export const defaultInputs: VolatilityBandCloudWithOverextensionSignalsInputs = {
  length: 100,
  source: 'close',
  innerDeviation: 1.0,
  outerDeviation: 2.5,
  showCenterLine: true,
  showBandCloud: true,
  showMarkers: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Basis Length', defval: 100, min: 1 },
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'innerDeviation', type: 'float', title: 'Inner Band Deviation', defval: 1.0, min: 0.1, step: 0.1 },
  { id: 'outerDeviation', type: 'float', title: 'Outer Band Deviation', defval: 2.5, min: 0.1, step: 0.1 },
  { id: 'showCenterLine', type: 'bool', title: 'Show Center Line?', defval: true },
  { id: 'showBandCloud', type: 'bool', title: 'Show Volatility Cloud?', defval: true },
  { id: 'showMarkers', type: 'bool', title: 'Show Overextension Markers?', defval: true },
];

const UPPER_INNER_COL = String(color.rgb(255, 120, 120));
const LOWER_INNER_COL = String(color.rgb(90, 190, 90));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Outer Band', color: color.red, lineWidth: 2 },
  { id: 'plot1', title: 'Upper Inner Band', color: UPPER_INNER_COL, lineWidth: 1 },
  { id: 'plot2', title: 'Center Line', color: color.blue, lineWidth: 2 },
  { id: 'plot3', title: 'Lower Inner Band', color: LOWER_INNER_COL, lineWidth: 1 },
  { id: 'plot4', title: 'Lower Outer Band', color: color.lime, lineWidth: 2 },
];

export const metadata = {
  title: 'Volatility Band Cloud with Overextension Signals',
  shortTitle: 'VB Cloud Signals',
  overlay: true,
};

export function calculate(
  bars: Bar[],
  inputs: Partial<VolatilityBandCloudWithOverextensionSignalsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const src = getSourceSeries(bars, cfg.source);

  const basis = A(ta.sma(src, cfg.length));
  const dev = A(ta.stdev(src, cfg.length));
  const upperOuter = basis.map((b, i) => b + cfg.outerDeviation * dev[i]);
  const upperInner = basis.map((b, i) => b + cfg.innerDeviation * dev[i]);
  const lowerInner = basis.map((b, i) => b - cfg.innerDeviation * dev[i]);
  const lowerOuter = basis.map((b, i) => b - cfg.outerDeviation * dev[i]);

  // ta.crossover(source, upperOuterBand) / ta.crossunder(source, lowerOuterBand)
  const upperTag = A(ta.crossover(src, S(upperOuter)));
  const lowerTag = A(ta.crossunder(src, S(lowerOuter)));

  const t = (i: number) => bars[i].time;
  const line = (v: number[], c: string) => bars.map((_b, i) => ({ time: t(i), value: v[i], color: c }));
  const plots = {
    plot0: line(upperOuter, color.red),
    plot1: line(upperInner, UPPER_INNER_COL),
    plot2: line(cfg.showCenterLine ? basis : new Array<number>(n).fill(NaN), color.blue),
    plot3: line(lowerInner, LOWER_INNER_COL),
    plot4: line(lowerOuter, color.lime),
  };

  // fill(..., color = showBandCloud ? color.new(c, t) : na)
  const fillCol = (c: string, tr: number) => new Array<string>(n).fill(cfg.showBandCloud ? String(color.new(c, tr)) : 'transparent');
  const fills = [
    { plot1: 'plot0', plot2: 'plot1', options: { title: 'Upper Extension Zone' }, colors: fillCol(color.red, 88) },
    { plot1: 'plot1', plot2: 'plot2', options: { title: 'Upper Neutral Zone' }, colors: fillCol(color.red, 95) },
    { plot1: 'plot2', plot2: 'plot3', options: { title: 'Lower Neutral Zone' }, colors: fillCol(color.green, 95) },
    { plot1: 'plot3', plot2: 'plot4', options: { title: 'Lower Extension Zone' }, colors: fillCol(color.green, 88) },
  ];

  const markers: MarkerData[] = [];
  for (let i = 0; i < n; i++) {
    if (!cfg.showMarkers) break;
    // plotshape(showMarkers and upperBandTag, 'Upper', shape.triangledown, location.abovebar, color.red, size.small)
    if (upperTag[i] === 1) {
      markers.push({ time: t(i), position: 'aboveBar', shape: 'triangleDown', color: color.red, text: 'Upper',
        textColor: color.red, size: 'small' });
    }
    // plotshape(showMarkers and lowerBandTag, 'Lower', shape.triangleup, location.belowbar, color.green, size.small)
    if (lowerTag[i] === 1) {
      markers.push({ time: t(i), position: 'belowBar', shape: 'triangleUp', color: color.green, text: 'Lower',
        textColor: color.green, size: 'small' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills,
    markers,
  };
}

export const VolatilityBandCloudWithOverextensionSignals = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
