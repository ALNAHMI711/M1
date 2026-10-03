/**
 * Fast WMA
 *
 * WMA of the source with an upper band (WMA * upper weight) and a lower band (WMA * lower weight), the source +-
 * its standard deviation, and the normalised WMA nwma = source / WMA(source, length) - 1. The signal turns long
 * when source - stdev is above the upper band and nwma is above the long threshold, short when source + stdev is
 * below the lower band and nwma is below the short threshold, and else keeps its value. The signal sets the colour
 * of the nwma line (in the pane), of the WMA lines, of the optional source bands and fills and of the candles (on
 * the price pane). Triangles one bar after a change of signal mark the new long / short state.
 *
 * Reference: "Fast WMA" by Clokivez
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Clokivez
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';
import { barInterval, barTime } from '../bar-time';

export type FastWmaColorType = 'Trend' | 'ETHBTC' | 'SOLETH' | 'SOLBTC';

export interface FastWmaInputs {
  /** Colour scheme */
  coltype: FastWmaColorType;
  /** Colour the candles */
  bc: boolean;
  /** Draw the source +- stdev lines and the fills */
  pl: boolean;
  /** Source */
  wmasrc: SourceType;
  /** Length of the standard deviation of the source */
  wmasrclen: number;
  /** WMA length */
  wmalen: number;
  /** Upper band = WMA * this weight */
  wwl: number;
  /** Lower band = WMA * this weight */
  wws: number;
  /** Length of the WMA of the normalised WMA */
  nwmalen: number;
  /** Long threshold of the normalised WMA */
  lt: number;
  /** Short threshold of the normalised WMA */
  st: number;
}

export const defaultInputs: FastWmaInputs = {
  coltype: 'ETHBTC',
  bc: true,
  pl: false,
  wmasrc: 'close',
  wmasrclen: 13,
  wmalen: 10,
  wwl: 1.016,
  wws: 1.05,
  nwmalen: 26,
  lt: 0.03,
  st: 0.032,
};

export const inputConfig: InputConfig[] = [
  { id: 'coltype', type: 'string', title: 'Color Type', defval: 'ETHBTC', options: ['Trend', 'ETHBTC', 'SOLETH', 'SOLBTC'], group: 'Plots' },
  { id: 'bc', type: 'bool', title: 'Bar Color', defval: true, group: 'Plots' },
  { id: 'pl', type: 'bool', title: 'Plot Logic', defval: false, group: 'Plots' },
  { id: 'wmasrc', type: 'source', title: 'Source', defval: 'close', group: 'WMA' },
  { id: 'wmasrclen', type: 'int', title: 'Source Length', defval: 13, group: 'WMA' },
  { id: 'wmalen', type: 'int', title: 'WMA Length', defval: 10, group: 'WMA' },
  { id: 'wwl', type: 'float', title: 'WMA Upper Weight', defval: 1.016, step: 0.002, group: 'WMA' },
  { id: 'wws', type: 'float', title: 'WMA Lower Weight', defval: 1.05, step: 0.002, group: 'WMA' },
  { id: 'nwmalen', type: 'int', title: 'Length', defval: 26, group: 'NWMA' },
  { id: 'lt', type: 'float', title: 'Long Threshold', defval: 0.03, step: 0.005, group: 'NWMA' },
  { id: 'st', type: 'float', title: 'Short Threshold', defval: 0.032, step: 0.005, group: 'NWMA' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'NMA', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'WMA', color: color.blue, lineWidth: 3, forceOverlay: true },
  { id: 'plot2', title: 'Upper Band', color: color.blue, lineWidth: 1, forceOverlay: true },
  { id: 'plot3', title: 'Lower Band', color: color.blue, lineWidth: 1, forceOverlay: true },
  { id: 'plot4', title: 'Upper Source SD', color: color.blue, lineWidth: 1, forceOverlay: true },
  { id: 'plot5', title: 'Lower Source SD', color: color.blue, lineWidth: 1, forceOverlay: true },
];

