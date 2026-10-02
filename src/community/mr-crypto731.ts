/**
 * Enhanced MACD with Strong Buy/Sell Signals
 *
 * MACD of the close (EMA(fast) - EMA(slow)), its EMA signal line and the histogram MACD - signal. A strong buy is a
 * crossover of the MACD over the signal line while the MACD is above 0; a strong sell is a crossunder while the MACD
 * is below 0. Each signal draws a triangle at the bottom / top of the pane and a background colour.
 *
 * Reference: "Enhanced MACD with Strong Buy/Sell Signals" by Ali_Smith
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Ali_Smith
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';

export interface MrCrypto731Inputs {
  fastLength: number;
  slowLength: number;
  signalSmoothing: number;
}

export const defaultInputs: MrCrypto731Inputs = {
  fastLength: 12,
  slowLength: 26,
  signalSmoothing: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'MACD Fast Length', defval: 12 },
  { id: 'slowLength', type: 'int', title: 'MACD Slow Length', defval: 26 },
  { id: 'signalSmoothing', type: 'int', title: 'MACD Signal Smoothing', defval: 9 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MACD Line', color: color.green, lineWidth: 2 },
  { id: 'plot1', title: 'Signal Line', color: color.red, lineWidth: 1 },
  { id: 'plot2', title: 'MACD Histogram', color: color.gray, lineWidth: 1, style: 'histogram' },
];

export const metadata = {
  title: 'Enhanced MACD with Strong Buy/Sell Signals',
  shortTitle: 'MACD Signals',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<MrCrypto731Inputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const close = Series.fromArray(bars, bars.map((b) => b.close));

  const [macdS, signalS] = ta.macd(close, cfg.fastLength, cfg.slowLength, cfg.signalSmoothing);
  const macdLine = A(macdS);
  const signalLine = A(signalS);
  const histogram = macdLine.map((m, i) => m - signalLine[i]);

  // ta.crossover / ta.crossunder compare exactly (a tie on the previous bar counts; na compares false)
  const crossover = (i: number) => i > 0 && macdLine[i] > signalLine[i] && macdLine[i - 1] <= signalLine[i - 1];
  const crossunder = (i: number) => i > 0 && macdLine[i] < signalLine[i] && macdLine[i - 1] >= signalLine[i - 1];

  const markers: MarkerData[] = [];
  const bgColors: BgColorData[] = [];
  const buyBg = String(color.new(color.lime, 80));
  const sellBg = String(color.new(color.red, 80));
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    const strongBuy = crossover(i) && gt(macdLine[i], 0);
    const strongSell = crossunder(i) && lt(macdLine[i], 0);
    // plotshape(strongBuySignal, location.bottom, color.lime, shape.triangleup, size.small, text = "🚀")
    if (strongBuy) {
      markers.push({ time: t, position: 'bottom', shape: 'triangleUp', color: color.lime, size: 'small', text: '🚀', textColor: color.blue });
    }
    // plotshape(strongSellSignal, location.top, color.red, shape.triangledown, size.small, text = "🔻")
    if (strongSell) {
      markers.push({ time: t, position: 'top', shape: 'triangleDown', color: color.red, size: 'small', text: '🔻', textColor: color.blue });
    }
    // bgcolor(strongBuySignal ? color.new(color.lime, 80) : na); bgcolor(strongSellSignal ? color.new(color.red, 80) : na)
    // (both can not be true on the same bar)
    if (strongBuy) bgColors.push({ time: t, color: buyBg });
    if (strongSell) bgColors.push({ time: t, color: sellBg });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: macdLine[i], color: color.green })),
      plot1: bars.map((b, i) => ({ time: b.time, value: signalLine[i], color: color.red })),
      plot2: bars.map((b, i) => ({ time: b.time, value: histogram[i], color: color.gray })),
    },
    markers,
    bgColors,
  };
}

export const MrCrypto731 = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
