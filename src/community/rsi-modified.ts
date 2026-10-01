/**
 * Barchart RSI Modified
 *
 * An RSI with simple moving averages of the gains and losses: rsi = sma(up, period) / (sma(up, period) +
 * sma(down, period)) * 100 (50 when both are 0), and an SMA of the RSI as signal line. The RSI is blue at or above
 * the overbought level, red at or below the oversold level and green between them. The RSI above overbought /
 * below oversold is filled to the level. Horizontal lines at the range bounds (50 +/- range / 2), the levels and 50.
 *
 * Reference: "Barchart RSI Modified" by Santos_Trader_PT
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface RsiModifiedInputs {
  /** Length of the SMAs of the gains and losses */
  period: number;
  /** Range: the range lines are at 50 +/- range / 2 */
  rsiRange: number;
  /** Length of the SMA of the RSI */
  maPeriod: number;
  overboughtLevel: number;
  oversoldLevel: number;
}

export const defaultInputs: RsiModifiedInputs = {
  period: 14,
  rsiRange: 100.0,
  maPeriod: 9,
  overboughtLevel: 70.0,
  oversoldLevel: 30.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'period', type: 'int', title: 'Period', defval: 14, min: 1 },
  { id: 'rsiRange', type: 'float', title: 'Range', defval: 100.0, min: 1.0, max: 100.0 },
  { id: 'maPeriod', type: 'int', title: 'RSI MA Period', defval: 9, min: 1 },
  { id: 'overboughtLevel', type: 'float', title: 'Overbought', defval: 70.0, min: 0.0, max: 100.0 },
  { id: 'oversoldLevel', type: 'float', title: 'Oversold', defval: 30.0, min: 0.0, max: 100.0 },
];

const OB_COLOR = String(color.rgb(38, 86, 255));
const OS_COLOR = String(color.rgb(255, 65, 54));
const MID_COLOR = String(color.rgb(0, 176, 91));
const MA_COLOR = String(color.rgb(255, 137, 75));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Overbought Fill Source', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot1', title: 'Oversold Fill Source', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Overbought Fill Level', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Oversold Fill Level', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'RSI', color: MID_COLOR, lineWidth: 2 },
  { id: 'plot5', title: 'RSI MA', color: MA_COLOR, lineWidth: 1 },
];

export const metadata = {
  title: 'Barchart RSI Modified',
  shortTitle: 'RSI Mod',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

export function calculate(bars: Bar[], inputs: Partial<RsiModifiedInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  // diff = close - close[1]; up = math.max(diff, 0); down = math.max(-diff, 0) (na on the first bar)
  const diff = bars.map((b, i) => (i > 0 ? b.close - bars[i - 1].close : NaN));
  const avgUp = A(ta.sma(S(diff.map((d) => (isNaN(d) ? NaN : Math.max(d, 0)))), cfg.period));
  const avgDown = A(ta.sma(S(diff.map((d) => (isNaN(d) ? NaN : Math.max(-d, 0)))), cfg.period));
  const rsi = bars.map((_b, i) => {
    const total = avgUp[i] + avgDown[i];
    // avgTotal == 0.0 ? 50.0 : avgUp / avgTotal * 100.0
    return eq(total, 0) ? 50.0 : (avgUp[i] / total) * 100.0;
  });
  const rsiMa = A(ta.sma(S(rsi), cfg.maPeriod));

  const upperRangeValue = 50.0 + cfg.rsiRange / 2.0;
  const lowerRangeValue = 50.0 - cfg.rsiRange / 2.0;
  const ob = cfg.overboughtLevel;
  const os = cfg.oversoldLevel;
  const rsiColor = (v: number) => (ge(v, ob) ? OB_COLOR : ge(os, v) ? OS_COLOR : MID_COLOR);

  const t = (i: number) => bars[i].time;
  const plots = {
    // plot(rsi > overboughtLevel ? rsi : na, color = na, display = display.none)
    plot0: bars.map((_b, i) => ({ time: t(i), value: gt(rsi[i], ob) ? rsi[i] : NaN })),
    // plot(rsi < oversoldLevel ? rsi : na, color = na, display = display.none)
    plot1: bars.map((_b, i) => ({ time: t(i), value: gt(os, rsi[i]) ? rsi[i] : NaN })),
    plot2: bars.map((_b, i) => ({ time: t(i), value: ob })),
    plot3: bars.map((_b, i) => ({ time: t(i), value: os })),
    plot4: bars.map((_b, i) => ({ time: t(i), value: rsi[i], color: rsiColor(rsi[i]) })),
    plot5: bars.map((_b, i) => ({ time: t(i), value: rsiMa[i], color: MA_COLOR })),
  };

  const gray = color.gray;
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    hlines: [
      { value: upperRangeValue, options: { title: 'Upper Range', color: String(color.new(gray, 70)), linestyle: 'dashed' } },
      { value: ob, options: { title: 'Overbought', color: String(color.new(gray, 25)), linestyle: 'dashed' } },
      { value: 50, options: { title: 'Midpoint', color: String(color.new(gray, 45)), linestyle: 'dotted' } },
      { value: os, options: { title: 'Oversold', color: String(color.new(gray, 25)), linestyle: 'dashed' } },
      { value: lowerRangeValue, options: { title: 'Lower Range', color: String(color.new(gray, 70)), linestyle: 'dashed' } },
    ],
    fills: [
      { plot1: 'plot0', plot2: 'plot2', options: { title: 'Overbought Solid Fill' },
        colors: new Array<string>(n).fill(String(color.new(OB_COLOR, 70))) },
      { plot1: 'plot1', plot2: 'plot3', options: { title: 'Oversold Solid Fill' },
        colors: new Array<string>(n).fill(String(color.new(OS_COLOR, 70))) },
    ],
  };
}

export const RsiModified = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
