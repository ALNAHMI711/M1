/**
 * Buying vs Selling Moving Averages (Scalp Meter)
 *
 * Splits the bar volume into buying and selling volume by the close position in the bar range:
 * buyVol = volume * (close - low) / (high - low), sellVol = volume * (high - close) / (high - low) (half and half
 * when the range is 0). Draws a moving average (EMA / SMA / WMA / VWMA / HMA) of each, the total volume as columns
 * (teal on an up bar, red on a down bar) and a fill between the two averages, teal when buying dominates, else red.
 *
 * Reference: "Buying vs Selling Moving Averages (Scalp Meter)" by codycolton97
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © codycolton97
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export type BuyingVsSellingMaType = 'EMA' | 'SMA' | 'WMA' | 'VWMA' | 'HMA';

export interface BuyingVsSellingMovingAveragesInputs {
  maType: BuyingVsSellingMaType;
  /** MA length of the buying volume */
  buyLength: number;
  /** MA length of the selling volume */
  sellLength: number;
  /** Show the total volume histogram */
  showDelta: boolean;
}

export const defaultInputs: BuyingVsSellingMovingAveragesInputs = {
  maType: 'EMA',
  buyLength: 14,
  sellLength: 14,
  showDelta: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA', options: ['EMA', 'SMA', 'WMA', 'VWMA', 'HMA'] },
  { id: 'buyLength', type: 'int', title: 'Buying Volume MA Length', defval: 14, min: 1 },
  { id: 'sellLength', type: 'int', title: 'Selling Volume MA Length', defval: 14, min: 1 },
  { id: 'showDelta', type: 'bool', title: 'Show Volume Histogram', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume Histogram', color: String(color.new(color.teal, 50)), style: 'columns' },
  { id: 'plot1', title: 'Buying Vol MA', color: String(color.new(color.teal, 0)), lineWidth: 2 },
  { id: 'plot2', title: 'Selling Vol MA', color: String(color.new(color.red, 0)), lineWidth: 2 },
  { id: 'plot3', title: 'Buying Vol MA (fill)', color: '#2962FF', display: 'none' },
  { id: 'plot4', title: 'Selling Vol MA (fill)', color: '#2962FF', display: 'none' },
];

export const metadata = {
  title: 'Volume Delta MA',
  shortTitle: 'Volume Delta MA',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

export function calculate(
  bars: Bar[],
  inputs: Partial<BuyingVsSellingMovingAveragesInputs> = {},
): IndicatorResult {
  const { maType, buyLength, sellLength, showDelta } = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const volume = bars.map((b) => b.volume ?? NaN);

  const buyVol: number[] = [];
  const sellVol: number[] = [];
  for (const b of bars) {
    const candleRange = b.high - b.low;
    const buyRatio = gt(candleRange, 0) ? (b.close - b.low) / candleRange : 0.5;
    const sellRatio = gt(candleRange, 0) ? (b.high - b.close) / candleRange : 0.5;
    buyVol.push((b.volume ?? NaN) * buyRatio);
    sellVol.push((b.volume ?? NaN) * sellRatio);
  }

  const calcMA = (src: number[], len: number): number[] => {
    switch (maType) {
      case 'SMA': return A(ta.sma(S(src), len));
      case 'WMA': return A(ta.wma(S(src), len));
      case 'VWMA': return A(ta.vwma(S(src), len, S(volume)));
      case 'HMA':
        // ta.hma(src, 1) runs ta.wma(src, 0): a Pine runtime error
        if (Math.floor(len / 2) < 1 && bars.length > 0) {
          throw new Error("Error on bar 0: Invalid value of the 'length' argument (0.0) in the 'wma' function. It must be > 0.");
        }
        return A(ta.hma(S(src), len));
      default: return A(ta.ema(S(src), len));
    }
  };
  const buyMA = calcMA(buyVol, buyLength);
  const sellMA = calcMA(sellVol, sellLength);

  const up = String(color.new(color.teal, 50));
  const down = String(color.new(color.red, 50));
  const fillUp = String(color.new(color.teal, 85));
  const fillDown = String(color.new(color.red, 85));
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

  const plot0 = bars.map((b) => ({
    time: b.time, value: showDelta ? fin(b.volume ?? NaN) : NaN, color: ge(b.close, b.open) ? up : down,
  }));
  const plot1 = bars.map((b, i) => ({ time: b.time, value: fin(buyMA[i]) }));
  const plot2 = bars.map((b, i) => ({ time: b.time, value: fin(sellMA[i]) }));
  const plot3 = bars.map((b, i) => ({ time: b.time, value: fin(buyMA[i]) }));
  const plot4 = bars.map((b, i) => ({ time: b.time, value: fin(sellMA[i]) }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2, plot3, plot4 },
    hlines: [
      { value: 0, options: { title: 'Zero', color: String(color.new(color.gray, 50)), linestyle: 'dashed' } },
    ],
    fills: [
      {
        plot1: 'plot3', plot2: 'plot4', options: { title: 'Dominance Fill' },
        colors: bars.map((_b, i) => (gt(buyMA[i], sellMA[i]) ? fillUp : fillDown)),
      },
    ],
  };
}

export const BuyingVsSellingMovingAverages = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
