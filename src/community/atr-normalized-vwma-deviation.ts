/**
 * ATR-Normalized VWMA Deviation (ANVD)
 *
 * dev = (ohlc4 - VWMA(ohlc4, vwmaLen)) / ATR(atrLen). A sell setup is a dev above the upper band that is a new
 * `lookback` high of dev while the high is a new `lookback` high of price (and, with the MAD filter, dev above
 * MAD * multiplier, MAD = SMA of |dev - SMA(dev)|); the buy setup is the mirror. A setup on this bar or on the bar
 * before, with a down (sell) / up (buy) candle on this bar, colours the background. Horizontal lines at 0 and at the
 * bands, with a fill between the bands.
 *
 * Reference: "ATR-Normalized VWMA Deviation" by exploretranspose
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';

export interface ATRNormalizedVWMADeviationInputs {
  /** Lookback of the extremes (and of the MAD averages) */
  lookback: number;
  /** ATR length */
  atrLen: number;
  /** VWMA length */
  vwmaLen: number;
  /** Upper deviation band */
  upperBand: number;
  /** Lower deviation band */
  lowerBand: number;
  /** Use the MAD filter */
  useMad: boolean;
  /** MAD multiplier */
  madMult: number;
}

export const defaultInputs: ATRNormalizedVWMADeviationInputs = {
  lookback: 100,
  atrLen: 100,
  vwmaLen: 100,
  upperBand: 5.0,
  lowerBand: -5.0,
  useMad: false,
  madMult: 1.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'Lookback (extremes)', defval: 100, min: 10, group: 'Core Calculations' },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 100, min: 10, group: 'Core Calculations' },
  { id: 'vwmaLen', type: 'int', title: 'VWMA Length', defval: 100, min: 10, group: 'Core Calculations' },
  { id: 'upperBand', type: 'float', title: 'Upper Deviation Band', defval: 5.0, group: 'Signal Levels' },
  { id: 'lowerBand', type: 'float', title: 'Lower Deviation Band', defval: -5.0, group: 'Signal Levels' },
  { id: 'useMad', type: 'bool', title: 'Use MAD filter', defval: false, group: 'Optional Filters' },
  { id: 'madMult', type: 'float', title: 'MAD multiplier', defval: 1.0, step: 0.1, group: 'Optional Filters' },
];

const DEV_COL = String(color.new('#1C3738', 0));
const MAD_COL = String(color.new('#7D2E68', 0));
const SELL_BG = String(color.new('#F15156', 50));
const BUY_BG = String(color.new('#7FD1B9', 0));
const RANGE_FILL = String(color.new(color.blue, 95));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ATR-Normalized Deviation', color: DEV_COL, lineWidth: 1 },
  { id: 'plot1', title: 'MAD', color: MAD_COL, lineWidth: 1 },
];

/** hline(0) / hline(upper_band) / hline(lower_band) with the default levels (the result `hlines` carry the inputs) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, title: 'Zero', color: color.gray, linestyle: 'dashed' },
  { id: 'hline_upper', price: 5, title: 'Upper Band', color: color.gray, linestyle: 'dashed' },
  { id: 'hline_lower', price: -5, title: 'Lower Band', color: color.gray, linestyle: 'dashed' },
];

/** fill(h_up, h_dn, color.new(color.blue, 95)) */
export const fillConfig: FillConfig[] = [
  { id: 'fill_range', plot1: 'hline_upper', plot2: 'hline_lower', color: RANGE_FILL, title: 'Deviation Range' },
];

