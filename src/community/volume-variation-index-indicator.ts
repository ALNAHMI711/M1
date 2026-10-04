/**
 * Volume Variation Index
 *
 * vol_var = volume[1] - volume. Positive values are drawn as green columns (Volume Increase), negative values as red
 * columns (Volume Decrease). An optional SMA of vol_var (Average Variation) is filled to a zero baseline with a green
 * and a red gradient.
 *
 * Reference: "Volume Variation Index [The Quant Science]" by thequantscience
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface VolumeVariationIndexIndicatorInputs {
  /** Show the average variation line */
  activeAvg: 'NO' | 'YES';
  /** SMA length of the variation */
  avgPeriod: number;
}

export const defaultInputs: VolumeVariationIndexIndicatorInputs = {
  activeAvg: 'YES',
  avgPeriod: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'activeAvg', type: 'string', title: 'Show Average Variation', defval: 'YES', options: ['NO', 'YES'] },
  { id: 'avgPeriod', type: 'int', title: 'Avarage Period', defval: 10 },
];

const GREEN = String(color.rgb(0, 255, 8));
const RED = String(color.rgb(255, 0, 0));
const ZERO_COLOR = String(color.new(color.gray, 100));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume Increase', color: GREEN, lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Volume Decrease', color: RED, lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'Average Variation', color: '#ffffff', lineWidth: 1 },
  { id: 'plot3', title: 'Baseline Zero', color: ZERO_COLOR, lineWidth: 1 },
];

export const metadata = {
  title: 'Volume Variation Index [The Quant Science]',
  shortTitle: 'Volume Variation Index [The Quant Science]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

export function calculate(bars: Bar[], inputs: Partial<VolumeVariationIndexIndicatorInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const active = cfg.activeAvg === 'YES';

  // vol_var = volume[1] - volume
  const volVar = bars.map((b, i) => (i > 0 ? (bars[i - 1].volume ?? NaN) - (b.volume ?? NaN) : NaN));
  const avg = ta.sma(Series.fromArray(bars, volVar), cfg.avgPeriod).toArray().map((v) => v ?? NaN);
  const average = avg.map((v) => (active ? fin(v) : NaN));

  const t = (i: number) => bars[i].time;
  const plot0 = volVar.map((v, i) => ({ time: t(i), value: gt(v, 0) ? v : 0, color: GREEN }));
  const plot1 = volVar.map((v, i) => ({ time: t(i), value: lt(v, 0) ? v : 0, color: RED }));
  const plot2 = average.map((v, i) => ({ time: t(i), value: v, color: '#ffffff' }));
  const plot3 = bars.map((_b, i) => ({ time: t(i), value: 0, color: ZERO_COLOR }));

  // fill(pLine, pZero, top_color, bottom_color) without top_value / bottom_value: the gradient goes from the upper
  // plot (top_color) to the lower plot (bottom_color)
  const same = (c: string) => new Array<string | null>(n).fill(c);
  const top = average.map((v) => (isNaN(v) ? NaN : Math.max(v, 0)));
  const bottom = average.map((v) => (isNaN(v) ? NaN : Math.min(v, 0)));
  const fills = [
    { plot1: 'plot2', plot2: 'plot3', options: { title: 'Gradient +' }, gradient: {
      topValue: top.slice(), bottomValue: bottom.slice(),
      topColor: same(String(color.new(color.green, 50))), bottomColor: same(String(color.new(color.green, 90))) } },
    { plot1: 'plot2', plot2: 'plot3', options: { title: 'Gradient -' }, gradient: {
      topValue: top.slice(), bottomValue: bottom.slice(),
      topColor: same(String(color.new(color.red, 90))), bottomColor: same(String(color.new(color.red, 50))) } },
  ];

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2, plot3 },
    fills,
  };
}

export const VolumeVariationIndexIndicator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
