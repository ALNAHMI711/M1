/**
 * Stop/Take Bounds
 *
 * Stop loss and take profit levels around the close for a long and a short position. The stop distance is
 * close * stop % / 100; the take profit distance is the stop distance * the take profit multiplier.
 * Long: stop = close - distance, take = close + distance * multiplier. Short: stop = close + distance,
 * take = close - distance * multiplier (drawn as step lines).
 *
 * Reference: "Stop/Take Bounds" by Y_Goldman
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface StopTakeBoundsInputs {
  /** Distance of the stop loss from the close, in % */
  stopDistancePercent: number;
  /** Multiplier of the stop distance for the take profit */
  takeProfitMultiplier: number;
}

export const defaultInputs: StopTakeBoundsInputs = {
  stopDistancePercent: 1.0,
  takeProfitMultiplier: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'stopDistancePercent', type: 'float', title: 'Stop Distance (%)', defval: 1.0 },
  { id: 'takeProfitMultiplier', type: 'float', title: 'Take Profit Multiplier', defval: 2.0 },
];

const STOP_COL = String(color.new(color.red, 60));
const TAKE_COL = String(color.new(color.green, 60));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Long Stop Loss', color: STOP_COL, lineWidth: 2 },
  { id: 'plot1', title: 'Long Take Profit', color: TAKE_COL, lineWidth: 2 },
  { id: 'plot2', title: 'Short Stop Loss', color: STOP_COL, lineWidth: 2, style: 'stepline' },
  { id: 'plot3', title: 'Short Take Profit', color: TAKE_COL, lineWidth: 2, style: 'stepline' },
];

export const metadata = {
  title: 'Stop/Take Bounds',
  shortTitle: 'Stop/Take Bounds',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<StopTakeBoundsInputs> = {}): IndicatorResult {
  const { stopDistancePercent, takeProfitMultiplier } = { ...defaultInputs, ...inputs };
  // The Pine script also computes a `direction` (ta.valuewhen of ta.cross(close, close[1])) that no output uses.
  const dist = bars.map((b) => b.close * (stopDistancePercent / 100));
  const line = (f: (c: number, d: number) => number, c: string) =>
    bars.map((b, i) => ({ time: b.time, value: f(b.close, dist[i]), color: c }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: line((c, d) => c - d, STOP_COL),
      plot1: line((c, d) => c + d * takeProfitMultiplier, TAKE_COL),
      plot2: line((c, d) => c + d, STOP_COL),
      plot3: line((c, d) => c - d * takeProfitMultiplier, TAKE_COL),
    },
  };
}

export const StopTakeBounds = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
