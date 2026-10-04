/**
 * Emergent Rays - NovaTheMachine
 *
 * Ten bands between the EMA of the high and the EMA of the low, with the lengths 21, 25, 30, 35, 40, 45, 50, 55, 60
 * and 65. The EMA lines are hidden; each band is filled with a colour of the colour scheme (Rainbow, Gainbow
 * (greens) or Painbow (reds)), with the transparency input (Rainbow: + 0 to + 9 from the inner to the outer band).
 * With Auto Trend Colors every band is green when the close is above its EMA of the high, red when the close is
 * below its EMA of the low, and red (Rainbow first colour) otherwise.
 *
 * Reference: "Emergent Rays - NovaTheMachine" by NovaTheMachine
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © NovaTheMachine
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export type EmergentRaysColorScheme = 'Rainbow' | 'Gainbow' | 'Painbow';

export interface EmergentRaysNovathemachineInputs {
  /** Transparency of the bands (higher is less visible) */
  opacity: number;
  /** Colour scheme */
  trendcolor: EmergentRaysColorScheme;
  /** Colours from the close position against each band */
  autoTrend: boolean;
}

export const defaultInputs: EmergentRaysNovathemachineInputs = {
  opacity: 75,
  trendcolor: 'Rainbow',
  autoTrend: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'opacity', type: 'int', title: 'Transparency', defval: 75, min: 5, max: 95, step: 10 },
  { id: 'trendcolor', type: 'string', title: 'Color Scheme', defval: 'Rainbow', options: ['Rainbow', 'Gainbow', 'Painbow'] },
  { id: 'autoTrend', type: 'bool', title: 'Auto Trend Colors', defval: false },
];

const LENGTHS = [21, 25, 30, 35, 40, 45, 50, 55, 60, 65];
/** Pine plot titles (the last pair repeats "EMA 60", as the Pine script) */
const TITLES = [21, 25, 30, 35, 40, 45, 50, 55, 60, 60];
/** Pine fill titles (the last fill repeats "Range 9", as the Pine script) */
const FILL_TITLES = ['Range 1', 'Range 2', 'Range 3', 'Range 4', 'Range 5', 'Range 6', 'Range 7', 'Range 8', 'Range 9', 'Range 9'];

const RAINBOW = ['#ff0000', '#ff1e00', '#FF4500', '#ffd900', '#a6ff00', '#12d612', '#36cfb6', '#1E90FF', '#4169E1', '#8A2BE2'];
const GAINBOW = ['#80ff80', '#40ff40', '#00f000', '#00e000', '#00c000', '#00a000', '#008000', '#006000', '#004000', '#002e1c'];
const PAINBOW = ['#ff8080', '#ff4040', '#FF0000', '#e00000', '#c00000', '#a00000', '#800000', '#7c0000', '#6b0000', '#570000'];

// plot(ema, title, color = na, editable = false, display = display.none)
export const plotConfig: PlotConfig[] = TITLES.flatMap((t, k) => [
  { id: `plot${2 * k}`, title: `EMA ${t} High`, color: 'transparent', lineWidth: 1, display: 'none' as const },
  { id: `plot${2 * k + 1}`, title: `EMA ${t} Low`, color: 'transparent', lineWidth: 1, display: 'none' as const },
]);

export const metadata = {
  title: 'Emergent Rays - NovaTheMachine',
  shortTitle: 'Emergent Rays',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<EmergentRaysNovathemachineInputs> = {},
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const high = Series.fromArray(bars, bars.map((b) => b.high));
  const low = Series.fromArray(bars, bars.map((b) => b.low));
  const op = cfg.opacity;

  // r1..r10 = color.new(rainbow[k], opacity + k); g1..g10 and p1..p10 = color.new(c, opacity)
  const r = RAINBOW.map((c, k) => String(color.new(c, op + k)));
  const g = GAINBOW.map((c) => String(color.new(c, op)));
  const p = PAINBOW.map((c) => String(color.new(c, op)));
  const scheme = cfg.trendcolor === 'Rainbow' ? r : cfg.trendcolor === 'Gainbow' ? g : p;

  const plots: Record<string, { time: number; value: number }[]> = {};
  const fills: NonNullable<IndicatorResult['fills']> = [];
  LENGTHS.forEach((len, k) => {
    const eHigh = A(ta.ema(high, len));
    const eLow = A(ta.ema(low, len));
    plots[`plot${2 * k}`] = bars.map((b, i) => ({ time: b.time, value: eHigh[i] }));
    plots[`plot${2 * k + 1}`] = bars.map((b, i) => ({ time: b.time, value: eLow[i] }));
    // fill(h, l, getColor(k + 1, emaHigh, emaLow), "Range ...")
    const colors = bars.map((b, i) => (cfg.autoTrend
      ? gt(b.close, eHigh[i]) ? g[0] : lt(b.close, eLow[i]) ? p[0] : r[0]
      : scheme[k]));
    fills.push({ plot1: `plot${2 * k}`, plot2: `plot${2 * k + 1}`, options: { title: FILL_TITLES[k] }, colors });
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills,
  };
}

export const EmergentRaysNovathemachine = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
