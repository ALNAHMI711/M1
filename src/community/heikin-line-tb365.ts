/**
 * Heikin Line - TB365 (Moving Average Exponential)
 *
 * EMA of the source, drawn with an optional bar offset. An optional smoothing moving average of the EMA (SMA,
 * SMA + Bollinger Bands, EMA, RMA, WMA or VWMA); with "SMA + Bollinger Bands", bands at the SMA +- the standard
 * deviation of the EMA times a multiplier, with a fill between them.
 *
 * Reference: "Heikin Line - TB365" by tradebot_365
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type FillConfig, type Bar, type SourceType } from 'oakscriptjs';
import { barInterval, barTime } from '../bar-time';

type MaType = 'None' | 'SMA' | 'SMA + Bollinger Bands' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';

export interface HeikinLineTb365Inputs {
  /** EMA length */
  len: number;
  /** EMA source */
  src: SourceType;
  /** Plot offset of the EMA in bars */
  offset: number;
  /** Smoothing type */
  maType: MaType;
  /** Smoothing length */
  maLength: number;
  /** Bollinger Bands standard deviation multiplier */
  bbMult: number;
}

export const defaultInputs: HeikinLineTb365Inputs = {
  len: 9,
  src: 'close',
  offset: 0,
  maType: 'None',
  maLength: 14,
  bbMult: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Length', defval: 9, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0, min: -500, max: 500, display: 'data_window' },
  { id: 'maType', type: 'string', title: 'Type', defval: 'None', group: 'Smoothing', display: 'data_window',
    options: ['None', 'SMA', 'SMA + Bollinger Bands', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'] },
  { id: 'maLength', type: 'int', title: 'Length', defval: 14, group: 'Smoothing', display: 'data_window' },
  { id: 'bbMult', type: 'float', title: 'BB StdDev', defval: 2.0, min: 0.001, max: 50, step: 0.5, group: 'Smoothing',
    display: 'data_window', tooltip: "Only applies when 'SMA + Bollinger Bands' is selected. Determines the distance between the SMA and the bands." },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA', color: color.blue, lineWidth: 1 },
  // display = enableMA ? display.all : display.none (result.visibility.enableMA)
  { id: 'plot1', title: 'EMA-based MA', color: color.yellow, lineWidth: 1, visible: 'enableMA' },
  // display = isBB ? display.all : display.none (result.visibility.isBB)
  { id: 'plot2', title: 'Upper Bollinger Band', color: color.green, lineWidth: 1, visible: 'isBB' },
  { id: 'plot3', title: 'Lower Bollinger Band', color: color.green, lineWidth: 1, visible: 'isBB' },
];

const BB_FILL = String(color.new(color.green, 90));

/** fill(bbUpperBand, bbLowerBand, isBB ? color.new(color.green, 90) : na), shown with isBB */
export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot2', plot2: 'plot3', color: BB_FILL, title: 'Bollinger Bands Background Fill', visible: 'isBB' },
];

export const metadata = {
  title: 'Moving Average Exponential',
  shortTitle: 'EMA',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };

export function calculate(
  bars: Bar[],
  inputs: Partial<HeikinLineTb365Inputs> = {},
): IndicatorResult & { visibility: Record<string, boolean> } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  // out = ta.ema(src, len)
  const out = A(ta.ema(getSourceSeries(bars, cfg.src), cfg.len));
  const outS = S(out);

  // var enableMA / isBB: constant from the inputs
  const enableMA = cfg.maType !== 'None';
  const isBB = cfg.maType === 'SMA + Bollinger Bands';
  let ma = new Array<number>(n).fill(NaN);
  if (enableMA) {
    let maS: Series;
    switch (cfg.maType) {
      case 'EMA': maS = ta.ema(outS, cfg.maLength); break;
      case 'SMMA (RMA)': maS = ta.rma(outS, cfg.maLength); break;
      case 'WMA': maS = ta.wma(outS, cfg.maLength); break;
      case 'VWMA': maS = ta.vwma(outS, cfg.maLength, S(bars.map((b) => b.volume ?? NaN))); break;
      default: maS = ta.sma(outS, cfg.maLength); break;
    }
    ma = A(maS);
  }
  // smoothingStDev = isBB ? ta.stdev(out, maLengthInput) * bbMultInput : na
  const sd = isBB ? A(ta.stdev(outS, cfg.maLength)).map((v) => v * cfg.bbMult) : new Array<number>(n).fill(NaN);

  // plot(out, "EMA", color.blue, offset = offset): the value of bar i is drawn on bar i + offset
  const interval = barInterval(bars);
  const emaPlot: Point[] = [];
  for (let i = 0; i < n; i++) {
    const j = i + cfg.offset;
    if (j < 0) continue;
    emaPlot.push({ time: barTime(bars, j, interval), value: out[i], color: color.blue });
  }
  const line = (f: (i: number) => number, c: string): Point[] => bars.map((b, i) => ({ time: b.time, value: f(i), color: c }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: emaPlot,
      plot1: line((i) => ma[i], color.yellow),
      plot2: line((i) => ma[i] + sd[i], color.green),
      plot3: line((i) => ma[i] - sd[i], color.green),
    },
    fills: [
      // fill(bbUpperBand, bbLowerBand, color = isBB ? color.new(color.green, 90) : na, display = isBB ? all : none)
      { plot1: 'plot2', plot2: 'plot3', options: { title: 'Bollinger Bands Background Fill' },
        colors: new Array<string>(n).fill(isBB ? BB_FILL : 'transparent') },
    ],
    visibility: { enableMA, isBB },
  };
}

export const HeikinLineTb365 = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
};
