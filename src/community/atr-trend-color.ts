/**
 * ATR Trend Color
 *
 * An ATR trailing stop: with loss = atr(period) * multiplier, the stop rises to max(stop, close - loss) while the
 * close and the previous close stay above it, falls to min(stop, close + loss) while both stay below it, and flips
 * to close - loss / close + loss when the close crosses it. The line is lime when the close is above the stop, red
 * when it is below and gray otherwise.
 *
 * Reference: "ATR Trend Color" by Aleksin_Aleksandar
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Aleksin_Aleksandar
 */

import { ta, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface AtrTrendColorInputs {
  /** ATR period */
  nATRPeriod1: number;
  /** ATR multiplier */
  nATRMultip1: number;
}

export const defaultInputs: AtrTrendColorInputs = {
  nATRPeriod1: 7,
  nATRMultip1: 3.1,
};

export const inputConfig: InputConfig[] = [
  { id: 'nATRPeriod1', type: 'int', title: 'ATR Period', defval: 7 },
  { id: 'nATRMultip1', type: 'float', title: 'ATR Multiplier', defval: 3.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ATR Trail Stop', color: color.lime, lineWidth: 2 },
];

export const metadata = {
  title: 'ATR Trend Color',
  shortTitle: 'ATR Trend Color',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const nz = (v: number) => (Number.isFinite(v) ? v : 0);

export function calculate(bars: Bar[], inputs: Partial<AtrTrendColorInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const atr = ta.atr(bars, cfg.nATRPeriod1).toArray().map((v) => v ?? NaN);
  const trail: number[] = new Array(n);
  let prevTrail = NaN; // trail1[1]
  for (let i = 0; i < n; i++) {
    const close = bars[i].close;
    const prevClose = i > 0 ? bars[i - 1].close : NaN;
    const nLoss = atr[i] * cfg.nATRMultip1;
    const p = nz(prevTrail);
    // math.max / math.min with an na argument give na
    let t: number;
    if (gt(close, p) && gt(prevClose, p)) t = Math.max(p, close - nLoss);
    else if (lt(close, p) && lt(prevClose, p)) t = Math.min(p, close + nLoss);
    else if (gt(close, p)) t = close - nLoss;
    else t = close + nLoss;
    trail[i] = t;
    prevTrail = t;
  }

  const plot0 = bars.map((b, i) => {
    const bullish = gt(b.close, trail[i]);
    const bearish = lt(b.close, trail[i]);
    const c = bullish ? color.lime : bearish ? color.red : color.gray;
    return { time: b.time, value: trail[i], color: c };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
  };
}

export const AtrTrendColor = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
