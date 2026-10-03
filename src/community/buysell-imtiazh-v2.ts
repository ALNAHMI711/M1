/**
 * BuySell% ImtiazH v2
 *
 * Splits the bar volume into a buying part, volume * (close - low) / (high - low), and a selling part (0 on a bar
 * with high == low). Plots the total volume (red columns), the buying volume (teal columns), the buying share in
 * percent, the 30-bar SMA of the volume and a breakout level = SMA * (1 + threshold / 100).
 *
 * Reference: "BuySell%_ImtiazH_v2" by a272a59956
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface BuySellImtiazhV2Inputs {
  /** Breakout threshold above the 30-bar average volume (%) */
  breakoutThreshold: number;
}

export const defaultInputs: BuySellImtiazhV2Inputs = {
  breakoutThreshold: 40.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'breakoutThreshold', type: 'float', title: 'Breakout Threshold (%)', defval: 40.0, min: 0.0 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SELL V', color: color.red, lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'BUY V', color: color.teal, lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'Buy %', color: String(color.new(color.yellow, 0)), lineWidth: 1 },
  { id: 'plot3', title: '30-Day Avg Vol Line', color: color.blue, lineWidth: 2 },
  { id: 'plot4', title: 'Breakout Vol Line', color: color.white, lineWidth: 2 },
];

export const metadata = {
  title: 'BuySell%_ImtiazH',
  shortTitle: 'BuySell%_ImtiazH',
  overlay: false,
};

/** Pine float comparisons: a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;
const fin = (x: number) => (Number.isFinite(x) ? x : NaN);

export function calculate(bars: Bar[], inputs: Partial<BuySellImtiazhV2Inputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const threshold = cfg.breakoutThreshold / 100.0;
  const volume = bars.map((b) => b.volume ?? NaN);

  // buyVolume = (high == low) ? 0 : volume * (close - low) / (high - low)
  const buyVolume = bars.map((b, i) => (eq(b.high, b.low) ? 0 : (volume[i] * (b.close - b.low)) / (b.high - b.low)));
  // buyPercent = buyVolume / volume * 100 (plain division: 0 / 0 is na)
  const buyPercent = buyVolume.map((v, i) => (v / volume[i]) * 100);
  const avgVolume30 = ta.sma(Series.fromArray(bars, volume), 30).toArray().map((v) => v ?? NaN);
  const breakoutVolume = avgVolume30.map((v) => v * (1 + threshold));

  const t = (i: number) => bars[i].time;
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((_b, i) => ({ time: t(i), value: fin(volume[i]) })),
      plot1: bars.map((_b, i) => ({ time: t(i), value: fin(buyVolume[i]) })),
      plot2: bars.map((_b, i) => ({ time: t(i), value: fin(buyPercent[i]) })),
      plot3: bars.map((_b, i) => ({ time: t(i), value: fin(avgVolume30[i]) })),
      plot4: bars.map((_b, i) => ({ time: t(i), value: fin(breakoutVolume[i]) })),
    },
  };
}

export const BuySellImtiazhV2 = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
