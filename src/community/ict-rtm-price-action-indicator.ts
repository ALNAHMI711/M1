/**
 * ICT & RTM Price Action Indicator
 *
 * Supply zone = highest high of 50 bars, demand zone = lowest low of 50 bars (both plotted). A bullish reversal bar
 * closes above its SMA(length) and above the demand zone, a bearish reversal bar closes below the SMA and below the
 * supply zone. A reversal is confirmed on the next bar when that bar closes in the same direction (close > open or
 * close < open) and the reversal bar had a volume above minVolumeFactor times the 20-bar average volume. A state
 * (in buy / in sell) gives "BUY" and "SELL" labels: a buy when no state is open, a switch from buy to sell on a
 * bearish confirmation and from sell to buy on a bullish confirmation. A "TRADE" triangle marks a confirmation
 * beyond the zone while no state is open.
 *
 * Reference: "ICT & RTM Price Action Indicator" by behradmojtahedi
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface IctRtmPriceActionIndicatorInputs {
  /** Moving average length */
  length: number;
  /** Minimum volume factor */
  minVolumeFactor: number;
}

export const defaultInputs: IctRtmPriceActionIndicatorInputs = {
  length: 14,
  minVolumeFactor: 1.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'طول میانگین متحرک', defval: 14, min: 1 },
  { id: 'minVolumeFactor', type: 'float', title: 'ضریب حداقل حجم', defval: 1.5, min: 1.0, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'نواحی عرضه', color: color.red, lineWidth: 1 },
  { id: 'plot1', title: 'نواحی تقاضا', color: color.green, lineWidth: 1 },
];

export const metadata = {
  title: 'ICT & RTM Price Action Indicator',
  shortTitle: 'ICT & RTM Price Action Indicator',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<IctRtmPriceActionIndicatorInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, minVolumeFactor } = cfg;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  const smaValue = A(ta.sma(S(bars.map((b) => b.close)), length));
  const highLevel = A(ta.highest(S(bars.map((b) => b.high)), 50));
  const lowLevel = A(ta.lowest(S(bars.map((b) => b.low)), 50));
  const volume = bars.map((b) => b.volume ?? NaN);
  const avgVolume = A(ta.sma(S(volume), 20));

  const plot0: { time: number; value: number }[] = [];
  const plot1: { time: number; value: number }[] = [];
  const markers: MarkerData[] = [];
  let isInBuy = false; // var bool isInBuy = false
  let isInSell = false; // var bool isInSell = false
  let prevBullRev = false; // bullishReversal[1] (na on bar 0: false)
  let prevBearRev = false;
  let prevVolFilter = false; // volumeFilter[1]
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const t = b.time;
    const supplyZone = highLevel[i];
    const demandZone = lowLevel[i];
    plot0.push({ time: t, value: supplyZone });
    plot1.push({ time: t, value: demandZone });

    const volumeFilter = gt(volume[i], avgVolume[i] * minVolumeFactor);
    const bullishReversal = gt(b.close, smaValue[i]) && gt(b.close, lowLevel[i]);
    const bearishReversal = lt(b.close, smaValue[i]) && lt(b.close, highLevel[i]);
    const bullishConfirm = prevBullRev && gt(b.close, b.open) && prevVolFilter;
    const bearishConfirm = prevBearRev && lt(b.close, b.open) && prevVolFilter;
    const buyExit = bearishConfirm;
    const sellExit = bullishConfirm;

    let showBuySignal = false;
    let showSellSignal = false;
    if (bullishConfirm && !isInBuy && !isInSell) {
      isInBuy = true;
      isInSell = false;
      showBuySignal = true;
    }
    if (buyExit && isInBuy) {
      isInBuy = false;
      if (bearishConfirm) {
        isInSell = true;
        showSellSignal = true;
      }
    }
    if (sellExit && isInSell) {
      isInSell = false;
      if (bullishConfirm) {
        isInBuy = true;
        showBuySignal = true;
      }
    }
    const showCombinedSignal = (bullishConfirm && gt(b.close, demandZone) && !isInBuy && !isInSell)
      || (bearishConfirm && lt(b.close, supplyZone) && !isInSell && !isInBuy);

    // plotshape(..., location.belowbar / abovebar, shape.labelup / labeldown / triangledown), default text colour
    if (showBuySignal) {
      markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'BUY', textColor: color.blue });
    }
    if (showSellSignal) {
      markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL', textColor: color.blue });
    }
    if (showCombinedSignal) {
      markers.push({ time: t, position: 'belowBar', shape: 'triangleDown', color: color.blue, text: 'TRADE', textColor: color.blue });
    }

    prevBullRev = bullishReversal;
    prevBearRev = bearishReversal;
    prevVolFilter = volumeFilter;
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1 },
    markers,
  };
}

export const IctRtmPriceActionIndicator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
