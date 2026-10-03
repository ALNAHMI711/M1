/**
 * Pullback Depth
 *
 * Number of bars back to the last bar with a lower low than the current low, searched over at most `lookback` bars
 * (and at most bar_index bars). When no lower low is found the count is the search length. The histogram shows the
 * count as a negative value: a deep bar means the current low is the lowest for a long time.
 *
 * Reference: "Pullback Depth" by TradeStation
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface PullbackDepthInputs {
  /** Maximum number of bars searched back */
  lookback: number;
}

export const defaultInputs: PullbackDepthInputs = {
  lookback: 125,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'Max Lookback Bars', defval: 125, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bars Since Lower Low', color: color.red, lineWidth: 2, style: 'histogram' },
];

export const metadata = {
  title: 'Pullback Depth',
  shortTitle: 'Pullback Depth',
  overlay: false,
};

/** Pine float comparisons: a < b only when b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(bars: Bar[], inputs: Partial<PullbackDepthInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };

  const plot0 = bars.map((b, i) => {
    // actualLookback = math.max(1, math.min(lookback, bar_index))
    const actualLookback = Math.max(1, Math.min(cfg.lookback, i));
    let barsBack = NaN;
    if (i > 0) {
      barsBack = actualLookback;
      for (let k = 1; k <= actualLookback; k++) {
        // low[k] < low (low[k] before the first bar is na: false)
        if (i - k >= 0 && lt(bars[i - k].low, b.low)) {
          barsBack = k;
          break;
        }
      }
    }
    return { time: b.time, value: -barsBack, color: color.red };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
    hlines: [{ value: 0, options: { title: 'Zero', color: String(color.new(color.gray, 70)), linestyle: 'dashed' } }],
  };
}

export const PullbackDepth = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
