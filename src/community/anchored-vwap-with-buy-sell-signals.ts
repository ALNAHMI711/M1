/**
 * Anchored VWAP with Buy/Sell Signals
 *
 * Volume-weighted average of hlc3 from the anchor date: the sums of volume and of volume * hlc3 start on the first
 * bar whose open time is at or after the anchor (na before it). A BUY label is drawn when the close crosses over the
 * AVWAP, a SELL label when it crosses under, with a light green / red background on these bars.
 *
 * Reference: "Anchored VWAP with Buy/Sell Signals" by kmootoo89
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';

export interface AnchoredVwapWithBuySellSignalsInputs {
  /** Anchor date (UNIX ms, Pine input.time) */
  anchorDate: number;
}

/** timestamp('2023-10-01 00:00') (UTC) */
const DEFAULT_ANCHOR = Date.UTC(2023, 9, 1);

export const defaultInputs: AnchoredVwapWithBuySellSignalsInputs = {
  anchorDate: DEFAULT_ANCHOR,
};

export const inputConfig: InputConfig[] = [
  { id: 'anchorDate', type: 'time', title: 'Anchor Date', defval: DEFAULT_ANCHOR },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'AVWAP', color: color.blue, lineWidth: 2 },
];

export const metadata = {
  title: 'Anchored VWAP with Buy/Sell Signals',
  shortTitle: 'Anchored VWAP with Buy/Sell Signals',
  overlay: true,
};

export function calculate(
  bars: Bar[],
  inputs: Partial<AnchoredVwapWithBuySellSignalsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const avwap: number[] = new Array(n);
  let cumVol = NaN; // var float cumulative_volume = na
  let cumPv = NaN; // var float cumulative_price_volume = na
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    if (b.time * 1000 >= cfg.anchorDate) {
      // nz(cumulative) + volume (an na volume gives na, and the sums restart from 0 on the next bar)
      cumVol = (isNaN(cumVol) ? 0 : cumVol) + (b.volume ?? NaN);
      cumPv = (isNaN(cumPv) ? 0 : cumPv) + ((b.volume ?? NaN) * (b.high + b.low + b.close)) / 3;
    } else {
      cumVol = NaN;
      cumPv = NaN;
    }
    // A plain division: x / 0 is +-infinity (0 / 0 na); the crossings use it, the plot shows na
    avwap[i] = cumPv / cumVol;
  }

  const S = (a: number[]) => Series.fromArray(bars, a);
  const closeS = S(bars.map((b) => b.close));
  const avwapS = S(avwap);
  const buy = ta.crossover(closeS, avwapS).toArray();
  const sell = ta.crossunder(closeS, avwapS).toArray();

  const markers: MarkerData[] = [];
  const bgColors: BgColorData[] = [];
  const buyBg = String(color.new(color.green, 90));
  const sellBg = String(color.new(color.red, 90));
  for (let i = 0; i < n; i++) {
    const time = bars[i].time;
    // plotshape(buy_signal, 'Buy Signal', location.belowbar, color.green, shape.labelup, text = 'BUY', size.small);
    // no textcolor: the Pine default text colour (color.blue)
    if (buy[i]) {
      markers.push({ time, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'BUY', textColor: color.blue, size: 'small' });
    }
    if (sell[i]) {
      markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL', textColor: color.blue, size: 'small' });
    }
    // bgcolor(buy_signal ? color.new(color.green, 90) : na); bgcolor(sell_signal ? color.new(color.red, 90) : na)
    if (buy[i]) bgColors.push({ time, color: buyBg });
    if (sell[i]) bgColors.push({ time, color: sellBg });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: Number.isFinite(avwap[i]) ? avwap[i] : NaN, color: color.blue })),
    },
    markers,
    bgColors,
  };
}

export const AnchoredVwapWithBuySellSignals = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
