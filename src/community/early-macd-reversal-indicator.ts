/**
 * Early MACD Reversal Indicator
 *
 * MACD histogram (fast EMA - slow EMA, minus its signal EMA), coloured by sign and direction: rising above zero,
 * falling above zero, rising below zero, falling below zero. A buy signal is a negative histogram that turns up after
 * five falling negative bars; a sell signal is a positive histogram that turns down after five rising positive bars.
 * Signals colour the background and draw a triangle at the top (buy) or bottom (sell) of the pane.
 *
 * Reference: "Early MACD Reversal Indicator" by StockSignaler
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Created by Chris Guthrie © January 24, 2025
 */

import { ta, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';

export interface EarlyMacdReversalIndicatorInputs {
  /** Fast EMA length */
  fastLength: number;
  /** Slow EMA length */
  slowLength: number;
  /** Value source */
  src: SourceType;
  /** Signal EMA length */
  signalLength: number;
}

export const defaultInputs: EarlyMacdReversalIndicatorInputs = {
  fastLength: 12,
  slowLength: 26,
  src: 'close',
  signalLength: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast EMA Length', defval: 12 },
  { id: 'slowLength', type: 'int', title: 'Slow EMA Length', defval: 26 },
  { id: 'src', type: 'source', title: 'Value Source', defval: 'close' },
  { id: 'signalLength', type: 'int', title: 'Signal Smoothing', defval: 9 },
];

const GROW_ZONE = '#0096c4d0';
const BUY_ZONE = '#4cff16e1';
const SELL_ZONE = '#ff1010c2';
const FALL_ZONE = '#e220b2c4';
const BUY_BG = '#02b61d94';
const SELL_BG = '#f4000083';
const SHAPE_COL = String(color.rgb(255, 255, 255));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Histogram', color: GROW_ZONE, lineWidth: 4, style: 'histogram' },
];

export const metadata = {
  title: 'Early MACD Reversal Indicator',
  shortTitle: 'MACD Reversal',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

export function calculate(
  bars: Bar[],
  inputs: Partial<EarlyMacdReversalIndicatorInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const src = getSourceSeries(bars, cfg.src);

  const fastMa = ta.ema(src, cfg.fastLength);
  const slowMa = ta.ema(src, cfg.slowLength);
  const macd = fastMa.sub(slowMa);
  const signal = ta.ema(macd, cfg.signalLength);
  const hist = macd.sub(signal).toArray().map((v) => v ?? NaN);
  const h = (i: number, k: number) => (i - k >= 0 ? hist[i - k] : NaN);

  const plot0: Array<{ time: number; value: number; color: string }> = [];
  const markers: MarkerData[] = [];
  const bgColors: BgColorData[] = [];
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    const cur = hist[i];
    const rising = lt(h(i, 1), cur); // hist[1] < hist
    const col = ge(cur, 0) ? (rising ? GROW_ZONE : SELL_ZONE) : (rising ? BUY_ZONE : FALL_ZONE);
    plot0.push({ time: t, value: Number.isFinite(cur) ? cur : NaN, color: col });

    const buySig = lt(cur, 0) && lt(h(i, 1), cur) && lt(h(i, 1), 0) && lt(h(i, 2), 0) && lt(h(i, 3), 0)
      && lt(h(i, 4), 0) && lt(h(i, 5), 0) && lt(h(i, 1), h(i, 2)) && lt(h(i, 2), h(i, 3))
      && lt(h(i, 3), h(i, 4)) && lt(h(i, 4), h(i, 5));
    const sellSig = gt(cur, 0) && gt(h(i, 1), cur) && gt(h(i, 1), 0) && gt(h(i, 2), 0) && gt(h(i, 3), 0)
      && gt(h(i, 4), 0) && gt(h(i, 5), 0) && gt(h(i, 1), h(i, 2)) && gt(h(i, 2), h(i, 3))
      && gt(h(i, 3), h(i, 4)) && gt(h(i, 4), h(i, 5));

    // bgcolor(buySig ? #02b61d94 : na); bgcolor(sellSig ? #f4000083 : na): the later call is drawn on top
    if (sellSig) bgColors.push({ time: t, color: SELL_BG });
    else if (buySig) bgColors.push({ time: t, color: BUY_BG });

    // plotshape(buySig ? 0.01 : na, "Buy Entry", shape.triangleup, location.top, size.small, white)
    if (buySig) markers.push({ time: t, position: 'top', shape: 'triangleUp', color: SHAPE_COL, size: 'small' });
    // plotshape(sellSig ? 0.01 : na, "Short Entry", shape.triangledown, location.bottom, size.small, white)
    if (sellSig) markers.push({ time: t, position: 'bottom', shape: 'triangleDown', color: SHAPE_COL, size: 'small' });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
    markers,
    bgColors,
  };
}

export const EarlyMacdReversalIndicator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
