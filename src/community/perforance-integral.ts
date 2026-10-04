/**
 * Perforance integral
 *
 * For each of the last `length` bars (i = 0 = current bar) a performance: (open - close) / open for i = 0, else
 * (close - close[i]) / close[i] / (i + 1), and a volatility: |true range[i]| / close[i]. The indicator is the EMA of
 * the weighted sum of performance / volatility, with a weight that goes linearly from `weight newest` (i = 0) to
 * `weight on middle` (i = position of middle), then from `weight on middle` with the slope towards `weight oldest`
 * (the original formula uses (i - weight on middle) after the middle). The line is green after a cross above the
 * upper threshold and red after a cross under the lower threshold. A second plot is the sum of the volatilities.
 *
 * Reference: "Perforance integral" by Majimbi
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Majimbi
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface PerforanceIntegralInputs {
  /** Number of bars of the calculation */
  length: number;
  /** Weight of the oldest bar */
  weightStart: number;
  /** Weight at the middle position */
  weightMiddle: number;
  /** Middle position (bars back) */
  positionMiddle: number;
  /** Weight of the newest bar */
  weightEnd: number;
  upperThreshold: number;
  lowerThreshold: number;
  /** EMA length of the weighted sum */
  emaLength: number;
}

export const defaultInputs: PerforanceIntegralInputs = {
  length: 50,
  weightStart: 1.0,
  weightMiddle: 1.0,
  positionMiddle: 25,
  weightEnd: 1.0,
  upperThreshold: 1.5,
  lowerThreshold: -1.5,
  emaLength: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length of calculation', defval: 50 },
  { id: 'weightStart', type: 'float', title: 'weight oldest', defval: 1.0, step: 0.05 },
  { id: 'weightMiddle', type: 'float', title: 'weight on middle', defval: 1.0, step: 0.05 },
  { id: 'positionMiddle', type: 'int', title: 'position of midle', defval: 25 },
  { id: 'weightEnd', type: 'float', title: 'weight newest', defval: 1.0, step: 0.05 },
  { id: 'upperThreshold', type: 'float', title: 'upper threshold', defval: 1.5, step: 0.1 },
  { id: 'lowerThreshold', type: 'float', title: 'lower threshold', defval: -1.5, step: 0.1 },
  { id: 'emaLength', type: 'int', title: 'ema length', defval: 2, step: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'indicator', color: color.red, lineWidth: 1 },
  { id: 'plot1', title: 'vol', color: color.blue, lineWidth: 1 },
];

export const metadata = {
  title: 'Perforance integral',
  shortTitle: 'Iperf',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<PerforanceIntegralInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, weightStart, weightMiddle, positionMiddle, weightEnd } = cfg;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  // `for i = 0 to length_h - 1` counts down when length_h < 1: open[-1] is a Pine runtime error on the first bar
  if (n > 0 && length < 1) {
    throw new Error('The script attempts to reference historical data that is too far from the current bar (-1 bars '
      + 'back). The history-referencing length for the expression must be a value between 0 and 10000.');
  }

  // ta.tr(true) is called in a loop; it has the same value on every call of a bar, so tr[i] is the true range of
  // bar - i (high - low on the first bar)
  const tr = A(ta.tr(bars, true));
  const at = (a: number[], j: number) => (j >= 0 ? a[j] : NaN);
  const open = bars.map((b) => b.open);
  const close = bars.map((b) => b.close);

  const rawSum: number[] = new Array(n);
  const vol: number[] = new Array(n);
  const performance: number[] = new Array(length);
  const volatility: number[] = new Array(length);
  for (let bar = 0; bar < n; bar++) {
    for (let i = 0; i < length; i++) {
      // Plain divisions: x / 0 is +-infinity, 0 / 0 is na
      performance[i] = i === 0
        ? (open[bar] - close[bar]) / open[bar]
        : (close[bar] - at(close, bar - i)) / at(close, bar - i) / (i + 1);
      volatility[i] = Math.abs(at(tr, bar - i)) / at(close, bar - i);
    }
    let v = 0.0;
    for (let i = 0; i < length; i++) v = v + volatility[i];
    vol[bar] = v;
    let sum = 0.0;
    for (let i = 0; i < length; i++) {
      if (i <= positionMiddle) {
        sum = sum + (performance[i] * (((weightMiddle - weightEnd) / positionMiddle) * i + weightEnd)) / volatility[i];
      } else {
        sum = sum + (performance[i] * (((weightStart - weightMiddle) / positionMiddle) * (i - weightMiddle) + weightMiddle))
          / volatility[i];
      }
    }
    rawSum[bar] = sum;
  }

  // sum_ratio := ta.ema(sum_ratio, ema_v): ta.ema skips the na / infinite values as Pine
  const sumRatio = A(ta.ema(S(rawSum), cfg.emaLength));
  const up = A(ta.crossover(S(sumRatio), cfg.upperThreshold));
  const down = A(ta.crossunder(S(sumRatio), cfg.lowerThreshold));

  const fin = (x: number) => (Number.isFinite(x) ? x : NaN);
  let trend = 0; // var trend_1 = 0
  const plot0 = bars.map((b, i) => {
    if (up[i]) trend = 1;
    if (down[i]) trend = -1;
    return { time: b.time, value: fin(sumRatio[i]), color: trend > 0 ? color.green : color.red };
  });
  const plot1 = bars.map((b, i) => ({ time: b.time, value: fin(vol[i]) }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1 },
    hlines: [
      { value: cfg.upperThreshold, options: { title: 'lower threshold', color: String(color.rgb(30, 148, 245, 50)), linestyle: 'solid' } },
      { value: cfg.lowerThreshold, options: { title: 'upper threshold', color: String(color.rgb(252, 153, 4, 50)), linestyle: 'solid' } },
    ],
  };
}

export const PerforanceIntegral = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
