/**
 * [blackcat] L2 Risk Assessment for Trend Strength
 *
 * var4 = 100 - ema((close - lowest(low, 33)) / (highest(high, 21) - lowest(low, 33)) * 100, 10); the safety level
 * is ema(0.191 * v + 0.809 * var4, 1), where v is var4 (or var4 of the previous bar when var4 is na), drawn as an
 * area; the trend strength is 100 - safety level, fuchsia from 80, red from 50, yellow from 20, green below.
 * Dotted levels at 100 / 80 / 50 / 20 / 0 with coloured zones between them.
 * (The Pine script also computes a risk assessment line that it does not plot; it is not ported.)
 *
 * Reference: "[blackcat] L2 Risk Assessment for Trend Strength" by blackcat1402
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © blackcat1402
 */

import {
  ta, Series, color,
  type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar,
} from 'oakscriptjs';

export type L2RiskAssessmentForTrendStrengthInputs = Record<string, never>;

export const defaultInputs: L2RiskAssessmentForTrendStrengthInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Current Safety Level', color: String(color.new(color.blue, 30)), lineWidth: 4, style: 'area' },
  { id: 'plot1', title: 'Trend Strength Indicator', color: '#2962FF', lineWidth: 6 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_100', price: 100, title: 'Level', color: color.blue, linestyle: 'dotted' },
  { id: 'hline_80', price: 80, title: 'Level', color: color.red, linestyle: 'dotted' },
  { id: 'hline_50', price: 50, title: 'Level', color: color.yellow, linestyle: 'dotted' },
  { id: 'hline_20', price: 20, title: 'Level', color: color.green, linestyle: 'dotted' },
  { id: 'hline_0', price: 0, title: 'Level', color: color.fuchsia, linestyle: 'dotted' },
];

const ZONE_COLORS = [
  String(color.new(color.fuchsia, 60)),
  String(color.new(color.red, 60)),
  String(color.new(color.yellow, 60)),
  String(color.new(color.green, 60)),
];

export const fillConfig: FillConfig[] = [
  { id: 'fill_100_80', plot1: 'hline_100', plot2: 'hline_80', color: ZONE_COLORS[0] },
  { id: 'fill_80_50', plot1: 'hline_80', plot2: 'hline_50', color: ZONE_COLORS[1] },
  { id: 'fill_50_20', plot1: 'hline_50', plot2: 'hline_20', color: ZONE_COLORS[2] },
  { id: 'fill_20_0', plot1: 'hline_20', plot2: 'hline_0', color: ZONE_COLORS[3] },
];

export const metadata = {
  title: '[blackcat] L2 Risk Assessment for Trend Strength',
  shortTitle: '[blackcat] L2 Risk Assessment for Trend Strength',
  overlay: false,
};

/** Pine float comparisons: a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

export function calculate(
  bars: Bar[],
  _inputs: Partial<L2RiskAssessmentForTrendStrengthInputs> = {},
): IndicatorResult {
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  const var2 = A(ta.lowest(S(bars.map((b) => b.low)), 33));
  const var3 = A(ta.highest(S(bars.map((b) => b.high)), 21));
  // A plain division: x / 0 is +-infinity (0 / 0 NaN); ta.ema skips both like na
  const raw = bars.map((b, i) => ((b.close - var2[i]) / (var3[i] - var2[i])) * 100);
  const var4 = A(ta.ema(S(raw), 10)).map((v) => v * -1 + 100);
  // get_last_valid_value(var4, 1): var4, or var4[1] when var4 is na
  const combined = var4.map((v, i) => {
    const last = !isNaN(v) ? v : i > 0 ? var4[i - 1] : NaN;
    return 0.191 * last + 0.809 * v;
  });
  const emaCombined = A(ta.ema(S(combined), 1));

  const plot0 = bars.map((b, i) => ({ time: b.time, value: emaCombined[i] }));
  const plot1 = bars.map((b, i) => {
    const ts = 100 - emaCombined[i];
    const c = ge(ts, 80) ? color.fuchsia : ge(ts, 50) ? color.red : ge(ts, 20) ? color.yellow : color.green;
    return { time: b.time, value: ts, color: c };
  });

  const zone = (k: number) => new Array<string>(n).fill(ZONE_COLORS[k]);
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1 },
    hlines: hlineConfig.map((h) => ({
      value: h.price, options: { title: h.title, color: h.color, linestyle: h.linestyle },
    })),
    fills: fillConfig.map((f, k) => ({ plot1: f.plot1, plot2: f.plot2, colors: zone(k) })),
  };
}

export const L2RiskAssessmentForTrendStrength = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
