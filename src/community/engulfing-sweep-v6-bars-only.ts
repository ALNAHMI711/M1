/**
 * Engulfing + Sweep (Confirmed Only), bars only
 *
 * A bullish engulfing sweep: a bullish candle after a bearish one, whose close is above the previous open and close
 * and whose low is below the previous low (optional minimum body / range ratio). The bearish case is the mirror
 * (close below the previous body, high above the previous high). The signal is confirmed on the next bar (with the
 * "Require next candle confirmation" option, that bar must close in the same direction); the engulfing candle is
 * then coloured (barcolor with offset -1: the colour of bar i is drawn on bar i - 1).
 *
 * Reference: "Engulfing + Sweep (Confirmed Only) v6 — bars only" by fanta-grapefruit
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface EngulfingSweepV6BarsOnlyInputs {
  enableBullish: boolean;
  enableBearish: boolean;
  /** Minimum body / range ratio (0 = any size) */
  minBodySize: number;
  requireConfirmation: boolean;
  bullColor: string;
  bearColor: string;
}

export const defaultInputs: EngulfingSweepV6BarsOnlyInputs = {
  enableBullish: true,
  enableBearish: true,
  minBodySize: 0.0,
  requireConfirmation: true,
  bullColor: color.lime,
  bearColor: color.red,
};

export const inputConfig: InputConfig[] = [
  { id: 'enableBullish', type: 'bool', title: 'Bullish Engulfing + Low Sweep', defval: true },
  { id: 'enableBearish', type: 'bool', title: 'Bearish Engulfing + High Sweep', defval: true },
  { id: 'minBodySize', type: 'float', title: 'Min candle body size (0 = any size)', defval: 0.0, min: 0.0, max: 1.0, step: 0.05 },
  { id: 'requireConfirmation', type: 'bool', title: 'Require next candle confirmation', defval: true },
  { id: 'bullColor', type: 'color', title: 'Bullish color', defval: color.lime },
  { id: 'bearColor', type: 'color', title: 'Bearish color', defval: color.red },
];

// Bar colours only (barcolor)
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Engulfing + Sweep (Confirmed Only) v6 — bars only',
  shortTitle: 'Engulfing + Sweep (Confirmed Only) v6 — bars only',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

export function calculate(
  bars: Bar[],
  inputs: Partial<EngulfingSweepV6BarsOnlyInputs> = {},
): Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // Conditions of each bar (read one bar back below)
  const bullEngulf: boolean[] = new Array(n).fill(false);
  const bearEngulf: boolean[] = new Array(n).fill(false);
  for (let i = 1; i < n; i++) {
    const b = bars[i];
    const p = bars[i - 1];
    const valid = !isNaN(p.open) && !isNaN(p.close);
    const body2 = Math.abs(b.close - b.open);
    const range2 = b.high - b.low;
    // minBodySize <= 0.0 or (range2 > 0 and body2 / range2 >= minBodySize)
    const body2OK = le(cfg.minBodySize, 0) || (gt(range2, 0) && ge(body2 / range2, cfg.minBodySize));
    const bullPrev = gt(p.close, p.open);
    const bearPrev = lt(p.close, p.open);
    const bullNow = gt(b.close, b.open);
    const bearNow = lt(b.close, b.open);
    const bullEngulfBody = gt(b.close, Math.max(p.open, p.close));
    const bearEngulfBody = lt(b.close, Math.min(p.open, p.close));
    const sweepPrevLow = lt(b.low, p.low);
    const sweepPrevHigh = gt(b.high, p.high);
    bullEngulf[i] = cfg.enableBullish && valid && bullNow && bullEngulfBody && sweepPrevLow && bearPrev && body2OK;
    bearEngulf[i] = cfg.enableBearish && valid && bearNow && bearEngulfBody && sweepPrevHigh && bullPrev && body2OK;
  }

  const barColors: BarColorData[] = [];
  for (let i = 2; i < n; i++) {
    const b = bars[i];
    // Historical bars are confirmed (barstate.isconfirmed)
    const confirmationBull = cfg.requireConfirmation ? gt(b.close, b.open) : true;
    const confirmationBear = cfg.requireConfirmation ? lt(b.close, b.open) : true;
    const any = cfg.enableBullish || cfg.enableBearish;
    const bullSignal = bullEngulf[i - 1] && confirmationBull && any;
    const bearSignal = bearEngulf[i - 1] && confirmationBear && any;
    // barcolor(..., offset = -1): drawn on the engulfing bar i - 1
    if (bullSignal) barColors.push({ time: bars[i - 1].time, color: cfg.bullColor });
    else if (bearSignal) barColors.push({ time: bars[i - 1].time, color: cfg.bearColor });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    barColors,
  };
}

export const EngulfingSweepV6BarsOnly = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
