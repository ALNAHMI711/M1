/**
 * Vortex Pro with Moving average
 *
 * Vortex indicator: VI+ = sum(|high - low[1]|) / sum(true range) and VI- = sum(|low - high[1]|) / sum(true range)
 * over `length` bars. Vortex Pro = (VI+ - VI-) * 10, with a moving average (EMA, SMA, HMA or WMA) and a zero line.
 * The area between Vortex Pro and zero is green above zero, red otherwise.
 *
 * Reference: "Vortex Pro with Moving average [point algo]" by pointalgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, math, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface VortexProWithMovingAverageInputs {
  /** Vortex period */
  length: number;
  /** MA period */
  maLength: number;
  /** MA type */
  maType: 'EMA' | 'SMA' | 'HMA' | 'WMA';
}

export const defaultInputs: VortexProWithMovingAverageInputs = {
  length: 14,
  maLength: 9,
  maType: 'EMA',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Vortex Period', defval: 14, min: 2 },
  { id: 'maLength', type: 'int', title: 'MA Period', defval: 9, min: 1 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA', options: ['EMA', 'SMA', 'HMA', 'WMA'] },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Vortex Pro', color: color.blue, lineWidth: 2 },
  { id: 'plot1', title: 'Vortex Pro MA', color: color.orange, lineWidth: 1 },
  { id: 'plot2', title: 'Zero Line', color: color.gray, lineWidth: 1 },
];

export const metadata = {
  title: 'Vortex Pro with Moving average [point algo]',
  shortTitle: 'Vortex Pro with Moving average [point algo]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(bars: Bar[], inputs: Partial<VortexProWithMovingAverageInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  // tr = ta.tr (na on the first bar); vm_plus = math.abs(high - low[1]); vm_minus = math.abs(low - high[1])
  const tr = A(ta.tr(bars, false));
  const vmPlus = bars.map((b, i) => (i > 0 ? Math.abs(b.high - bars[i - 1].low) : NaN));
  const vmMinus = bars.map((b, i) => (i > 0 ? Math.abs(b.low - bars[i - 1].high) : NaN));
  const sumPlus = A(math.sum(S(vmPlus), cfg.length) as Series);
  const sumMinus = A(math.sum(S(vmMinus), cfg.length) as Series);
  const sumTr = A(math.sum(S(tr), cfg.length) as Series);
  // Plain divisions: x / 0 is +-infinity (0 / 0 na); the MA skips infinite values, the plot shows na
  const vortexPro = sumPlus.map((p, i) => (p / sumTr[i] - sumMinus[i] / sumTr[i]) * 10);

  const vs = S(vortexPro);
  let ma: number[];
  switch (cfg.maType) {
    case 'EMA': ma = A(ta.ema(vs, cfg.maLength)); break;
    case 'SMA': ma = A(ta.sma(vs, cfg.maLength)); break;
    case 'HMA':
      // ta.hma(x, 1) calls ta.wma(x, 0): a Pine runtime error
      if (Math.floor(cfg.maLength / 2) < 1 && n > 0) {
        throw new Error("Error on bar 0: Invalid value of the 'length' argument (0.0) in the 'wma' function. It must be > 0.");
      }
      ma = A(ta.hma(vs, cfg.maLength));
      break;
    case 'WMA': ma = A(ta.wma(vs, cfg.maLength)); break;
    default: ma = new Array(n).fill(NaN);
  }

  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const green = String(color.new(color.green, 80));
  const red = String(color.new(color.red, 80));
  const t = (i: number) => bars[i].time;
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((_b, i) => ({ time: t(i), value: fin(vortexPro[i]), color: color.blue })),
      plot1: bars.map((_b, i) => ({ time: t(i), value: fin(ma[i]), color: color.orange })),
      plot2: bars.map((_b, i) => ({ time: t(i), value: 0, color: color.gray })),
    },
    // fill(vortex_plot, zero_line, color = vortex_pro > 0 ? color.new(color.green, 80) : color.new(color.red, 80))
    fills: [{ plot1: 'plot0', plot2: 'plot2', options: { title: 'Vortex Zone Fill' },
      colors: vortexPro.map((v) => (gt(v, 0) ? green : red)) }],
  };
}

export const VortexProWithMovingAverage = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
