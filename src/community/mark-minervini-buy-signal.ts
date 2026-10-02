/**
 * Mark Minervini Buy Signal
 *
 * Mark Minervini trend template on the close: SMAs 10 / 20 / 50 / 150 / 200. A buy signal needs the close above
 * the 50, 150 and 200 SMAs, the 150 SMA above the 200 SMA, the 200 SMA above its value 20 bars ago, the 50 SMA
 * above the 150 and 200 SMAs, the close at least 25 % above the 252-bar low and between 75 % and 95 % of the
 * 252-bar high, a percent rank (100 bars) of the 100-bar price change of at least 70, and the volume above its
 * 50-bar SMA. A signal bar gets a large triangle below the bar and a green background.
 *
 * Reference: "Mark Minervini Buy Signal" by Dr_Leong_Yee_Rock
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';

// The Pine script has no inputs
export interface MarkMinerviniBuySignalInputs {}

export const defaultInputs: MarkMinerviniBuySignalInputs = {};

export const inputConfig: InputConfig[] = [];

const MA10_COL = 'rgb(233, 243, 33)';
const MA20_COL = 'rgb(33, 229, 243)';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '10-day MA', color: MA10_COL, lineWidth: 1 },
  { id: 'plot1', title: '20-day MA', color: MA20_COL, lineWidth: 1 },
  { id: 'plot2', title: '50-day MA', color: color.blue, lineWidth: 1 },
  { id: 'plot3', title: '150-day MA', color: color.green, lineWidth: 1 },
  { id: 'plot4', title: '200-day MA', color: color.red, lineWidth: 1 },
];

export const metadata = {
  title: 'Mark Minervini Buy Signal',
  shortTitle: 'Mark Minervini Buy Signal',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => ge(b, a);

export function calculate(
  bars: Bar[],
  _inputs: Partial<MarkMinerviniBuySignalInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } {
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const close = bars.map((b) => b.close);
  const closeS = S(close);

  const ma10 = A(ta.sma(closeS, 10));
  const ma20 = A(ta.sma(closeS, 20));
  const ma50 = A(ta.sma(closeS, 50));
  const ma150 = A(ta.sma(closeS, 150));
  const ma200 = A(ta.sma(closeS, 200));
  const high52 = A(ta.highest(S(bars.map((b) => b.high)), 252));
  const low52 = A(ta.lowest(S(bars.map((b) => b.low)), 252));
  // priceChange = (close - close[100]) / close[100] * 100 (a plain division)
  const priceChange = close.map((c, i) => (i >= 100 ? ((c - close[i - 100]) / close[i - 100]) * 100 : NaN));
  const rsRanking = A(ta.percentrank(S(priceChange), 100));
  const volume = bars.map((b) => b.volume ?? NaN);
  const volSma = A(ta.sma(S(volume), 50));

  const markers: MarkerData[] = [];
  const bgColors: BgColorData[] = [];
  const bg = String(color.new(color.green, 90));
  for (let i = 0; i < n; i++) {
    const c = close[i];
    const ma150AboveMa200 = gt(ma150[i], ma200[i]);
    const ma200TrendingUp = gt(ma200[i], i >= 20 ? ma200[i - 20] : NaN);
    const ma50AboveLongMAs = gt(ma50[i], ma150[i]) && gt(ma50[i], ma200[i]);
    const priceAboveMa50 = gt(c, ma50[i]);
    const priceAboveLongMAs = gt(c, ma150[i]) && gt(c, ma200[i]);
    const price25PercentAboveLow = ge(c, low52[i] * 1.25);
    const priceWithin25PercentOfHigh = ge(c, high52[i] * 0.75) && le(c, high52[i] * 0.95);
    const rsRankingPass = ge(rsRanking[i], 70);
    const volumeIncreasing = gt(volume[i], volSma[i]);
    const minerviniCriteria = priceAboveLongMAs && ma150AboveMa200 && ma200TrendingUp && ma50AboveLongMAs
      && priceAboveMa50 && price25PercentAboveLow && priceWithin25PercentOfHigh && rsRankingPass && volumeIncreasing;
    if (minerviniCriteria) {
      // plotshape(minerviniCriteria, "Minervini Buy", shape.triangleup, location.belowbar, color.green, size.large)
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'large' });
      // bgcolor(minerviniCriteria ? color.new(color.green, 90) : na)
      bgColors.push({ time: bars[i].time, color: bg });
    }
  }

  const line = (vals: number[], col: string) => bars.map((b, i) => ({ time: b.time, value: vals[i], color: col }));
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: line(ma10, MA10_COL),
      plot1: line(ma20, MA20_COL),
      plot2: line(ma50, color.blue),
      plot3: line(ma150, color.green),
      plot4: line(ma200, color.red),
    },
    markers,
    bgColors,
  };
}

export const MarkMinerviniBuySignal = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
