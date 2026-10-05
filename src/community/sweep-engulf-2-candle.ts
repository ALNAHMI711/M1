/**
 * Sweep Engulf 2 Candle
 *
 * Two-candle engulfing with a sweep of the previous extreme. Bullish: the low is below the previous low and either
 * the close is above the open of a previous bearish candle, or the close is above the close of a previous bullish
 * candle (green label below the bar). Bearish: the high is above the previous high and either the close is below the
 * close of a previous bearish candle, or the close is below the open of a previous bullish candle (red label above
 * the bar).
 *
 * Reference: "Sweep Engulf 2 Candle" by gastrophollic
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface SweepEngulf2CandleInputs {
  showBullish: boolean;
  showBearish: boolean;
  /** Alert switch of the Pine script (alert() calls, not ported): no effect on the outputs */
  enableAlert: boolean;
}

export const defaultInputs: SweepEngulf2CandleInputs = {
  showBullish: true,
  showBearish: true,
  enableAlert: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'showBullish', type: 'bool', title: 'Tampilkan Bullish Engulfing', defval: true },
  { id: 'showBearish', type: 'bool', title: 'Tampilkan Bearish Engulfing', defval: true },
  { id: 'enableAlert', type: 'bool', title: 'Aktifkan Notifikasi', defval: true },
];

// No plot(): the only outputs are plotshape markers
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Sweep Engulf 2 Candle',
  shortTitle: 'Sweep Engulf 2 Candle',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<SweepEngulf2CandleInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const green = String(color.green);
  const red = String(color.red);
  const markers: MarkerData[] = [];
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i];
    const p = bars[i - 1];
    const bullishEngulfing = lt(b.low, p.low)
      && ((gt(b.close, p.open) && lt(p.close, p.open)) || (gt(b.close, p.close) && gt(p.close, p.open)));
    const bearishEngulfing = gt(b.high, p.high)
      && ((lt(b.close, p.close) && lt(p.close, p.open)) || (lt(b.close, p.open) && gt(p.close, p.open)));
    if (cfg.showBullish && bullishEngulfing) {
      markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: green, size: 'tiny' });
    }
    if (cfg.showBearish && bearishEngulfing) {
      markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: red, size: 'tiny' });
    }
  }
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
  };
}

export const SweepEngulf2Candle = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
