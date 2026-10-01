/**
 * TMO (True Momentum Oscillator)
 *
 * For each bar, the close is compared with the open of the current bar and of the `length` previous bars:
 * +1 when the close is higher, -1 when it is lower, 0 otherwise; the sum is smoothed by an EMA (calculation length),
 * a second EMA gives the main line and a third EMA the signal line (smooth length). Both lines and the cloud between
 * them are green when the main line is above the signal line, red otherwise. Lines at 0, at +-round(length * 0.7)
 * and at +-length, with a red cloud between the two upper lines and a green cloud between the two lower lines.
 *
 * Reference: "TMO (True Momentum Oscillator)" by Coulisnosaj
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface TrueMomentumOscillatorInputs {
  /** Number of previous opens compared with the close */
  length: number;
  /** EMA length of the momentum sum */
  calcLength: number;
  /** EMA length of the main and signal lines */
  smoothLength: number;
}

export const defaultInputs: TrueMomentumOscillatorInputs = {
  length: 14,
  calcLength: 5,
  smoothLength: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14 },
  { id: 'calcLength', type: 'int', title: 'Calculation Length', defval: 5 },
  { id: 'smoothLength', type: 'int', title: 'Smooth Length', defval: 3 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Main', color: color.green, lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: color.green, lineWidth: 1 },
  { id: 'plot2', title: 'Zero Line', color: color.gray, lineWidth: 1 },
  { id: 'plot3', title: 'Overbought', color: color.gray, lineWidth: 1 },
  { id: 'plot4', title: 'Oversold', color: color.gray, lineWidth: 1 },
  { id: 'plot5', title: 'Overbought Line', color: color.gray, lineWidth: 1 },
  { id: 'plot6', title: 'Oversold Line', color: color.gray, lineWidth: 1 },
];

export const metadata = {
  title: 'TMO (True Momentum Oscillator)',
  shortTitle: 'TMO',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(bars: Bar[], inputs: Partial<TrueMomentumOscillatorInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, calcLength, smoothLength } = cfg;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  // data = sum over i = 0 .. length of (close > open[i] ? 1 : close < open[i] ? -1 : 0); open[i] before the first
  // bar is na and adds 0. `for i = 0 to length` counts down when length < 0.
  const data: number[] = new Array(n);
  const step = length >= 0 ? 1 : -1;
  for (let b = 0; b < n; b++) {
    const c = bars[b].close;
    let sum = 0;
    for (let i = 0; step > 0 ? i <= length : i >= length; i += step) {
      if (i < 0) throw new Error(`Invalid number of bars back: ${i}`);
      const o = b - i >= 0 ? bars[b - i].open : NaN;
      sum += gt(c, o) ? 1 : lt(c, o) ? -1 : 0;
    }
    data[b] = sum;
  }

  const ema5 = A(ta.ema(S(data), calcLength));
  const mainVal = A(ta.ema(S(ema5), smoothLength));
  const signalVal = A(ta.ema(S(mainVal), smoothLength));

  const up = (i: number) => gt(mainVal[i], signalVal[i]);
  const lineColor = (i: number) => (up(i) ? color.green : color.red);
  const cloudUp = String(color.new(color.green, 80));
  const cloudDown = String(color.new(color.red, 80));

  // ob = math.round(length * 0.7), os = -ob
  const ob = Math.round(length * 0.7);
  const os = -ob;
  const constant = (v: number) => bars.map((b) => ({ time: b.time, value: v, color: color.gray }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: mainVal[i], color: lineColor(i) })),
      plot1: bars.map((b, i) => ({ time: b.time, value: signalVal[i], color: lineColor(i) })),
      plot2: constant(0),
      plot3: constant(ob),
      plot4: constant(os),
      plot5: constant(length),
      plot6: constant(-length),
    },
    fills: [
      // fill(p_main, p_signal, main_val > signal_val ? color.new(color.green, 80) : color.new(color.red, 80))
      { plot1: 'plot0', plot2: 'plot1', colors: bars.map((_b, i) => (up(i) ? cloudUp : cloudDown)) },
      // fill(p_ob, p_obLine, color.new(color.red, 90)); fill(p_osLine, p_os, color.new(color.green, 90))
      { plot1: 'plot3', plot2: 'plot5', options: { color: String(color.new(color.red, 90)) } },
      { plot1: 'plot6', plot2: 'plot4', options: { color: String(color.new(color.green, 90)) } },
    ],
  };
}

export const TrueMomentumOscillator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
