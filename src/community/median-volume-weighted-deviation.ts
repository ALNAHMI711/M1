/**
 * Median Volume Weighted Deviation
 *
 * A rolling VWAP of the close over `n` bars, sum(close * volume) / sum(volume), and the volume weighted standard
 * deviation of the close around it, sqrt(sum(volume * (close - vwap)^2) / sum(volume)). Bands are the VWAP +- k * the
 * median of that deviation over `m` bars. The close crossing over the upper band gives a long state (yellow-green),
 * crossing under the lower band a short state (purple); the VWAP line, the band fill, the bar colour and the
 * background follow the last signal.
 *
 * Reference: "Median Volume Weighted Deviation" by Burggg
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Burggg
 */

import { ta, math, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, BgColorData } from '../types';

export interface MedianVolumeWeightedDeviationInputs {
  /** Lookback of the VWAP and of the deviation */
  n: number;
  /** Length of the median of the deviation */
  m: number;
  /** Deviation multiplier */
  k: number;
  /** Colour the bars with the last signal */
  barOn: boolean;
  /** Show the bands */
  bandOn: boolean;
  /** Colour the background with the last signal */
  bgOn: boolean;
}

export const defaultInputs: MedianVolumeWeightedDeviationInputs = {
  n: 14,
  m: 2,
  k: 1.7,
  barOn: true,
  bandOn: false,
  bgOn: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'n', type: 'int', title: 'Lookback', defval: 14, min: 1, group: '~~~~~~ Inputs ~~~~~~' },
  { id: 'm', type: 'int', title: 'Median StDev', defval: 2, min: 1, group: '~~~~~~ Inputs ~~~~~~' },
  { id: 'k', type: 'float', title: 'StDev Multiplier', defval: 1.7, min: 0.1, step: 0.1, group: '~~~~~~ Inputs ~~~~~~' },
  { id: 'barOn', type: 'bool', title: 'Bar Color', defval: true, group: '~~~~~~ Plots ~~~~~~' },
  { id: 'bandOn', type: 'bool', title: 'Bands', defval: false, group: '~~~~~~ Plots ~~~~~~' },
  { id: 'bgOn', type: 'bool', title: 'Background Color', defval: false, group: '~~~~~~ Plots ~~~~~~' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VWAP', color: String(color.new('#999999', 50)), lineWidth: 2, style: 'linebr' },
  { id: 'plot1', title: 'Upper Band', color: 'transparent', lineWidth: 2 },
  { id: 'plot2', title: 'Lower Band', color: 'transparent', lineWidth: 2 },
];

export const metadata = {
  title: 'Median Volume Weighted Deviation',
  shortTitle: 'MVWD',
  overlay: true,
};

export function calculate(
  bars: Bar[],
  inputs: Partial<MedianVolumeWeightedDeviationInputs> = {},
): IndicatorResult & { barColors: BarColorData[]; bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const close = bars.map((b) => b.close);
  const volume = bars.map((b) => b.volume ?? NaN);

  // vwapN = math.sum(close * volume, n) / math.sum(volume, n)
  const sumClosevol = A(math.sum(S(close.map((c, i) => c * volume[i])), cfg.n) as Series);
  const sumVol = A(math.sum(S(volume), cfg.n) as Series);
  const vwapN = sumClosevol.map((v, i) => v / sumVol[i]);
  // variance = math.sum(volume * math.pow(close - vwapN, 2), n) / sumVol
  const sqDev = close.map((c, i) => volume[i] * Math.pow(c - vwapN[i], 2));
  const variance = A(math.sum(S(sqDev), cfg.n) as Series).map((v, i) => v / sumVol[i]);
  const stdN = variance.map((v) => Math.sqrt(v));
  const medianStd = A(ta.median(S(stdN), cfg.m));
  const upper = vwapN.map((v, i) => v + cfg.k * medianStd[i]);
  const lower = vwapN.map((v, i) => v - cfg.k * medianStd[i]);

  // buy = ta.crossover(close, upper); sell = ta.crossunder(close, lower) (exact comparisons)
  const closeSeries = S(close);
  const buy = A(ta.crossover(closeSeries, S(upper)));
  const sell = A(ta.crossunder(closeSeries, S(lower)));

  const longColor = '#ddff00';
  const shortColor = '#b300ff';
  const neutral = String(color.new('#999999', 50));
  const longBand = String(color.new(longColor, 90));
  const shortBand = String(color.new(shortColor, 90));
  const longBar = String(color.new(longColor, 0));
  const shortBar = String(color.new(shortColor, 0));

  const plot0: { time: number; value: number; color: string }[] = [];
  const plot1: { time: number; value: number; color: string }[] = [];
  const plot2: { time: number; value: number; color: string }[] = [];
  const fillColors: string[] = new Array(n);
  const barColors: BarColorData[] = [];
  const bgColors: BgColorData[] = [];
  let score = 0; // var score = 0
  let bandColor: string | null = null; // var color bandColor = na
  let barColor: string | null = null; // var color barColor = na
  let bgColor: string | null = null; // var color bgColor = na
  for (let i = 0; i < n; i++) {
    const isBuy = buy[i] === 1;
    const isSell = sell[i] === 1;
    if (isBuy && !isSell) score = 1;
    if (isSell) score = -1;
    const col = score === 1 ? longColor : score === -1 ? shortColor : neutral;
    if (isBuy && cfg.bandOn) bandColor = longBand;
    if (isSell && cfg.bandOn) bandColor = shortBand;
    if (isBuy && cfg.barOn) barColor = longBar;
    if (isSell && cfg.barOn) barColor = shortBar;
    if (isBuy && cfg.bgOn) bgColor = longBand;
    if (isSell && cfg.bgOn) bgColor = shortBand;

    const t = bars[i].time as number;
    const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
    plot0.push({ time: t, value: fin(vwapN[i]), color: col });
    plot1.push({ time: t, value: cfg.bandOn ? fin(upper[i]) : NaN, color: bandColor ?? 'transparent' });
    plot2.push({ time: t, value: cfg.bandOn ? fin(lower[i]) : NaN, color: bandColor ?? 'transparent' });
    // fill(upperPlot, lowerPlot, color = color.new(col, 90))
    fillColors[i] = String(color.new(col, 90));
    if (barColor !== null) barColors.push({ time: t, color: barColor });
    if (bgColor !== null) bgColors.push({ time: t, color: bgColor });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2 },
    fills: [{ plot1: 'plot1', plot2: 'plot2', options: { title: 'Deviation Zone' }, colors: fillColors }],
    barColors,
    bgColors,
  };
}

export const MedianVolumeWeightedDeviation = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