export const metadata = {
  title: 'Fast WMA',
  shortTitle: 'WMA',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

const COLOURS: Record<FastWmaColorType, [string, string]> = {
  Trend: [color.lime, color.red],
  ETHBTC: [color.yellow, color.blue],
  SOLETH: [color.green, color.yellow],
  SOLBTC: [color.green, color.blue],
};

type Point = { time: number; value: number; color: string };

export function calculate(
  bars: Bar[],
  inputs: Partial<FastWmaInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  const srcSeries = getSourceSeries(bars, cfg.wmasrc);
  const src = A(srcSeries);
  const wma = A(ta.wma(srcSeries, cfg.wmalen));
  const wcd = A(ta.stdev(srcSeries, cfg.wmasrclen));
  const wmaN = A(ta.wma(srcSeries, cfg.nwmalen));

  const [upCol, downCol] = COLOURS[cfg.coltype] ?? COLOURS.ETHBTC;
  const wmah: number[] = new Array(n);
  const wmal: number[] = new Array(n);
  const wcsdh: number[] = new Array(n);
  const wcsdl: number[] = new Array(n);
  const nwma: number[] = new Array(n);
  const signal: number[] = new Array(n);
  const col: string[] = new Array(n);
  let prevSignal = NaN; // Signal[1]: na on bar 0
  for (let i = 0; i < n; i++) {
    wmah[i] = wma[i] * cfg.wwl;
    wmal[i] = wma[i] * cfg.wws;
    wcsdh[i] = src[i] + wcd[i];
    wcsdl[i] = src[i] - wcd[i];
    // plain division: x / 0 is +-infinity (the comparisons use it, the plot shows na)
    nwma[i] = src[i] / wmaN[i] - 1;
    const long = gt(wcsdl[i], wmah[i]) && gt(nwma[i], cfg.lt);
    const short = lt(wcsdh[i], wmal[i]) && lt(nwma[i], cfg.st);
    // Signal := Long ? 1 : Short ? -1 : Signal[1]
    signal[i] = long ? 1 : short ? -1 : prevSignal;
    prevSignal = signal[i];
    col[i] = gt(signal[i], 0) ? upCol : downCol;
  }

  const t = (i: number) => bars[i].time;
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const line = (vals: number[], c: (i: number) => string): Point[] =>
    bars.map((_b, i) => ({ time: t(i), value: fin(vals[i]), color: c(i) }));
  const lineCol = (i: number) => col[i];
  const sdCol = (i: number) => (cfg.pl ? col[i] : 'transparent');

  // fill(wmalplot, wmahplot, pl ? color.new(col, 80) : na); fill(sdhplot, sdlplot, pl ? color.new(col, 95) : na)
  const fillCols = (tr: number) => bars.map((_b, i) => (cfg.pl ? String(color.new(col[i], tr)) : 'transparent'));

  // plotcandle(open, high, low, close, "Bar Color", bcol, bcol, bordercolor = bcol, force_overlay = true)
  const candles: PlotCandleData[] = bars.map((b, i) => {
    const c = cfg.bc ? col[i] : 'transparent';
    return { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, color: c, wickColor: c,
      borderColor: c, forceOverlay: true };
  });

  // plotshape(ta.crossover(Signal, 0), "Real Buy", shape.triangleup, location.belowbar, col, offset = 1, size.tiny)
  // plotshape(ta.crossunder(Signal, 0), "Real Sell", shape.triangledown, location.abovebar, col, offset = 1, size.tiny)
  const arrowL = ta.crossover(S(signal), 0).toArray();
  const arrowS = ta.crossunder(S(signal), 0).toArray();
  const interval = barInterval(bars);
  const markers: MarkerData[] = [];
  for (let i = 0; i < n; i++) {
    const time = barTime(bars, i + 1, interval);
    if (arrowL[i]) {
      markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: col[i], size: 'tiny', forceOverlay: true });
    }
    if (arrowS[i]) {
      markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: col[i], size: 'tiny', forceOverlay: true });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: line(nwma, lineCol),
      plot1: line(wma, lineCol),
      plot2: line(wmah, lineCol),
      plot3: line(wmal, lineCol),
      plot4: line(wcsdh, sdCol),
      plot5: line(wcsdl, sdCol),
    },
    hlines: [
      { value: cfg.lt, options: { title: 'Long Threshold', color: color.green, linestyle: 'dashed' } },
      { value: cfg.st, options: { title: 'Short Threshold', color: color.red, linestyle: 'dashed' } },
    ],
    fills: [
      { plot1: 'plot3', plot2: 'plot2', options: { title: 'Plots Background' }, colors: fillCols(80) },
      { plot1: 'plot4', plot2: 'plot5', options: { title: 'Plots Background' }, colors: fillCols(95) },
    ],
    markers,
    plotCandles: { barColor: candles },
  };
}

export const FastWma = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
