/**
 * EMA + RSI Autotrade Webhook
 *
 * A fast and a slow EMA of the close and the RSI of the close. A long entry (green triangle below the bar) is a
 * crossover of the fast EMA above the slow EMA with the RSI above the long threshold; a short entry (red triangle
 * above the bar) is a crossunder with the RSI below the short threshold.
 *
 * Reference: "EMA + RSI Autotrade Webhook - Varun" by varuns_back
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface EmaRsiAutotradeWebhookVarunInputs {
  /** Fast EMA length */
  emaFast: number;
  /** Slow EMA length */
  emaSlow: number;
  /** RSI length */
  rsiLength: number;
  /** RSI level a long entry must be above */
  rsiLong: number;
  /** RSI level a short entry must be below */
  rsiShort: number;
}

export const defaultInputs: EmaRsiAutotradeWebhookVarunInputs = {
  emaFast: 9,
  emaSlow: 21,
  rsiLength: 14,
  rsiLong: 52,
  rsiShort: 48,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaFast', type: 'int', title: 'Fast EMA', defval: 9, min: 1 },
  { id: 'emaSlow', type: 'int', title: 'Slow EMA', defval: 21, min: 1 },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'rsiLong', type: 'int', title: 'RSI Long Threshold', defval: 52, min: 1, max: 100 },
  { id: 'rsiShort', type: 'int', title: 'RSI Short Threshold', defval: 48, min: 1, max: 100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA 9', color: color.blue, lineWidth: 2 },
  { id: 'plot1', title: 'EMA 21', color: color.red, lineWidth: 2 },
];

export const metadata = {
  title: 'EMA + RSI Autotrade Webhook',
  shortTitle: 'EMA + RSI Autotrade Webhook',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<EmaRsiAutotradeWebhookVarunInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const close = Series.fromArray(bars, bars.map((b) => b.close));
  const emaF = A(ta.ema(close, cfg.emaFast));
  const emaS = A(ta.ema(close, cfg.emaSlow));
  const rsi = A(ta.rsi(close, cfg.rsiLength));

  const markers: MarkerData[] = [];
  // ta.crossover / ta.crossunder compare exactly, with the last bar where both values were not na
  let prevA = NaN;
  let prevB = NaN;
  for (let i = 0; i < n; i++) {
    const a = emaF[i];
    const b = emaS[i];
    const valid = !isNaN(a) && !isNaN(b);
    const bullCross = valid && !isNaN(prevA) && a > b && prevA <= prevB;
    const bearCross = valid && !isNaN(prevA) && a < b && prevA >= prevB;
    if (valid) {
      prevA = a;
      prevB = b;
    }
    // longEntry = bullCross and rsi > rsi_long; shortEntry = bearCross and rsi < rsi_short
    if (bullCross && gt(rsi[i], cfg.rsiLong)) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'small' });
    }
    if (bearCross && gt(cfg.rsiShort, rsi[i])) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'small' });
    }
  }

  const plot0 = bars.map((b, i) => ({ time: b.time, value: emaF[i] }));
  const plot1 = bars.map((b, i) => ({ time: b.time, value: emaS[i] }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1 },
    markers,
  };
}

export const EmaRsiAutotradeWebhookVarun = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
