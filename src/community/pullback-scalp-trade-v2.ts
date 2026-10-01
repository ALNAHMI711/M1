/**
 * Pullback Scalp Trade V2
 *
 * SMA 50 and SMA 200 of the close with a fill between them: green when the close is above the SMA 200, red otherwise.
 * A Supertrend (factor, ATR length) is drawn as an up-trend line (direction < 0) and a down-trend line. A Buy signal
 * marks the bar where the Supertrend turns up (direction < 0 after direction > 0) with the close above the SMA 200;
 * a Sell signal the bar where it turns down with the close below the SMA 200.
 *
 * Reference: "Pullback Scalp Trade V2" by Sinyalbak_App
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface PullbackScalpTradeV2Inputs {
  /** ATR length of the Supertrend */
  atrPeriod: number;
  /** ATR factor of the Supertrend */
  factor: number;
}

export const defaultInputs: PullbackScalpTradeV2Inputs = {
  atrPeriod: 10,
  factor: 1,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrPeriod', type: 'int', title: 'ATR Length', defval: 10, min: 1 },
  { id: 'factor', type: 'float', title: 'Factor', defval: 1, min: 0.1, step: 0.1 },
];

const MA50_COLOR = String(color.new(color.red, 50));
const MA200_COLOR = String(color.new(color.green, 50));
const UP_COLOR = String(color.new(color.lime, 70));
const DOWN_COLOR = String(color.new(color.orange, 70));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Medium Trend MA', color: MA50_COLOR, lineWidth: 1 },
  { id: 'plot1', title: 'Long Trend MA', color: MA200_COLOR, lineWidth: 1 },
  { id: 'plot2', title: 'upTrend2', color: UP_COLOR, lineWidth: 1, style: 'linebr' },
  { id: 'plot3', title: 'downTrend2', color: DOWN_COLOR, lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'Pullback Scalp Trade V2',
  shortTitle: 'Pullback Scalp Trade V2',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<PullbackScalpTradeV2Inputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const { atrPeriod, factor } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const closeS = Series.fromArray(bars, bars.map((b) => b.close));

  const ma50 = A(ta.sma(closeS, 50));
  const ma200 = A(ta.sma(closeS, 200));
  const [stS, dirS] = ta.supertrend(bars, factor, atrPeriod);
  const st = A(stS);
  const dir = A(dirS);

  const trendUp = String(color.new(color.green, 90));
  const trendDown = String(color.new(color.red, 90));

  const plot0: { time: number; value: number; color: string }[] = [];
  const plot1: { time: number; value: number; color: string }[] = [];
  const plot2: { time: number; value: number; color: string }[] = [];
  const plot3: { time: number; value: number; color: string }[] = [];
  const fillColors: string[] = new Array(n);
  const markers: MarkerData[] = [];
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    // trendColor = close > ma200 ? color.green : color.red
    fillColors[i] = gt(b.close, ma200[i]) ? trendUp : trendDown;
    plot0.push({ time: b.time, value: ma50[i], color: MA50_COLOR });
    plot1.push({ time: b.time, value: ma200[i], color: MA200_COLOR });
    // supertrend2 := barstate.isfirst ? na : supertrend2
    const st2 = i === 0 ? NaN : st[i];
    plot2.push({ time: b.time, value: lt(dir[i], 0) ? st2 : NaN, color: UP_COLOR });
    plot3.push({ time: b.time, value: lt(dir[i], 0) ? NaN : st2, color: DOWN_COLOR });

    const prevDir = i > 0 ? dir[i - 1] : NaN;
    const buySignal = lt(dir[i], 0) && gt(prevDir, 0) && gt(b.close, ma200[i]);
    const sellSignal = gt(dir[i], 0) && lt(prevDir, 0) && lt(b.close, ma200[i]);
    if (buySignal) {
      markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: color.lime, size: 'tiny',
        text: 'Buy', textColor: color.lime });
    }
    if (sellSignal) {
      markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: color.orange, size: 'tiny',
        text: 'Sell', textColor: color.orange });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2, plot3 },
    // fill(ma50Plot, ma200Plot, color = color.new(trendColor, 90), title = "Trend Zone")
    fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'Trend Zone' }, colors: fillColors }],
    markers,
  };
}

export const PullbackScalpTradeV2 = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
