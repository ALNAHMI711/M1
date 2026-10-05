/**
 * Moving Average Candles
 *
 * Candles drawn from a moving average of each of open, high, low and close (same MA type and length for the four
 * prices). MA types: SMA, EMA, RMA, WMA, VWMA, HMA, T3 (six chained EMAs, factor 0.7), DEMA, TEMA, KAMA (efficiency
 * ratio of the 1-bar change over the sum of the last Length 1-bar changes, fast 2 / slow 30), ZLEMA (EMA of
 * src + (src - src[(Length - 1) / 2])), McGinley Dynamic and EPMA (src * alpha + sum of the Length - 1 previous
 * values * (1 - alpha) / (Length - 1)). The candle is green when the MA close >= the MA open, else red.
 *
 * Reference: "Moving Average Candles" by aleskxyz
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, math, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';

export interface MovingAverageCandlesInputs {
  /** 'SMA' | 'EMA' | 'RMA' | 'WMA' | 'VWMA' | 'HMA' | 'T3' | 'DEMA' | 'TEMA' | 'KAMA' | 'ZLEMA' | 'McGinley' | 'EPMA' */
  maType: string;
  maLength: number;
}

export const defaultInputs: MovingAverageCandlesInputs = {
  maType: 'SMA',
  maLength: 14,
};

export const inputConfig: InputConfig[] = [
  {
    id: 'maType', type: 'string', title: 'MA Type', defval: 'SMA',
    options: ['SMA', 'EMA', 'RMA', 'WMA', 'VWMA', 'HMA', 'T3', 'DEMA', 'TEMA', 'KAMA', 'ZLEMA', 'McGinley', 'EPMA'],
  },
  { id: 'maLength', type: 'int', title: 'MA Length', defval: 14, min: 1, max: 1000 },
];

// Only candles (plotcandle): no line plots
export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [
  { id: 'maCandles', title: 'MA Candles' },
];

export const metadata = {
  title: 'Moving Average Candles',
  shortTitle: 'MA Candles',
  overlay: true,
};

/** Pine float comparisons: a >= b unless b - a > 1e-10, a != b when |a - b| > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<MovingAverageCandlesInputs> = {},
): Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const len = cfg.maLength;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const volume = bars.map((b) => b.volume ?? NaN);
  const ema = (a: number[]) => A(ta.ema(S(a), len));

  const dema = (src: number[]): number[] => {
    const ema1 = ema(src);
    const ema2 = ema(ema1);
    return ema1.map((e1, i) => 2 * e1 - ema2[i]);
  };
  const tema = (src: number[]): number[] => {
    const ema1 = ema(src);
    const ema2 = ema(ema1);
    const ema3 = ema(ema2);
    return ema1.map((e1, i) => 3 * (e1 - ema2[i]) + ema3[i]);
  };
  const t3 = (src: number[]): number[] => {
    const xe1 = ema(src);
    const xe2 = ema(xe1);
    const xe3 = ema(xe2);
    const xe4 = ema(xe3);
    const xe5 = ema(xe4);
    const xe6 = ema(xe5);
    const b = 0.7;
    const c1 = -b * b * b;
    const c2 = 3 * b * b + 3 * b * b * b;
    const c3 = -6 * b * b - 3 * b - 3 * b * b * b;
    const c4 = 1 + 3 * b + b * b * b + 3 * b * b;
    return xe6.map((v6, i) => c1 * v6 + c2 * xe5[i] + c3 * xe4[i] + c4 * xe3[i]);
  };
  const kama = (src: number[]): number[] => {
    // mom = math.abs(ta.change(src)); volatility = math.sum(math.abs(ta.change(src)), len)
    const absChange = src.map((v, i) => (i > 0 ? Math.abs(v - src[i - 1]) : NaN));
    const volatility = A(math.sum(S(absChange), len) as Series);
    const fastSC = 2 / (2 + 1);
    const slowSC = 2 / (30 + 1);
    const out: number[] = new Array(n);
    let k = NaN; // var float kama (one per call)
    for (let i = 0; i < n; i++) {
      const er = ne(volatility[i], 0) ? absChange[i] / volatility[i] : 0;
      const sc = er * (fastSC - slowSC) + slowSC;
      const sc2 = sc * sc;
      k = isNaN(k) ? src[i] : k + sc2 * (src[i] - k);
      out[i] = k;
    }
    return out;
  };
  const zlema = (src: number[]): number[] => {
    // lag = (len - 1) / 2 (fractional in Pine v6), src[int(lag)]
    const lag = Math.trunc((len - 1) / 2);
    const x = src.map((v, i) => (i - lag >= 0 ? v + (v - src[i - lag]) : NaN));
    return ema(x);
  };
  const mcg = (src: number[]): number[] => {
    const out: number[] = new Array(n);
    let mg = NaN; // var float mg (one per call)
    for (let i = 0; i < n; i++) {
      // na(mg): Pine na() is also true for an infinite value
      mg = !Number.isFinite(mg) ? src[i] : mg + (src[i] - mg) / (len * math.pow(src[i] / mg, 4));
      out[i] = mg;
    }
    return out;
  };
  const epma = (src: number[]): number[] => {
    if (len - 1 <= 0) {
      throw new Error("Error on bar 0: Invalid value of the 'length' argument (0.0) in the 'sum' function. It must be > 0.");
    }
    const alpha = 2 / (len + 1);
    const src1 = src.map((_, i) => (i > 0 ? src[i - 1] : NaN));
    const sum = A(math.sum(S(src1), len - 1) as Series);
    return src.map((v, i) => v * alpha + (sum[i] * (1 - alpha)) / (len - 1));
  };

  const calcMa = (src: number[]): number[] => {
    switch (cfg.maType) {
      case 'SMA': return A(ta.sma(S(src), len));
      case 'EMA': return ema(src);
      case 'RMA': return A(ta.rma(S(src), len));
      case 'WMA': return A(ta.wma(S(src), len));
      case 'VWMA': return A(ta.vwma(S(src), len, S(volume)));
      case 'HMA':
        if (Math.floor(len / 2) < 1) {
          throw new Error("Error on bar 0: Invalid value of the 'length' argument (0.0) in the 'wma' function. It must be > 0.");
        }
        return A(ta.hma(S(src), len));
      case 'T3': return t3(src);
      case 'DEMA': return dema(src);
      case 'TEMA': return tema(src);
      case 'KAMA': return kama(src);
      case 'ZLEMA': return zlema(src);
      case 'McGinley': return mcg(src);
      case 'EPMA': return epma(src);
      default: return A(ta.sma(S(src), len));
    }
  };

  const open_ = calcMa(bars.map((b) => b.open));
  const high_ = calcMa(bars.map((b) => b.high));
  const low_ = calcMa(bars.map((b) => b.low));
  const close_ = calcMa(bars.map((b) => b.close));

  const candles: PlotCandleData[] = [];
  for (let i = 0; i < n; i++) {
    const o = open_[i];
    const h = high_[i];
    const l = low_[i];
    const c = close_[i];
    // plotcandle draws no candle when a value is na
    if (!Number.isFinite(o) || !Number.isFinite(h) || !Number.isFinite(l) || !Number.isFinite(c)) continue;
    const col = ge(c, o) ? color.green : color.red;
    candles.push({ time: bars[i].time as number, open: o, high: h, low: l, close: c, color: col, wickColor: col, borderColor: col });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    plotCandles: { maCandles: candles },
  };
}

export const MovingAverageCandles = { calculate, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig };
