/**
 * Volume Buy/Sell Split
 *
 * The bar volume is split by the close position in the bar range: buying = volume * (close - low) / range,
 * selling = volume * (high - close) / range (range 0.0001 when high equals low). Columns show the total volume
 * (half transparent), the larger part and the smaller part, each in the buying or selling colour. A line shows the
 * SMA of the volume on the bars where the volume is above it.
 *
 * Reference: "[Top] Volume Buy/Sell Split" by LHAMA-Trading
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface VolumeBuySellSplitInputs {
  buyingColor: string;
  sellingColor: string;
  totalVolColor: string;
  avgLineColor: string;
  /** SMA length of the volume */
  maLength: number;
}

export const defaultInputs: VolumeBuySellSplitInputs = {
  buyingColor: 'rgb(91, 156, 246)',
  sellingColor: 'rgb(255, 255, 51)',
  totalVolColor: color.gray,
  avgLineColor: 'rgb(153, 0, 153)',
  maLength: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'buyingColor', type: 'color', title: 'Buying Volume Color', defval: 'rgb(91, 156, 246)', group: 'Color Settings' },
  { id: 'sellingColor', type: 'color', title: 'Selling Volume Color', defval: 'rgb(255, 255, 51)', group: 'Color Settings' },
  { id: 'totalVolColor', type: 'color', title: 'Total Volume Color', defval: color.gray, group: 'Color Settings' },
  { id: 'avgLineColor', type: 'color', title: 'Volume MA Line Color', defval: 'rgb(153, 0, 153)', group: 'Color Settings' },
  { id: 'maLength', type: 'int', title: 'Volume MA Length', defval: 20, min: 1, group: 'Moving Average Settings' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Total Volume', color: String(color.new(color.gray, 50)), lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Majority Volume', color: 'rgb(91, 156, 246)', lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'Minority Volume', color: 'rgb(255, 255, 51)', lineWidth: 1, style: 'columns' },
  { id: 'plot3', title: 'Above Avg Marker', color: 'rgb(153, 0, 153)', lineWidth: 1 },
];

export const metadata = {
  title: '[Top] Volume Buy/Sell Split',
  shortTitle: '[Top] Volume Split',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;

export function calculate(bars: Bar[], inputs: Partial<VolumeBuySellSplitInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const vol = bars.map((b) => b.volume ?? NaN);
  const avgVol = ta.sma(Series.fromArray(bars, vol), cfg.maLength).toArray().map((v) => v ?? NaN);
  const totalCol = String(color.new(cfg.totalVolColor, 50));
  const v = (x: number) => (Number.isFinite(x) ? x : NaN);

  const plot0 = [];
  const plot1 = [];
  const plot2 = [];
  const plot3 = [];
  for (let i = 0; i < bars.length; i++) {
    const { time, high, low, close } = bars[i];
    // pr = high != low ? high - low : 0.0001
    const pr = ne(high, low) ? high - low : 0.0001;
    const buyingVol = (vol[i] * (close - low)) / pr;
    const sellingVol = (vol[i] * (high - close)) / pr;
    // math.max / math.min: na when an argument is na
    const majorityVol = Math.max(buyingVol, sellingVol);
    const minorityVol = Math.min(buyingVol, sellingVol);
    const majorityColor = ge(buyingVol, sellingVol) ? cfg.buyingColor : cfg.sellingColor;
    const minorityColor = lt(buyingVol, sellingVol) ? cfg.buyingColor : cfg.sellingColor;
    plot0.push({ time, value: v(vol[i]), color: totalCol });
    plot1.push({ time, value: v(majorityVol), color: majorityColor });
    plot2.push({ time, value: v(minorityVol), color: minorityColor });
    // aboveAvgLine = volume > avgVol ? avgVol : na
    plot3.push({ time, value: gt(vol[i], avgVol[i]) ? avgVol[i] : NaN, color: cfg.avgLineColor });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2, plot3 },
  };
}

export const VolumeBuySellSplit = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