export const metadata = {
  title: 'ATR-Normalized VWMA Deviation',
  shortTitle: 'ANVD',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<ATRNormalizedVWMADeviationInputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  // The averages skip +-infinity like na (Pine): they get NaN
  const fin = (a: number[]) => a.map((v) => (Number.isFinite(v) ? v : NaN));

  const ohlc4 = bars.map((b) => (b.open + b.high + b.low + b.close) / 4);
  const vwma = A(ta.vwma(S(ohlc4), cfg.vwmaLen, S(bars.map((b) => b.volume ?? NaN))));
  const atr = A(ta.atr(bars, cfg.atrLen));
  // dev = (ohlc4 - vwma) / ta.atr(atr_len): a plain division (x / 0 is +-infinity, 0 / 0 na)
  const dev = bars.map((_b, i) => (ohlc4[i] - vwma[i]) / atr[i]);

  // Mean absolute deviation
  const devMean = A(ta.sma(S(fin(dev)), cfg.lookback));
  const mad = A(ta.sma(S(fin(dev.map((d, i) => Math.abs(d - devMean[i])))), cfg.lookback));

  // Extremes of the previous bar: ta.highest(x, lookback)[1]
  const hiDev = A(ta.highest(S(dev), cfg.lookback));
  const loDev = A(ta.lowest(S(dev), cfg.lookback));
  const hiHigh = A(ta.highest(S(bars.map((b) => b.high)), cfg.lookback));
  const loLow = A(ta.lowest(S(bars.map((b) => b.low)), cfg.lookback));

  const sellSetup: boolean[] = new Array(n).fill(false);
  const buySetup: boolean[] = new Array(n).fill(false);
  const bgColors: BgColorData[] = [];
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const isHighestDev = i > 0 && gt(dev[i], hiDev[i - 1]);
    const isLowestDev = i > 0 && lt(dev[i], loDev[i - 1]);
    const isHighestPrice = i > 0 && gt(b.high, hiHigh[i - 1]);
    const isLowestPrice = i > 0 && lt(b.low, loLow[i - 1]);
    const aboveUpper = gt(dev[i], cfg.upperBand);
    const belowLower = lt(dev[i], cfg.lowerBand);
    const madOkHigh = !cfg.useMad || gt(dev[i], mad[i] * cfg.madMult);
    const madOkLow = !cfg.useMad || lt(dev[i], -mad[i] * cfg.madMult);
    sellSetup[i] = isHighestDev && isHighestPrice && aboveUpper && madOkHigh;
    buySetup[i] = isLowestDev && isLowestPrice && belowLower && madOkLow;

    const downCandle = lt(b.close, b.open);
    const upCandle = gt(b.close, b.open);
    const sellSignal = (sellSetup[i] && downCandle) || (i > 0 && sellSetup[i - 1] && downCandle);
    const buySignal = (buySetup[i] && upCandle) || (i > 0 && buySetup[i - 1] && upCandle);
    // bgcolor(sell_signal ? color.new(#F15156, 50) : na); bgcolor(buy_signal ? color.new(#7FD1B9, 0) : na):
    // the later call is drawn on top
    if (buySignal) bgColors.push({ time: b.time, color: BUY_BG });
    else if (sellSignal) bgColors.push({ time: b.time, color: SELL_BG });
  }

  const finite = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      // plot(dev, 'ATR-Normalized Deviation', color.new(#1C3738, 0))
      plot0: bars.map((b, i) => ({ time: b.time, value: finite(dev[i]), color: DEV_COL })),
      // plot(use_mad ? mad : na, 'MAD', color.new(#7D2E68, 0))
      plot1: bars.map((b, i) => ({ time: b.time, value: cfg.useMad ? finite(mad[i]) : NaN, color: MAD_COL })),
    },
    hlines: [
      { value: 0, options: { title: 'Zero', color: color.gray, linestyle: 'dashed' } },
      { value: cfg.upperBand, options: { title: 'Upper Band', color: color.gray, linestyle: 'dashed' } },
      { value: cfg.lowerBand, options: { title: 'Lower Band', color: color.gray, linestyle: 'dashed' } },
    ],
    fills: [
      { plot1: 'hline_upper', plot2: 'hline_lower', options: { title: 'Deviation Range' },
        colors: new Array<string>(n).fill(RANGE_FILL) },
    ],
    bgColors,
  };
}

export const ATRNormalizedVWMADeviation = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
