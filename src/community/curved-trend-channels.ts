/**
 * Curved Trend Channels (Zeiierman)
 *
 * A range threshold r = max(SMA(2.618 * MA(|MA(high) - MA(low[1])|), rLen) * bandMult, 0.0001), with MA the
 * selected smoothing (SMA, EMA, RMA, HMA, KAMA, VIDYA, FRAMA, Super Smoother). A step trend line follows the close:
 * when the close moves more than r away from it, the line jumps to the mean of the close and the line; otherwise it
 * steps by buffer / mult / slope in its direction. The buffer is reset to r when the direction changes; the bands
 * are the line +/- the buffer. In curved mode, the line restarts at the close when the close moves more than r
 * away, and otherwise grows by (baseStep + growth * bars since the restart) * ATR(14), at most 1.1 * ATR. The line
 * is teal in an up direction, red otherwise, with gradient fills to the bands. Optional candle colours: bull when a
 * slower step trend is up and the MA(close, 10), SMA(trend, 2) and SMA(trend, 4) all rise, bear for the opposite.
 *
 * Reference: "Curved Trend Channels (Zeiierman)" by Zeiierman
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Zeiierman
 */

import { ta, math, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';

export type CurvedTrendChannelsMaType = 'SMA' | 'EMA' | 'RMA' | 'HMA' | 'KAMA' | 'VIDYA' | 'FRAMA' | 'Super Smoother';

export interface CurvedTrendChannelsInputs {
  /** Scaled volatility length (SMA of the volatility) */
  rLen: number;
  /** Smoothing type of the range filter (and of the MA(close, 10) of the candle colours) */
  maType: CurvedTrendChannelsMaType;
  /** Volatility MA length */
  maLen: number;
  /** High / low smoother length */
  hiloLen: number;
  /** Band multiplier */
  bandMult: number;
  /** Slope of the regular trend channel */
  slope: number;
  /** Multiplicative factor of the regular trend channel */
  mult: number;
  /** Curved channel mode */
  useCurvedMode: boolean;
  /** Base step (x ATR) of the curved mode */
  baseStep: number;
  /** Growth per bar (x ATR) of the curved mode */
  boost: number;
  /** Candle colouring */
  showCandleColor: boolean;
  /** Candle trend length */
  candleLen: number;
  bullCandleColor: string;
  bearCandleColor: string;
  /** Gradient fills between the trend line and the bands */
  showArea: boolean;
  upperColor: string;
  lowerColor: string;
}

export const defaultInputs: CurvedTrendChannelsInputs = {
  rLen: 100,
  maType: 'SMA',
  maLen: 100,
  hiloLen: 100,
  bandMult: 1.8,
  slope: 25,
  mult: 2.0,
  useCurvedMode: false,
  baseStep: 0.05,
  boost: 0.001,
  showCandleColor: false,
  candleLen: 200,
  bullCandleColor: color.lime,
  bearCandleColor: color.red,
  showArea: true,
  upperColor: color.teal,
  lowerColor: color.red,
};

const MA_TYPES: CurvedTrendChannelsMaType[] = ['SMA', 'EMA', 'RMA', 'HMA', 'KAMA', 'VIDYA', 'FRAMA', 'Super Smoother'];

export const inputConfig: InputConfig[] = [
  { id: 'rLen', type: 'int', title: 'Scaled Volatility Length', defval: 100, min: 1, group: 'Range Filter' },
  { id: 'maType', type: 'string', title: 'Smoothing Type', defval: 'SMA', options: MA_TYPES, group: 'Range Filter' },
  { id: 'maLen', type: 'int', title: 'Volatility MA Length', defval: 100, min: 2, group: 'Range Filter' },
  { id: 'hiloLen', type: 'int', title: 'High/Low Smoother Length', defval: 100, min: 2, group: 'Range Filter' },
  { id: 'bandMult', type: 'float', title: 'Band Multiplier', defval: 1.8, min: 0.1, step: 0.1, group: 'Range Filter' },
  { id: 'slope', type: 'float', title: 'Slope', defval: 25, min: 0.1, group: 'Regular Trend Channel' },
  { id: 'mult', type: 'float', title: 'Multiplicative Factor', defval: 2.0, min: 0.1, step: 0.1, group: 'Regular Trend Channel' },
  { id: 'useCurvedMode', type: 'bool', title: 'Curved Channel Mode', defval: false, group: 'Curved Channel Mode' },
  { id: 'baseStep', type: 'float', title: 'Base Step (× ATR)', defval: 0.05, max: 0.3, step: 0.001, group: 'Curved Channel Mode' },
  { id: 'boost', type: 'float', title: 'Growth per Bar (× ATR)', defval: 0.001, min: 0, step: 0.001, group: 'Curved Channel Mode' },
  { id: 'showCandleColor', type: 'bool', title: 'Enable Candle Coloring', defval: false, group: 'Candle Coloring' },
  { id: 'candleLen', type: 'int', title: 'Candle Trend Length', defval: 200, min: 1, group: 'Candle Coloring' },
  { id: 'bullCandleColor', type: 'color', title: 'Bull Candle Color', defval: color.lime, group: 'Candle Coloring' },
  { id: 'bearCandleColor', type: 'color', title: 'Bear Candle Color', defval: color.red, group: 'Candle Coloring' },
  { id: 'showArea', type: 'bool', title: 'Show Gradient Fill', defval: true, group: 'Display & Style' },
  { id: 'upperColor', type: 'color', title: 'Trend Up Color', defval: color.teal, group: 'Display & Style' },
  { id: 'lowerColor', type: 'color', title: 'Trend Down Color', defval: color.red, group: 'Display & Style' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trend Line', color: color.teal, lineWidth: 2 },
  { id: 'plot1', title: 'Upper Band', color: 'transparent', lineWidth: 1 },
  { id: 'plot2', title: 'Lower Band', color: 'transparent', lineWidth: 1 },
];

export const metadata = {
  title: 'Curved Trend Channels (Zeiierman)',
  shortTitle: 'Curved Trend Channels (Zeiierman)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;
const nz = (x: number) => (isNaN(x) ? 0 : x);
/** Pine x / y: na when y is 0 */
const div = (x: number, y: number) => (y === 0 ? NaN : x / y);
const shift = (a: number[], k: number) => a.map((_v, i) => (i - k >= 0 ? a[i - k] : NaN));

export function calculate(
  bars: Bar[],
  inputs: Partial<CurvedTrendChannelsInputs> = {},
): IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const close = bars.map((b) => b.close);
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);

  /** Recursive filter: result := nz(result[1]) + alpha * (src - nz(result[1])) */
  const adaptive = (src: number[], alpha: number[]) => {
    const out: number[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const prev = i > 0 ? nz(out[i - 1]) : 0;
      out[i] = prev + alpha[i] * (src[i] - prev);
    }
    return out;
  };

  /** ma(src, len) of the script: one call of the selected smoothing (each call site has its own state) */
  const ma = (src: number[], len: number): number[] => {
    switch (cfg.maType) {
      case 'HMA': {
        // ta.wma(2 * ta.wma(src, len / 2) - ta.wma(src, len), math.round(math.sqrt(len)))
        const half = A(ta.wma(S(src), Math.trunc(len / 2)));
        const full = A(ta.wma(S(src), len));
        return A(ta.wma(S(half.map((h, i) => 2 * h - full[i])), Math.round(Math.sqrt(len))));
      }
      case 'KAMA': {
        const change = src.map((v, i) => Math.abs(v - (i > 0 ? src[i - 1] : NaN)));
        const volatility = A(math.sum(S(change), len) as Series);
        const fastSC = 2 / (2 + 1);
        const slowSC = 2 / (30 + 1);
        const sc = src.map((v, i) => {
          const direction = Math.abs(v - (i - len >= 0 ? src[i - len] : NaN));
          const er = div(direction, volatility[i]);
          return Math.pow(er * (fastSC - slowSC) + slowSC, 2);
        });
        return adaptive(src, sc);
      }
      case 'VIDYA': {
        const cmo = A(ta.cmo(S(src), len));
        return adaptive(src, cmo.map((c) => Math.abs(c) / 100));
      }
      case 'FRAMA': {
        const n3 = Math.round(len / 2);
        const hh = (a: number[], l: number) => A(ta.highest(S(a), l));
        const ll = (a: number[], l: number) => A(ta.lowest(S(a), l));
        const h1 = hh(high, n3);
        const l1 = ll(low, n3);
        const h2 = hh(shift(high, n3), n3);
        const l2 = ll(shift(low, n3), n3);
        const h3 = hh(high, len);
        const l3 = ll(low, len);
        const alpha = src.map((_v, i) => {
          const hl1 = h1[i] - l1[i];
          const hl2 = h2[i] - l2[i];
          const hl3 = h3[i] - l3[i];
          const dimen = (Math.log(hl1 + hl2) - Math.log(hl3)) / Math.log(2);
          const a = Math.exp(-4.6 * (dimen - 1));
          return Math.min(Math.max(a, 0.01), 1.0);
        });
        return adaptive(src, alpha);
      }
      case 'Super Smoother': {
        const a1 = Math.exp((-1.414 * 3.14159) / len);
        const b1 = 2 * a1 * Math.cos((1.414 * 3.14159) / len);
        const c2 = b1;
        const c3 = -a1 * a1;
        const c1 = 1 - c2 - c3;
        const out: number[] = new Array(n);
        for (let i = 0; i < n; i++) {
          out[i] = c1 * src[i] + c2 * nz(i > 0 ? out[i - 1] : NaN) + c3 * nz(i > 1 ? out[i - 2] : NaN);
        }
        return out;
      }
      case 'SMA':
        return A(ta.sma(S(src), len));
      case 'EMA':
        return A(ta.ema(S(src), len));
      default:
        return A(ta.rma(S(src), len));
    }
  };

  // f_rangeFilter(high, low, hilo_len, ma_len, r_len, band_mult); f_rangeFilter_cf is the same computation
  const highMa = ma(high, cfg.hiloLen);
  const lowMa = ma(shift(low, 1), cfg.hiloLen);
  const diff = highMa.map((h, i) => Math.abs(h - lowMa[i]));
  const vol = ma(diff, cfg.maLen).map((v) => 2.618 * v);
  const r = A(ta.sma(S(vol), cfg.rLen)).map((v) => Math.max(v * cfg.bandMult, 0.0001));

  /** f_hyperTrend / f_candleTrend (StepTrend) and f_candleTrend_cf (stepTrend_cf): same arithmetic */
  const stepTrend = (thr: number[], multFactor: number, stepLen: number) => {
    const line: number[] = new Array(n);
    const dir: number[] = new Array(n);
    const buff: number[] = new Array(n);
    let tLine = NaN; // var float tLine = na
    let tBuff = 0.0;
    let tDir = 1.0;
    for (let i = 0; i < n; i++) {
      const price = close[i];
      const threshold = thr[i];
      if (isNaN(tLine)) {
        tLine = price;
        tDir = 1.0;
        tBuff = threshold;
      } else {
        const prevValue = tLine;
        const prevDir = tDir;
        const prevBuff = tBuff;
        const jumped = gt(Math.abs(price - prevValue), threshold);
        let stepValue = jumped ? (price + prevValue) / 2 : prevValue;
        if (!jumped) {
          const stepDelta = prevBuff / multFactor / stepLen;
          stepValue = gt(prevDir, 0) ? prevValue + stepDelta : lt(prevDir, 0) ? prevValue - stepDelta : prevValue;
        }
        const newDir = gt(stepValue, prevValue) ? 1.0 : lt(stepValue, prevValue) ? -1.0 : 0.0;
        tBuff = ne(newDir, prevDir) ? threshold : prevBuff;
        tLine = stepValue;
        tDir = newDir;
      }
      line[i] = tLine;
      dir[i] = tDir;
      buff[i] = tBuff;
    }
    return { line, dir, buff };
  };

  /** f_curvedChannel_cf(close, rangeThresh_cf, baseStep_cf, boost_cf, 1) */
  const curvedChannel = (thr: number[]) => {
    const atr = A(ta.atr(bars, 14));
    const line: number[] = new Array(n);
    const dir: number[] = new Array(n);
    const buff: number[] = new Array(n);
    let tLine = NaN;
    let tBuff = 0.0;
    let tDir = 1.0;
    let barsCf = 0;
    for (let i = 0; i < n; i++) {
      const price = close[i];
      const threshold = thr[i];
      if (isNaN(tLine)) {
        tLine = price;
        tDir = 1.0;
        tBuff = threshold;
        barsCf = 0;
      } else {
        const prevTrend = tLine;
        const prevBuff = tBuff;
        const prevDir = tDir;
        const startLong = gt(price, prevTrend + threshold);
        const startShort = lt(price, prevTrend - threshold);
        if (startLong || startShort) {
          tLine = price;
          tDir = startLong ? 1.0 : -1.0;
          tBuff = threshold;
          barsCf = 1;
        } else {
          barsCf += 1;
          const rawStep = cfg.baseStep * atr[i] + cfg.boost * atr[i] * barsCf;
          const stepGrow = Math.min(rawStep, 1.1 * atr[i]);
          tLine = gt(prevDir, 0) ? prevTrend + stepGrow : lt(prevDir, 0) ? prevTrend - stepGrow : prevTrend;
          tBuff = prevBuff;
        }
        // if not na(tLine_cf[1]): always true here (tLine_cf was not na at the start of the bar)
        tDir = gt(tLine, prevTrend) ? 1.0 : lt(tLine, prevTrend) ? -1.0 : 0.0;
        if (ne(tDir, prevDir)) tBuff = threshold;
      }
      line[i] = tLine;
      dir[i] = tDir;
      buff[i] = tBuff;
    }
    return { line, dir, buff };
  };

  const curved = cfg.useCurvedMode;
  // Candle trend (regular: StepTrend with mult; curved: stepTrend_cf with factor 1), length candlelen
  const candleTrend = stepTrend(r, curved ? 1 : cfg.mult, cfg.candleLen);
  const trendMedium = A(ta.sma(S(candleTrend.line), 2));
  const trendLong = A(ta.sma(S(candleTrend.line), 4));
  const srcMa = ma(close, 10);
  const channel = curved ? curvedChannel(r) : stepTrend(r, cfg.mult, cfg.slope);
  const tLine = channel.line;
  const upper = channel.line.map((v, i) => v + channel.buff[i]);
  const lower = channel.line.map((v, i) => v - channel.buff[i]);

  const neutral = String(color.new(color.gray, 85));
  const plot0: { time: number; value: number; color: string }[] = [];
  const plot1: { time: number; value: number }[] = [];
  const plot2: { time: number; value: number }[] = [];
  const candles: PlotCandleData[] = [];
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    plot0.push({ time: t, value: tLine[i], color: channel.dir[i] === 1 ? cfg.upperColor : cfg.lowerColor });
    plot1.push({ time: t, value: cfg.showArea ? upper[i] : NaN });
    plot2.push({ time: t, value: cfg.showArea ? lower[i] : NaN });
    // f_candleColor(cDir, src_ma, TrendMedium_candle, TrendLong_candle, bull, bear)
    const p = i > 0 ? i - 1 : -1;
    const at = (a: number[]) => (p >= 0 ? a[p] : NaN);
    const cDir = candleTrend.dir[i];
    const isBull = cDir === 1 && gt(srcMa[i], at(srcMa)) && gt(trendMedium[i], at(trendMedium)) && gt(trendLong[i], at(trendLong));
    const isBear = cDir === -1 && lt(srcMa[i], at(srcMa)) && lt(trendMedium[i], at(trendMedium)) && lt(trendLong[i], at(trendLong));
    const c = cfg.showCandleColor ? (isBull ? cfg.bullCandleColor : isBear ? cfg.bearCandleColor : neutral) : 'transparent';
    const b = bars[i];
    candles.push({ time: t, open: b.open, high: b.high, low: b.low, close: b.close, color: c, wickColor: c, borderColor: c });
  }

  const upperFill = cfg.showArea ? String(color.new(cfg.upperColor, 60)) : null;
  const lowerFill = cfg.showArea ? String(color.new(cfg.lowerColor, 60)) : null;
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2 },
    fills: [
      // fill(plotUpper, plotMid, upper_final, tLine_final, showArea ? color.new(upper_col, 60) : na, na)
      { plot1: 'plot1', plot2: 'plot0', gradient: { topValue: upper, bottomValue: tLine,
        topColor: new Array(n).fill(upperFill), bottomColor: new Array(n).fill(null) } },
      // fill(plotLower, plotMid, lower_final, tLine_final, showArea ? color.new(lower_col, 60) : na, na)
      { plot1: 'plot2', plot2: 'plot0', gradient: { topValue: lower, bottomValue: tLine,
        topColor: new Array(n).fill(lowerFill), bottomColor: new Array(n).fill(null) } },
    ],
    // plotcandle(open, high, low, close, color / wickcolor / bordercolor = showCandleColor ? candleColor_final : na)
    plotCandles: { PlotCandle: candles },
  };
}

export const CurvedTrendChannels = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
