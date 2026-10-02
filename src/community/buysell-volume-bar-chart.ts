/**
 * BuySell Volume Bar Chart
 *
 * Splits the bar volume by the close position in the bar range: buy volume = volume * (close - low) / (high - low),
 * sell volume = volume * (high - close) / (high - low) (na on a flat bar, high == low). Buy volume is drawn as
 * columns above zero and sell volume as columns below zero; the larger side has the full colour and the smaller
 * side a transparent colour. The difference (buy - sell) is shown in the data window only.
 *
 * Reference: "BuySell Volume Bar Chart" by roshbiz1408
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: ©roshbiz1408
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export type BuysellVolumeBarChartInputs = Record<string, never>;

export const defaultInputs: BuysellVolumeBarChartInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Buy', color: color.green, lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Sell', color: color.red, lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'Δ Volume', color: color.green, lineWidth: 1, display: 'data_window' },
];

export const metadata = {
  title: 'BuySell Volume Bar Chart',
  shortTitle: 'BuySell Volume Bar Chart',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

export function calculate(bars: Bar[], _inputs: Partial<BuysellVolumeBarChartInputs> = {}): IndicatorResult {
  const buyWeak = String(color.new('#4caf4f', 48));
  const sellWeak = String(color.new('#ff5252', 58));
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

  const plot0: { time: number; value: number; color: string }[] = [];
  const plot1: { time: number; value: number; color: string }[] = [];
  const plot2: { time: number; value: number; color: string }[] = [];
  for (const b of bars) {
    const volume = b.volume ?? NaN;
    // flat = high == low: no buy / sell split on a flat bar
    const flat = eq(b.high, b.low);
    const bv = flat ? NaN : (volume * (b.close - b.low)) / (b.high - b.low);
    const sv = flat ? NaN : (volume * (b.high - b.close)) / (b.high - b.low);
    const diff = bv - sv;
    const buyHigher = gt(diff, 0);
    plot0.push({ time: b.time, value: fin(bv), color: buyHigher ? color.green : buyWeak });
    plot1.push({ time: b.time, value: fin(-sv), color: buyHigher ? sellWeak : color.red });
    plot2.push({ time: b.time, value: fin(diff), color: buyHigher ? color.green : color.red });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2 },
  };
}

export const BuysellVolumeBarChart = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
