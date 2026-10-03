/**
 * Bars Since MA Test
 *
 * A moving average of the close (SMA, EMA, WMA or HMA). A bar tests the average when the average is inside the bar
 * range (low <= MA <= high) or when the close crosses it. The histogram counts the bars since the last test (0 on a
 * test bar).
 *
 * Reference: "Is it Time for a Pullback? Check Bars Since MA Test" by TradeStation
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, callsite, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export type BarsSinceMaTestMaType = 'SMA' | 'EMA' | 'WMA' | 'HMA';

export interface BarsSinceMaTestInputs {
  /** MA length */
  length: number;
  /** MA type */
  maType: BarsSinceMaTestMaType;
}

export const defaultInputs: BarsSinceMaTestInputs = {
  length: 50,
  maType: 'SMA',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'MA Length', defval: 50, min: 1 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'SMA', options: ['SMA', 'EMA', 'WMA', 'HMA'] },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bars Since MA Touch/Cross', color: color.white, lineWidth: 1, style: 'histogram' },
];

export const metadata = {
  title: 'Bars Since MA Test',
  shortTitle: 'Bars Since MA Test',
  overlay: false,
};

/** Pine a <= b: not (a - b > 1e-10), false with na */
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > 1e-10);

export function calculate(bars: Bar[], inputs: Partial<BarsSinceMaTestInputs> = {}): IndicatorResult {
  const { length, maType } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const close = Series.fromArray(bars, bars.map((b) => b.close));

  let ma: number[];
  switch (maType) {
    case 'SMA': ma = A(ta.sma(close, length)); break;
    case 'EMA': ma = A(ta.ema(close, length)); break;
    case 'WMA': ma = A(ta.wma(close, length)); break;
    case 'HMA':
      // ta.hma(close, 1) runs ta.wma(close, 0): a Pine runtime error
      if (Math.floor(length / 2) < 1 && n > 0) {
        throw new Error("Error on bar 0: Invalid value of the 'length' argument (0.0) in the 'wma' function. It must be > 0.");
      }
      ma = A(ta.hma(close, length));
      break;
    default: ma = new Array(n).fill(NaN);
  }

  // touchOrCross = (low <= ma and ma <= high) or ta.crossover(close, ma) or ta.crossunder(close, ma)
  // The `or` is lazy: ta.crossover runs only on the bars where the touch is false, ta.crossunder only where the
  // touch and the crossover are false; each call compares with its own previous call.
  const crossUp = callsite.crossover();
  const crossDown = callsite.crossunder();
  const plot0: { time: number; value: number; color: string }[] = [];
  let barsSince = NaN; // var int barsSince = na
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const touch = le(b.low, ma[i]) && le(ma[i], b.high);
    const touchOrCross = touch || crossUp(b.close, ma[i]) || crossDown(b.close, ma[i]);
    // barsSince := touchOrCross ? 0 : nz(barsSince[1]) + 1
    barsSince = touchOrCross ? 0 : (isNaN(barsSince) ? 0 : barsSince) + 1;
    plot0.push({ time: b.time, value: barsSince, color: color.white });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
  };
}

export const BarsSinceMaTest = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
