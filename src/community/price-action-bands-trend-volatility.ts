/**
 * Price Action Bands | Trend & Volatility
 *
 * A trend baseline (moving average of the close, HMA 200 by default) and its EMA signal line, cyan when the baseline is
 * at or above the signal and orange below. Four bands: EMA(EMA(baseline, period) +- width * multiplier, band smoothing)
 * with the width the stdev of the baseline (or the ATR) and the inner / outer multipliers. Gradient fills run from each
 * band to the midline of its inner / outer pair, and a cyan / orange fill shows the trend state between the baseline
 * and the signal.
 *
 * Reference: "Price Action Bands | Trend & Volatility [RadixAlgo]" by RadixAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © radixalgo
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface PriceActionBandsTrendVolatilityInputs {
  /** Moving average type of the trend baseline */
  maType: 'SMA' | 'EMA' | 'HMA' | 'RMA' | 'WMA' | 'SWMA' | 'VWMA';
  /** Moving average period */
  maPeriod: number;
  /** EMA length of the trend signal line */
  trendSmoothing: number;
  /** Band width: ATR or stdev of the baseline */
  bandMethod: 'ATR' | 'Standard Deviation';
  atrPeriod: number;
  sdPeriod: number;
  /** EMA length of the bands */
  bandSmoothing: number;
  innerMult: number;
  outerMult: number;
}

export const defaultInputs: PriceActionBandsTrendVolatilityInputs = {
  maType: 'HMA',
  maPeriod: 200,
  trendSmoothing: 21,
  bandMethod: 'Standard Deviation',
  atrPeriod: 21,
  sdPeriod: 200,
  bandSmoothing: 200,
  innerMult: 2.5,
  outerMult: 3.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'Moving Average Type', defval: 'HMA', options: ['SMA', 'EMA', 'HMA', 'RMA', 'WMA', 'SWMA', 'VWMA'] },
  { id: 'maPeriod', type: 'int', title: 'Moving Average Period', defval: 200 },
  { id: 'trendSmoothing', type: 'int', title: 'Trend Smoothing Period', defval: 21 },
  { id: 'bandMethod', type: 'string', title: 'Band Method', defval: 'Standard Deviation', options: ['ATR', 'Standard Deviation'] },
  { id: 'atrPeriod', type: 'int', title: 'ATR Period', defval: 21 },
  { id: 'sdPeriod', type: 'int', title: 'Standard Deviation Period', defval: 200 },
  { id: 'bandSmoothing', type: 'int', title: 'Band Smoothing Period', defval: 200 },
  { id: 'innerMult', type: 'float', title: 'Inner Band Multiplier', defval: 2.5, step: 0.1 },
  { id: 'outerMult', type: 'float', title: 'Outer Band Multiplier', defval: 3.5, step: 0.1 },
];

const BULL = '#00e5ff';
const BEAR = '#ffae00';
const GREEN = '#39FF14';
const RED = '#ff0055';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trend Baseline', color: BULL, lineWidth: 2 },
  { id: 'plot1', title: 'Trend Signal', color: BULL, lineWidth: 2 },
  { id: 'plot2', title: 'Lower Inner Band', color: GREEN, lineWidth: 2 },
  { id: 'plot3', title: 'Lower Outer Band', color: GREEN, lineWidth: 2 },
  { id: 'plot4', title: 'Upper Inner Band', color: RED, lineWidth: 2 },
  { id: 'plot5', title: 'Upper Outer Band', color: RED, lineWidth: 2 },
  { id: 'plot6', title: 'Upper Band Midline', color: 'transparent', lineWidth: 1 },
  { id: 'plot7', title: 'Lower Band Midline', color: 'transparent', lineWidth: 1 },
];

export const metadata = {
  title: 'Price Action Bands | Trend & Volatility [RadixAlgo]',
  shortTitle: 'RadixAlgo | PAB',
  overlay: true,
};

/** Pine a >= b: not (b - a > 1e-10); na compares false */
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > 1e-10);

