/**
 * Hilega-Milega-RSI-EMA-WMA
 *
 * An RSI computed by hand (RMA of the up and down changes of the source), with a WMA and an EMA of the RSI. Two dashed
 * middle lines (an adjustable one and 50), and fills between the RSI and the adjustable middle line: red when the RSI
 * is above it, blue when it is below.
 *
 * Reference: "Hilega-Milega-RSI-EMA-WMA indicator designed by NK" by kshirsagar_n
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © NK1356
 */

import {
  ta, Series, color, getSourceSeries,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';

export interface HilegaMilegaRsiEmaWmaInputs {
  /** RSI source */
  src: SourceType;
  /** RSI length */
  len: number;
  /** WMA length (WMA of the RSI) */
  wmaLength: number;
  /** EMA length (EMA of the RSI) */
  emaLength: number;
  /** Adjustable middle line */
  adjustableMiddleLine: number;
}

export const defaultInputs: HilegaMilegaRsiEmaWmaInputs = {
  src: 'close',
  len: 9,
  wmaLength: 21,
  emaLength: 3,
  adjustableMiddleLine: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'len', type: 'int', title: 'RSI Length', defval: 9, min: 1 },
  { id: 'wmaLength', type: 'int', title: 'WMA Length', defval: 21 },
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 3 },
  { id: 'adjustableMiddleLine', type: 'int', title: 'Adjustable Middle Line', defval: 50 },
];

const RSI_COLOR = String(color.new(color.black, 0));
const WMA_COLOR = String(color.new(color.red, 0));
const EMA_COLOR = String(color.new(color.green, 0));
const OVERSOLD_COLOR = String(color.new(color.red, 90));
const OVERBOUGHT_COLOR = String(color.new(color.blue, 90));
/** Pine default plot colour (the reference plot has no colour argument) */
const DEFAULT_PLOT_COLOR = '#2962FF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: RSI_COLOR, lineWidth: 1 },
  { id: 'plot1', title: 'WMA', color: WMA_COLOR, lineWidth: 2 },
  { id: 'plot2', title: 'EMA', color: EMA_COLOR, lineWidth: 1 },
  { id: 'plot3', title: 'Middle Line Reference', color: DEFAULT_PLOT_COLOR, lineWidth: 1 },
  { id: 'plot4', title: 'Oversold', color: OVERSOLD_COLOR, lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Overbought', color: OVERBOUGHT_COLOR, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Hilega-Milega-RSI-EMA-WMA indicator designed by NK',
  shortTitle: 'Hilega-Milega-RSI-EMA-WMA indicator designed by NK',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

export function calculate(bars: Bar[], inputs: Partial<HilegaMilegaRsiEmaWmaInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const mid = cfg.adjustableMiddleLine;

  const src = A(getSourceSeries(bars, cfg.src));
  // ta.change(src): na on bar 0; math.max / math.min of na is na
  const change = src.map((v, i) => (i > 0 ? v - src[i - 1] : NaN));
  const up = A(ta.rma(S(change.map((c) => (isNaN(c) ? NaN : Math.max(c, 0)))), cfg.len));
  const down = A(ta.rma(S(change.map((c) => (isNaN(c) ? NaN : -Math.min(c, 0)))), cfg.len));
  // rsi = down == 0 ? 100 : up == 0 ? 0 : 100 - (100 / (1 + up / down))
  const rsi = up.map((u, i) => (eq(down[i], 0) ? 100 : eq(u, 0) ? 0 : 100 - 100 / (1 + u / down[i])));
  const wma = A(ta.wma(S(rsi), cfg.wmaLength));
  const ema = A(ta.ema(S(rsi), cfg.emaLength));

  const t = (i: number) => bars[i].time;
  const plots = {
    plot0: rsi.map((v, i) => ({ time: t(i), value: v, color: RSI_COLOR })),
    plot1: wma.map((v, i) => ({ time: t(i), value: v, color: WMA_COLOR })),
    plot2: ema.map((v, i) => ({ time: t(i), value: v, color: EMA_COLOR })),
    plot3: bars.map((_b, i) => ({ time: t(i), value: mid, color: DEFAULT_PLOT_COLOR })),
    // rsi > adjustable_middle_line ? rsi : adjustable_middle_line (na rsi compares false)
    plot4: rsi.map((v, i) => ({ time: t(i), value: gt(v, mid) ? v : mid, color: OVERSOLD_COLOR })),
    // rsi > adjustable_middle_line ? adjustable_middle_line : rsi
    plot5: rsi.map((v, i) => ({ time: t(i), value: gt(v, mid) ? mid : v, color: OVERBOUGHT_COLOR })),
  };

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    hlines: [
      { value: mid, options: { title: 'Adjustable Middle Line', color: color.gray, linestyle: 'dashed' } },
      { value: 50, options: { title: 'Default Middle Line', color: '#b2b5be', linestyle: 'dashed' } },
    ],
    fills: [
      // fill(obsd, ref, color.new(color.red, 90), title = "Oversold")
      { plot1: 'plot4', plot2: 'plot3', options: { title: 'Oversold', color: OVERSOLD_COLOR } },
      // fill(obbt, ref, color.new(color.blue, 90), title = "Overbought")
      { plot1: 'plot5', plot2: 'plot3', options: { title: 'Overbought', color: OVERBOUGHT_COLOR } },
    ],
  };
}

export const HilegaMilegaRsiEmaWma = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
