/**
 * Trend Volatility Index (TVI)
 *
 * The TVI is the mean absolute difference (Gini mean difference) of four SMAs of the source (10, 20, 40, 70): the
 * average of the six pairwise distances. It is drawn as candles: open = previous TVI, close = TVI, high / low
 * extended to the TVI rounded up / down to the step factor, or as Heikin-Ashi candles of these values. Candles are
 * green when the close is above the open (of the plain or Heikin-Ashi candle, by the colour mode). ATR and the SMA
 * of the high-low range are drawn as areas for reference.
 *
 * Reference: "Trend Volatility Index (TVI)" by chikaharu
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';

export interface TrendVolatilityIndexInputs {
  /** Base price */
  src: SourceType;
  /** Step factor: the candle high / low reach the TVI rounded to this step */
  tickStep: number;
  /** Candle values: 'Candle' or 'Heikin-Ashi' */
  mode: string;
  /** Candle colour from the 'Candle' or 'Heikin-Ashi' values */
  colorMode: string;
  /** ATR length */
  atrLen: number;
  /** Length of the SMA of high - low */
  rangeLen: number;
}

export const defaultInputs: TrendVolatilityIndexInputs = {
  src: 'close',
  tickStep: 1.0,
  mode: 'Candle',
  colorMode: 'Candle',
  atrLen: 14,
  rangeLen: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Base Price', defval: 'close' },
  { id: 'tickStep', type: 'float', title: 'Step Factor', defval: 1.0 },
  { id: 'mode', type: 'string', title: 'mode', defval: 'Candle', options: ['Candle', 'Heikin-Ashi'] },
  { id: 'colorMode', type: 'string', title: 'colorMode', defval: 'Candle', options: ['Candle', 'Heikin-Ashi'] },
  { id: 'atrLen', type: 'int', title: 'ATR_len', defval: 14 },
  { id: 'rangeLen', type: 'int', title: 'Range_len', defval: 14 },
];

const ATR_COL = String(color.new(color.red, 70));
const RANGE_COL = String(color.new(color.black, 80));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ATR (28)', color: ATR_COL, lineWidth: 1, style: 'area' },
  { id: 'plot1', title: 'High-Low Range MA (28)', color: RANGE_COL, lineWidth: 1, style: 'area' },
];

export const metadata = {
  title: 'Trend Volatility Index (TVI)',
  shortTitle: 'Trend Volatility Index (TVI)',
  overlay: false,
};

/** Pine a > b: a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;
/** Pine x / y: na when y is 0 */
const div = (x: number, y: number) => (y === 0 ? NaN : x / y);

export function calculate(
  bars: Bar[],
  inputs: Partial<TrendVolatilityIndexInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const src = getSourceSeries(bars, cfg.src);

  const sma1 = A(ta.sma(src, 10));
  const sma4 = A(ta.sma(src, 20));
  const sma6 = A(ta.sma(src, 40));
  const sma9 = A(ta.sma(src, 70));
  const atr = A(ta.atr(bars, cfg.atrLen));
  const hlRange = A(ta.sma(Series.fromArray(bars, bars.map((b) => b.high - b.low)), cfg.rangeLen));

  const up = '#009076';
  const down = '#F8213D';
  const candles: PlotCandleData[] = [];
  const tvi: number[] = new Array(n);
  let haOp = NaN; // var float ha_op = na
  let haCl = NaN; // var float ha_cl = na
  for (let i = 0; i < n; i++) {
    // gini_mean_diff of the four SMAs (math.abs(math.pow(x, 1)))
    const d = [sma1[i] - sma4[i], sma1[i] - sma6[i], sma1[i] - sma9[i], sma4[i] - sma6[i], sma4[i] - sma9[i], sma6[i] - sma9[i]];
    const cl = d.reduce((acc, x) => acc + Math.abs(Math.pow(x, 1)), 0) / 6;
    tvi[i] = cl;
    const lowerTVI = Math.floor(div(cl, cfg.tickStep)) * cfg.tickStep;
    const upperTVI = Math.ceil(div(cl, cfg.tickStep)) * cfg.tickStep;
    const op = i > 0 ? tvi[i - 1] : NaN;
    const hi = Math.max(op, upperTVI, cl);
    const lo = Math.min(op, lowerTVI, cl);

    // if na(ha_op): initialise; else ha_op := (ha_op[1] + ha_cl[1]) / 2
    if (isNaN(haOp)) {
      haCl = (op + hi + lo + cl) / 4;
      haOp = (op + cl) / 2;
    } else {
      haOp = (haOp + haCl) / 2;
      haCl = (op + hi + lo + cl) / 4;
    }
    const haHi = Math.max(hi, haOp, haCl);
    const haLo = Math.min(lo, haOp, haCl);

    const candle = cfg.mode === 'Candle' ? [op, hi, lo, cl] : [haOp, haHi, haLo, haCl];
    const col = cfg.colorMode === 'Candle' ? (gt(cl, op) ? up : down) : gt(haCl, haOp) ? up : down;
    // plotcandle draws no candle when a value is na
    if (candle.every((v) => !isNaN(v))) {
      const [o, h, l, c] = candle;
      candles.push({ time: bars[i].time, open: o, high: h, low: l, close: c, color: col, wickColor: col, borderColor: col });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      // plot(atr, 'ATR (28)', color.new(color.red, 70), style = plot.style_area)
      plot0: bars.map((b, i) => ({ time: b.time, value: atr[i], color: ATR_COL })),
      // plot(hl_range, 'High-Low Range MA (28)', color.new(color.black, 80), style = plot.style_area)
      plot1: bars.map((b, i) => ({ time: b.time, value: hlRange[i], color: RANGE_COL })),
    },
    markers: [],
    plotCandles: { tviCandles: candles },
  };
}

export const TrendVolatilityIndex = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
