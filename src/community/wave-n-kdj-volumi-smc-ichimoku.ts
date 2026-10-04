/**
 * Wave N + KDJ + Volumi + SMC + Ichimoku
 *
 * KDJ: rsv = (close - lowest(low, 9)) / (highest(high, 9) - lowest(low, 9)) * 100, K = sma(rsv, 3),
 * D = sma(K, 3), J = 3K - 2D. An N wave up is a higher high and higher low followed by a high above the previous
 * high (N wave down: the mirror). BUY: N wave up, J > 50, volume above its 20-bar EMA and close above the
 * Kijun-sen; SELL: the mirror. Early warnings mark J crossing 50. The background shows BUY / SELL bars; the
 * Ichimoku Tenkan-sen (9), Kijun-sen (26), Senkou Span A and Span B (52) are drawn without offset.
 *
 * Reference: "Wave N + KDJ + Volumi + SMC + Ichimoku" by Nikus63
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Nikus63
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';

// The Pine script has no inputs
export type WaveNKdjVolumiSmcIchimokuInputs = Record<string, never>;

export const defaultInputs: WaveNKdjVolumiSmcIchimokuInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Tenkan-sen', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'Kijun-sen', color: color.red, lineWidth: 1 },
  { id: 'plot2', title: 'Senkou Span A', color: color.green, lineWidth: 1 },
  { id: 'plot3', title: 'Senkou Span B', color: color.maroon, lineWidth: 1 },
];

export const metadata = {
  title: 'Wave N + KDJ + Volumi + SMC + Ichimoku',
  shortTitle: 'Wave N + KDJ + Volumi + SMC + Ichimoku',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  _inputs: Partial<WaveNKdjVolumiSmcIchimokuInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } {
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const high = S(bars.map((b) => b.high));
  const low = S(bars.map((b) => b.low));
  const hi = (len: number) => A(ta.highest(high, len));
  const lo = (len: number) => A(ta.lowest(low, len));

  // KDJ; a plain division (x / 0 is +-infinity, 0 / 0 na; ta.sma skips them)
  const hh = hi(9);
  const ll = lo(9);
  const rsv = bars.map((b, i) => ((b.close - ll[i]) / (hh[i] - ll[i])) * 100);
  const K = A(ta.sma(S(rsv), 3));
  const D = A(ta.sma(S(K), 3));
  const J = K.map((k, i) => 3 * k - 2 * D[i]);

  const emaVol = A(ta.ema(S(bars.map((b) => b.volume ?? NaN)), 20));

  // Ichimoku (no offset)
  const mid = (len: number) => {
    const h = hi(len);
    const l = lo(len);
    return h.map((v, i) => (v + l[i]) / 2);
  };
  const conversionLine = mid(9);
  const baseLine = mid(26);
  const leadingSpanA = conversionLine.map((v, i) => (v + baseLine[i]) / 2);
  const leadingSpanB = mid(52);

  const earlyUp = A(ta.crossover(S(J), 50));
  const earlyDown = A(ta.crossunder(S(J), 50));

  const markers: MarkerData[] = [];
  const bgColors: BgColorData[] = [];
  const buyBg = String(color.new(color.green, 80));
  const sellBg = String(color.new(color.red, 80));
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const h1 = i >= 1 ? bars[i - 1].high : NaN;
    const h2 = i >= 2 ? bars[i - 2].high : NaN;
    const l1 = i >= 1 ? bars[i - 1].low : NaN;
    const l2 = i >= 2 ? bars[i - 2].low : NaN;
    const nWaveUp = lt(h2, h1) && gt(l1, l2) && gt(b.high, h1);
    const nWaveDown = gt(l2, l1) && lt(h1, h2) && lt(b.low, l1);
    const aboveVol = gt(b.volume ?? NaN, emaVol[i]);
    const buy = nWaveUp && gt(J[i], 50) && aboveVol && gt(b.close, baseLine[i]);
    const sell = nWaveDown && lt(J[i], 50) && aboveVol && lt(b.close, baseLine[i]);
    if (buy) markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: color.green, size: 'small' });
    if (sell) markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: color.red, size: 'small' });
    if (earlyUp[i] === 1) markers.push({ time: b.time, position: 'belowBar', shape: 'cross', color: color.green, size: 'tiny' });
    if (earlyDown[i] === 1) markers.push({ time: b.time, position: 'aboveBar', shape: 'cross', color: color.red, size: 'tiny' });
    // bgcolor(buySignal ? green 80 : na); bgcolor(sellSignal ? red 80 : na)
    if (buy) bgColors.push({ time: b.time, color: buyBg });
    if (sell) bgColors.push({ time: b.time, color: sellBg });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: conversionLine[i], color: color.blue })),
      plot1: bars.map((b, i) => ({ time: b.time, value: baseLine[i], color: color.red })),
      plot2: bars.map((b, i) => ({ time: b.time, value: leadingSpanA[i], color: color.green })),
      plot3: bars.map((b, i) => ({ time: b.time, value: leadingSpanB[i], color: color.maroon })),
    },
    markers,
    bgColors,
  };
}

export const WaveNKdjVolumiSmcIchimoku = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