export function calculate(
  bars: Bar[],
  inputs: Partial<PriceActionBandsTrendVolatilityInputs> = {},
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const close = S(bars.map((b) => b.close));
  const MAP = cfg.maPeriod;

  // float Base = switch MAT (a constant input: the selected branch runs on every bar)
  let baseS: Series;
  switch (cfg.maType) {
    case 'SMA': baseS = ta.sma(close, MAP); break;
    case 'EMA': baseS = ta.ema(close, MAP); break;
    case 'HMA': baseS = ta.hma(close, MAP); break;
    case 'RMA': baseS = ta.rma(close, MAP); break;
    case 'WMA': baseS = ta.wma(close, MAP); break;
    case 'SWMA': baseS = ta.swma(close); break;
    case 'VWMA': baseS = ta.vwma(close, MAP, S(bars.map((b) => b.volume ?? NaN))); break;
    default: baseS = S(new Array(n).fill(NaN)); // no case matched: na
  }
  const base = A(baseS);
  const baseSeries = S(base);

  const atr = A(ta.atr(bars, cfg.atrPeriod));
  const sd = A(ta.stdev(baseSeries, cfg.sdPeriod));
  const width = cfg.bandMethod === 'Standard Deviation' ? sd : atr;
  const emaBase = A(ta.ema(baseSeries, MAP));
  const band = (sign: number, mult: number) =>
    A(ta.ema(S(emaBase.map((e, i) => e + sign * width[i] * mult)), cfg.bandSmoothing));
  const highUp = band(1, cfg.outerMult);
  const lowUp = band(1, cfg.innerMult);
  const highDown = band(-1, cfg.outerMult);
  const lowDown = band(-1, cfg.innerMult);
  const upAvg = lowUp.map((v, i) => (v + highUp[i]) / 2);
  const downAvg = lowDown.map((v, i) => (v + highDown[i]) / 2);

  const signal = A(ta.ema(baseSeries, cfg.trendSmoothing));
  // The Trend State fill compares with ta.ema(Base, 21) (a fixed length in the Pine script)
  const signal21 = A(ta.ema(baseSeries, 21));
  const trendColor = (i: number) => (ge(base[i], signal[i]) ? BULL : BEAR);

  const line = (vals: number[], c: string | ((i: number) => string)) =>
    bars.map((b, i) => ({ time: b.time, value: vals[i], color: typeof c === 'string' ? c : c(i) }));
  const gradient = (top: number[], bottom: number[], topColor: string, bottomColor: string) => ({
    topValue: top, bottomValue: bottom, topColor: new Array(n).fill(topColor), bottomColor: new Array(n).fill(bottomColor),
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: line(base, trendColor),
      plot1: line(signal, trendColor),
      plot2: line(lowDown, GREEN),
      plot3: line(highDown, GREEN),
      plot4: line(lowUp, RED),
      plot5: line(highUp, RED),
      plot6: line(upAvg, 'transparent'), // color = na
      plot7: line(downAvg, 'transparent'),
    },
    fills: [
      // fill(Lvl_High_Down, Lvl_Down_Avg, High_Down, math.avg(Low_Down, High_Down), #37ff1449, #37ff141a)
      { plot1: 'plot3', plot2: 'plot7', options: { title: 'Lower Outer Zone' },
        gradient: gradient(highDown, downAvg, '#37ff1449', '#37ff141a') },
      { plot1: 'plot2', plot2: 'plot7', options: { title: 'Lower Inner Zone' },
        gradient: gradient(lowDown, downAvg, '#37ff1449', '#37ff141a') },
      { plot1: 'plot5', plot2: 'plot6', options: { title: 'Upper Outer Zone' },
        gradient: gradient(highUp, upAvg, '#ff005565', '#ff005518') },
      { plot1: 'plot4', plot2: 'plot6', options: { title: 'Upper Inner Zone' },
        gradient: gradient(lowUp, upAvg, '#ff005565', '#ff005518') },
      // fill(BaseLine, BaseLine_MA, color = Base >= ta.ema(Base, 21) ? #00e5ff4f : #ffae0052)
      { plot1: 'plot0', plot2: 'plot1', options: { title: 'Trend State' },
        colors: bars.map((_b, i) => (ge(base[i], signal21[i]) ? '#00e5ff4f' : '#ffae0052')) },
    ],
  };
}

export const PriceActionBandsTrendVolatility = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
