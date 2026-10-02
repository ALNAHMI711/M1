/**
 * Buyers vs Sellers
 *
 * Over the last `length` bars, the bodies of the bullish bars (open < close) and of the bearish bars are summed apart,
 * converted to a percent of the ATR and averaged per bar. The average bullish move is drawn above zero, the average
 * bearish move below zero (both filled to the zero line), with an EMA of their sum (the net move). The directional
 * bias is the log of the ratio of the bullish to the bearish average; it colours the background (bullish above the
 * bullish threshold, bearish below the bearish threshold). The ATR and the bias are drawn as transparent lines (values
 * in the status line).
 *
 * Reference: "Buyers vs Sellers" by davorloncarpetrovic
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © davorloncarpetrovic
 */

import { ta, Series, math, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';

export interface BuyersVsSellersInputs {
  /** Number of bars in the sums */
  length: number;
  /** ATR length (normalisation of the price changes) */
  atrlength: number;
  /** Bullish bias threshold */
  bullishtreshold: number;
  /** Bearish bias threshold */
  bearishtreshold: number;
  /** EMA length of the net move */
  netmovelength: number;
}

export const defaultInputs: BuyersVsSellersInputs = {
  length: 6,
  atrlength: 288,
  bullishtreshold: 0.0,
  bearishtreshold: 0.0,
  netmovelength: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Number of Bars To Include In The Calculation', defval: 6, group: 'Size of The Data Sample' },
  { id: 'atrlength', type: 'int', title: 'Length of The ATR', defval: 288,
    group: 'Length of The ATR Used For Normalization of The Price Changes' },
  { id: 'bullishtreshold', type: 'float', title: 'Bullish Bias Threshold', defval: 0.0, group: 'Threshold For The Directional Bias' },
  { id: 'bearishtreshold', type: 'float', title: 'Bearish Bias Threshold', defval: 0.0, group: 'Threshold For The Directional Bias' },
  { id: 'netmovelength', type: 'int', title: 'Net Move Average Length', defval: 3,
    group: 'The Average of The Sum of Bullish & Bearish Moves' },
];

const INVISIBLE = String(color.new(color.white, 100));
const BIAS_BULL = String(color.new('#22ab94', 100));
const BIAS_BEAR = String(color.new('#f7525f', 100));
const BULL_FILL = String(color.new('#1848cc', 40));
const BEAR_FILL = String(color.new('#c2185b', 40));
const BULL_BG = String(color.new('#1848cc', 80));
const BEAR_BG = String(color.new('#c2185b', 80));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ATR - Normalization of Price Movements', color: INVISIBLE, lineWidth: 1 },
  { id: 'plot1', title: 'Directional Bias', color: INVISIBLE, lineWidth: 1 },
  { id: 'plot2', title: 'Zero Line', color: color.gray, lineWidth: 1 },
  { id: 'plot3', title: 'Average Bullish Move', color: '#3179f5', lineWidth: 1 },
  { id: 'plot4', title: 'Average Bearish Move', color: '#ec407a', lineWidth: 1 },
  { id: 'plot5', title: 'The Sum of Bullish & Bearish Moves', color: '#d58a0a', lineWidth: 1 },
];

export const metadata = {
  title: 'Buyers vs Sellers',
  shortTitle: 'Buyers vs Sellers',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

export function calculate(
  bars: Bar[],
  inputs: Partial<BuyersVsSellersInputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, bullishtreshold, bearishtreshold } = cfg;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  const atr = A(ta.atr(bars, cfg.atrlength));

  const bullishaverage: number[] = new Array(n);
  const bearishaverage: number[] = new Array(n);
  const netmove: number[] = new Array(n);
  const bias: number[] = new Array(n);
  for (let k = 0; k < n; k++) {
    let bullishsum = 0.0;
    let bearishsum = 0.0;
    for (let i = 0; i <= length - 1; i++) {
      // open[i] - close[i]: na before the first bar; `na < 0` is false, so an na difference goes to the bearish sum
      const difference = k - i >= 0 ? bars[k - i].open - bars[k - i].close : NaN;
      if (lt(difference, 0)) bullishsum = bullishsum + difference;
      else bearishsum = bearishsum + difference;
    }
    const bullishsumcorrect = bullishsum * -1;
    const bearishsumcorrect = bearishsum * -1;
    // plain divisions: x / 0 is +-infinity, 0 / 0 is na (Pine)
    const bullishatr = bullishsumcorrect / (atr[k] / 100);
    const bearishatr = bearishsumcorrect / (atr[k] / 100);
    bullishaverage[k] = bullishatr / length;
    bearishaverage[k] = bearishatr / length;
    const bearishaveragepositive = bearishaverage[k] * -1;
    netmove[k] = bullishaverage[k] + bearishaverage[k];
    bias[k] = math.log(bullishaverage[k] / bearishaveragepositive) as number;
  }
  const netmoveaverage = A(ta.ema(Series.fromArray(bars, netmove), cfg.netmovelength));

  const plot0 = [];
  const plot1 = [];
  const plot2 = [];
  const plot3 = [];
  const plot4 = [];
  const plot5 = [];
  const bgColors: BgColorData[] = [];
  for (let i = 0; i < n; i++) {
    const time = bars[i].time;
    const bullishbias = gt(bias[i], bullishtreshold);
    const bearishbias = lt(bias[i], bearishtreshold);
    plot0.push({ time, value: fin(atr[i]), color: INVISIBLE });
    plot1.push({ time, value: fin(bias[i]), color: bullishbias ? BIAS_BULL : bearishbias ? BIAS_BEAR : INVISIBLE });
    plot2.push({ time, value: 0, color: color.gray });
    plot3.push({ time, value: fin(bullishaverage[i]), color: '#3179f5' });
    plot4.push({ time, value: fin(bearishaverage[i]), color: '#ec407a' });
    plot5.push({ time, value: fin(netmoveaverage[i]), color: '#d58a0a' });
    // bgcolor(bullishbias ? color.new(#1848cc, 80) : bearishbias ? color.new(#c2185b, 80) : color.new(color.white, 100))
    bgColors.push({ time, color: bullishbias ? BULL_BG : bearishbias ? BEAR_BG : INVISIBLE });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2, plot3, plot4, plot5 },
    fills: [
      { plot1: 'plot2', plot2: 'plot3', options: { title: 'Bullish Move Fill', color: BULL_FILL } },
      { plot1: 'plot2', plot2: 'plot4', options: { title: 'Bearish Move Fill', color: BEAR_FILL } },
    ],
    bgColors,
  };
}

export const BuyersVsSellers = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
