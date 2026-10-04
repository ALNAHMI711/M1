/**
 * E9 Bollinger Range
 *
 * EMA 20 and EMA 150 of the close, and Bollinger-type bands: a basis MA (SMA / EMA / RMA / WMA / VWMA) of the
 * source with four pairs of bands at basis +- stdev * 1 / 2 / 3 / 3.5. Optional trend bar colours (close above /
 * below the basis) and white triangles when the close crosses the basis.
 *
 * Reference: "E9 Bollinger Range" by E9XBT
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import { barInterval, barTime } from '../bar-time';

type BasisMaType = 'SMA' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';

export interface E9BollingerRangeInputs {
  /** Basis MA and standard deviation length */
  length: number;
  /** Basis MA type */
  maType: BasisMaType;
  src: SourceType;
  /** Plot offset of the basis and of the bands */
  offset: number;
  /** Colour the price bars by trend */
  showHB: boolean;
  colTrndUp: string;
  colTrndDn: string;
  /** Standard deviation multipliers of the four band pairs */
  mult: number;
  mult1: number;
  mult2: number;
  mult3: number;
}

export const defaultInputs: E9BollingerRangeInputs = {
  length: 40,
  maType: 'EMA',
  src: 'ohlc4',
  offset: 0,
  showHB: false,
  colTrndUp: '#97ff9c',
  colTrndDn: 'rgb(250, 86, 143)',
  mult: 1.0,
  mult1: 2.0,
  mult2: 3.0,
  mult3: 3.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 40, min: 1 },
  { id: 'maType', type: 'string', title: 'Basis MA Type', defval: 'EMA', options: ['SMA', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'] },
  { id: 'src', type: 'source', title: 'Source', defval: 'ohlc4' },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0, min: -500, max: 500 },
  { id: 'showHB', type: 'bool', title: 'Show Highlight Price Bars', defval: false },
  { id: 'colTrndUp', type: 'color', title: 'Trend Up', defval: '#97ff9c' },
  { id: 'colTrndDn', type: 'color', title: 'Trend Down', defval: 'rgb(250, 86, 143)' },
  { id: 'mult', type: 'float', title: 'StdDev Bands 1', defval: 1.0, min: 0.001, max: 50 },
  { id: 'mult1', type: 'float', title: 'StdDev Bands 2', defval: 2.0, min: 0.001, max: 50 },
  { id: 'mult2', type: 'float', title: 'StdDev Bands 3', defval: 3.0, min: 0.001, max: 50 },
  { id: 'mult3', type: 'float', title: 'StdDev Bands 4', defval: 3.5, min: 0.001, max: 50 },
];

const UPPER1 = String(color.rgb(246, 125, 135, 100));
const LOWER1 = String(color.rgb(165, 249, 135, 77));
const UPPER2 = String(color.rgb(246, 125, 135, 77));
const LOWER2 = String(color.rgb(165, 249, 135, 83));
const UPPER3 = '#f67d8723';
const LOWER3 = '#a5f98728';
const UPPER4 = '#f67d874a';
const LOWER4 = '#a5f98725';
const BASIS = String(color.rgb(255, 255, 255));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA1', color: '#6e65eb', lineWidth: 3 },
  { id: 'plot1', title: 'EMA2', color: color.red, lineWidth: 3 },
  { id: 'plot2', title: 'Basis', color: BASIS, lineWidth: 1 },
  { id: 'plot3', title: 'Upper', color: UPPER1, lineWidth: 1 },
  { id: 'plot4', title: 'Lower', color: LOWER1, lineWidth: 1 },
  { id: 'plot5', title: 'Upper', color: UPPER2, lineWidth: 1 },
  { id: 'plot6', title: 'Lower', color: LOWER2, lineWidth: 1 },
  { id: 'plot7', title: 'Upper', color: UPPER3, lineWidth: 1 },
  { id: 'plot8', title: 'Lower', color: LOWER3, lineWidth: 1 },
  { id: 'plot9', title: 'Upper', color: UPPER4, lineWidth: 2 },
  { id: 'plot10', title: 'Lower', color: LOWER4, lineWidth: 2 },
];

export const metadata = {
  title: 'E9 Bollinger Range',
  shortTitle: 'E9 BRange',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };

export function calculate(
  bars: Bar[],
  inputs: Partial<E9BollingerRangeInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const closeS = Series.fromArray(bars, bars.map((b) => b.close));

  const ema1 = A(ta.ema(closeS, 20));
  const ema2 = A(ta.ema(closeS, 150));

  const src = getSourceSeries(bars, cfg.src);
  let basisS: Series;
  switch (cfg.maType) {
    case 'SMA': basisS = ta.sma(src, cfg.length); break;
    case 'SMMA (RMA)': basisS = ta.rma(src, cfg.length); break;
    case 'WMA': basisS = ta.wma(src, cfg.length); break;
    case 'VWMA': basisS = ta.vwma(src, cfg.length, Series.fromArray(bars, bars.map((b) => b.volume ?? NaN))); break;
    default: basisS = ta.ema(src, cfg.length); break;
  }
  const basis = A(basisS);
  const sd = A(ta.stdev(src, cfg.length));
  const crossUp = A(ta.crossover(closeS, basisS));
  const crossDn = A(ta.crossunder(closeS, basisS));

  const t = (i: number) => bars[i].time;
  const interval = barInterval(bars);
  // plot(..., offset = offset): the value of bar i is drawn on bar i + offset (none before bar 0)
  const shifted = (vals: number[], col: string): Point[] => {
    const out: Point[] = [];
    for (let i = 0; i < n; i++) {
      const j = i + cfg.offset;
      if (j < 0) continue;
      out.push({ time: barTime(bars, j, interval), value: Number.isFinite(vals[i]) ? vals[i] : NaN, color: col });
    }
    return out;
  };
  const band = (m: number, sign: number) => basis.map((b, i) => b + sign * (m * sd[i]));

  const plots = {
    plot0: bars.map((_b, i) => ({ time: t(i), value: ema1[i], color: '#6e65eb' })),
    plot1: bars.map((_b, i) => ({ time: t(i), value: ema2[i], color: color.red })),
    plot2: shifted(basis, BASIS),
    plot3: shifted(band(cfg.mult, 1), UPPER1),
    plot4: shifted(band(cfg.mult, -1), LOWER1),
    plot5: shifted(band(cfg.mult1, 1), UPPER2),
    plot6: shifted(band(cfg.mult1, -1), LOWER2),
    plot7: shifted(band(cfg.mult2, 1), UPPER3),
    plot8: shifted(band(cfg.mult2, -1), LOWER3),
    plot9: shifted(band(cfg.mult3, 1), UPPER4),
    plot10: shifted(band(cfg.mult3, -1), LOWER4),
  };

  const barColors: BarColorData[] = [];
  const markers: MarkerData[] = [];
  for (let i = 0; i < n; i++) {
    // barcolor(show_HB ? (trend_up ? col_trnd_Up : trend_dn ? col_trnd_Dn : na) : na)
    if (cfg.showHB) {
      const c = bars[i].close;
      const col = gt(c, basis[i]) ? cfg.colTrndUp : lt(c, basis[i]) ? cfg.colTrndDn : null;
      if (col) barColors.push({ time: t(i), color: col });
    }
    if (crossUp[i]) markers.push({ time: t(i), position: 'belowBar', shape: 'triangleUp', color: color.white, size: 'tiny' });
    if (crossDn[i]) markers.push({ time: t(i), position: 'aboveBar', shape: 'triangleDown', color: color.white, size: 'tiny' });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    markers,
    barColors,
  };
}

export const E9BollingerRange = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
