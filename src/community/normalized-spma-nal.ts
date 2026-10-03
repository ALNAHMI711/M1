/**
 * Normalized SPMA | NAL
 *
 * SPMA: the percent rank of the one-bar change of the close over a lookback gates an EMA of the close; the line takes
 * the EMA value only on bars where the rank is above the gate and holds its previous value on other bars. The
 * normalized SPMA is -SPMA / close (about -1), and the lower line is the normalized SPMA minus its standard deviation.
 * The state is long when the lower line is above -1, short when the normalized SPMA is below -1, and kept otherwise.
 * The candles (on the price pane) and the bars take the state colour.
 *
 * Reference: "Normalized SPMA | NAL" by NordicAlphaLab
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © NordicAlphaLab
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, PlotCandleData } from '../types';

export interface NormalizedSpmaNalInputs {
  /** Colour set: 'Standard', 'Nordic' or 'Simple' */
  colMode: 'Standard' | 'Nordic' | 'Simple';
  /** Number of bars used to rank the one-bar change */
  lookback: number;
  /** Minimum percent rank for the SPMA to update */
  gate: number;
  /** EMA length of the SPMA */
  normLength: number;
  /** Standard deviation length */
  normSDLen: number;
}

export const defaultInputs: NormalizedSpmaNalInputs = {
  colMode: 'Standard',
  lookback: 50,
  gate: 50,
  normLength: 20,
  normSDLen: 30,
};

export const inputConfig: InputConfig[] = [
  { id: 'colMode', type: 'string', title: 'Color Mode', defval: 'Standard', options: ['Standard', 'Nordic', 'Simple'], group: 'Visuals' },
  {
    id: 'lookback', type: 'int', title: 'Percentrank Lookback', defval: 50, min: 2, group: 'Normalized SPMA',
    tooltip: 'Number of historical bars used to rank the current returns.',
  },
  {
    id: 'gate', type: 'int', title: '% Gate', defval: 50, min: 0, max: 99, group: 'Normalized SPMA',
    tooltip: 'Minimum percentile rank required for the SPMA to update.',
  },
  { id: 'normLength', type: 'int', title: 'Normalized SPMA Length', defval: 20, min: 1, group: 'Normalized SPMA' },
  { id: 'normSDLen', type: 'int', title: 'Normalized SD Length', defval: 30, min: 2, group: 'Normalized SPMA' },
];

const STANDARD_UP = String(color.rgb(0, 255, 200));
const MIDLINE_COL = String(color.new(color.white, 50));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Normalized SPMA', color: color.gray, lineWidth: 1 },
  { id: 'plot1', title: 'Normalized SPMA Lower SD', color: color.gray, lineWidth: 1 },
];

export const metadata = {
  title: 'Normalized SPMA | NAL',
  shortTitle: 'Normalized SPMA',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; a != b when |a - b| > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<NormalizedSpmaNalInputs> = {},
): IndicatorResult & { barColors: BarColorData[]; plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  const [colUp, colDn, colNu] = cfg.colMode === 'Nordic'
    ? [String(color.rgb(0, 96, 175)), String(color.rgb(150, 154, 169)), color.gray]
    : cfg.colMode === 'Simple'
      ? [color.lime, color.red, color.gray]
      : [STANDARD_UP, String(color.rgb(32, 94, 144)), color.gray];

  // f_SPMA: Ret = close - close[1]; Per = ta.percentrank(Ret, lookback); Gate = Per > gate; ta.ema(close, length)
  const ret = bars.map((b, i) => (i > 0 ? b.close - bars[i - 1].close : NaN));
  const per = A(ta.percentrank(S(ret), cfg.lookback));
  const ema = A(ta.ema(S(bars.map((b) => b.close)), cfg.normLength));
  const spma: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    // MA := na(MA[1]) ? emaValue : Gate ? emaValue : MA[1]
    const prev = i > 0 ? spma[i - 1] : NaN;
    spma[i] = isNaN(prev) ? ema[i] : gt(per[i], cfg.gate) ? ema[i] : prev;
  }

  // normalizedSPMA = close != 0.0 ? -SPMA / close : na
  const norm = bars.map((b, i) => (ne(b.close, 0) ? -spma[i] / b.close : NaN));
  const sd = A(ta.stdev(S(norm), cfg.normSDLen));
  const lower = norm.map((v, i) => v - sd[i]);

  const plot0: { time: number; value: number; color: string }[] = [];
  const plot1: { time: number; value: number; color: string }[] = [];
  const candles: PlotCandleData[] = [];
  const barColors: BarColorData[] = [];
  let nal = 0; // var int NAL = 0
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const long = gt(lower[i], -1.0);
    const short = lt(norm[i], -1.0);
    // NAL := Long ? 1 : Short ? -1 : nz(NAL[1], 0)
    nal = long ? 1 : short ? -1 : nal;
    const col = nal === 1 ? colUp : nal === -1 ? colDn : colNu;
    plot0.push({ time: b.time, value: Number.isFinite(norm[i]) ? norm[i] : NaN, color: short ? colDn : colNu });
    plot1.push({ time: b.time, value: Number.isFinite(lower[i]) ? lower[i] : NaN, color: long ? colUp : colNu });
    // plotcandle(open, high, low, close, "Candles", color = col, wickcolor = col, bordercolor = col,
    //            display = display.pane, force_overlay = true)
    candles.push({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close,
      color: col, wickColor: col, borderColor: col, forceOverlay: true });
    // barcolor(col)
    barColors.push({ time: b.time, color: col });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1 },
    hlines: [{ value: -1.0, options: { title: 'Normalized Midline', color: MIDLINE_COL, linestyle: 'dashed' } }],
    plotCandles: { candles },
    barColors,
  };
}

export const NormalizedSpmaNal = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
