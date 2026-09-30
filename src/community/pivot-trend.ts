/**
 * Pivot Trend [ChartPrime]
 *
 * Pivot highs of high + ATR(200) * offset and pivot lows of low - ATR(200) * offset give an upper and a lower band
 * (last pivot value). The trend is up while close stays above the lower band and turns down when close falls below
 * it; while the trend line follows the upper band, the trend turns up again when close rises above the upper band.
 * The trend line is the lower band in an up trend and the upper band in a down trend, with a gradient fill to hl2
 * and 🅑 / 🅢 marks on the trend changes.
 *
 * Reference: "Pivot Trend [ChartPrime]" by ChartPrime
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface PivotTrendInputs {
  /** Pivot left bars */
  leftBars: number;
  /** Pivot right bars */
  rightBars: number;
  /** ATR multiplier added to the high / taken from the low before the pivot search */
  offset: number;
}

export const defaultInputs: PivotTrendInputs = {
  leftBars: 10,
  rightBars: 10,
  offset: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'leftBars', type: 'int', title: 'Left Bars', defval: 10 },
  { id: 'rightBars', type: 'int', title: 'Right Bars', defval: 10 },
  { id: 'offset', type: 'float', title: 'Offset', defval: 2, step: 0.01 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Up Trend', color: color.red, lineWidth: 1, style: 'linebr' },
  { id: 'plot1', title: 'Down Trend', color: color.blue, lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'Trend', color: 'transparent', lineWidth: 1 },
  { id: 'plot3', title: 'hl2', color: 'transparent', lineWidth: 1 },
];

export const metadata = {
  title: 'Pivot Trend [ChartPrime]',
  shortTitle: 'Pivot Trend',
  overlay: true,
};

export function calculate(
  bars: Bar[],
  inputs: Partial<PivotTrendInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const { leftBars, rightBars, offset } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // atr = ta.atr(200); p_high = ta.pivothigh(high + atr * Offset, ...); p_low = ta.pivotlow(low - atr * Offset, ...)
  const atr = ta.atr(bars, 200).toArray();
  const hiSrc = bars.map((b, i) => b.high + (atr[i] ?? NaN) * offset);
  const loSrc = bars.map((b, i) => b.low - (atr[i] ?? NaN) * offset);
  const pHigh = ta.pivothigh(Series.fromArray(bars, hiSrc), leftBars, rightBars).toArray();
  const pLow = ta.pivotlow(Series.fromArray(bars, loSrc), leftBars, rightBars).toArray();

  const trend: number[] = new Array(n);
  const trendLine: number[] = new Array(n);
  let phy = NaN; // var float phy: last pivot high (upperBand)
  let ply = NaN; // var float ply: last pivot low (lowerBand)
  for (let i = 0; i < n; i++) {
    // prevUpperBand = nz(upperBand[1]): phy before this bar's update
    const prevUpper = isNaN(phy) ? 0 : phy;
    // if bool(p_high): phy := p_high (bool(na) and bool(0) are false)
    const ph = pHigh[i] ?? NaN;
    const pl = pLow[i] ?? NaN;
    if (!isNaN(ph) && ph !== 0) phy = ph;
    if (!isNaN(pl) && pl !== 0) ply = pl;

    // prevTrend = Trend[1]; if prevTrend == prevUpperBand: trend := close > upperBand ? 1 : -1
    // else trend := close < lowerBand ? -1 : 1   (a comparison with na is false)
    const prevTrend = i > 0 ? trendLine[i - 1] : NaN;
    const close = bars[i].close;
    const t = !isNaN(prevTrend) && prevTrend === prevUpper ? (close > phy ? 1 : -1) : (close < ply ? -1 : 1);
    trend[i] = t;
    // Trend := trend == 1 ? lowerBand : upperBand
    trendLine[i] = t === 1 ? ply : phy;
  }

  const col = (i: number) => (trend[i] === 1 ? color.blue : color.red);
  const hl2 = bars.map((b) => (b.high + b.low) / 2);
  const markers: MarkerData[] = [];
  const up: { time: number; value: number; color: string }[] = [];
  const down: { time: number; value: number; color: string }[] = [];
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    // plot(trend < 0 ? Trend : na, 'Up Trend', color, style_linebr); plot(trend < 0 ? na : Trend, 'Down Trend', ...)
    up.push({ time: t, value: trend[i] < 0 ? trendLine[i] : NaN, color: col(i) });
    down.push({ time: t, value: trend[i] < 0 ? NaN : trendLine[i], color: col(i) });
    // plotchar(ta.crossover(trend, 0) ? Trend : na, 'Buy', '🅑', location.absolute, color.blue, size.small)
    // plotchar(ta.crossunder(trend, 0) ? Trend : na, 'Sell', '🅢', location.absolute, color.red, size.small)
    if (i > 0 && !isNaN(trendLine[i])) {
      if (trend[i] > 0 && trend[i - 1] <= 0) {
        markers.push({ time: t, position: 'atPriceMiddle', price: trendLine[i], shape: 'circle', color: 'transparent',
          text: '🅑', textColor: color.blue, size: 'small' });
      } else if (trend[i] < 0 && trend[i - 1] >= 0) {
        markers.push({ time: t, position: 'atPriceMiddle', price: trendLine[i], shape: 'circle', color: 'transparent',
          text: '🅢', textColor: color.red, size: 'small' });
      }
    }
  }

  // p1 = plot(Trend, color = na); p2 = plot(hl2, color = na)
  // fill(p1, p2, Trend, hl2, color.new(color, 85), color.new(color, 99))
  const topColor = bars.map((_b, i): string | null => String(color.new(col(i), 85)));
  const bottomColor = bars.map((_b, i): string | null => String(color.new(col(i), 99)));
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: up,
      plot1: down,
      plot2: bars.map((b, i) => ({ time: b.time, value: trendLine[i] })),
      plot3: bars.map((b, i) => ({ time: b.time, value: hl2[i] })),
    },
    fills: [{
      plot1: 'plot2', plot2: 'plot3',
      gradient: { topValue: trendLine, bottomValue: hl2, topColor, bottomColor },
    }],
    markers,
  };

}

export const PivotTrend = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
