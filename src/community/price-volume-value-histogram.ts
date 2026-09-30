/**
 * Price/Volume Value Histogram
 *
 * Points from price and volume changes: on a bar where close rises, the point is close / close[1], multiplied by a
 * volume factor (volume / volume[1] capped at 2, reduced by a percent, at least 1) when volume also rises; on a bar
 * where close falls, the point is -(close[1] / close), with the same volume factor when volume rises. The histogram
 * is the average of the last "look back" points, optionally smoothed by an EMA: lime at or above zero, red below.
 * The candles can take the histogram colour; a hidden plot gives 1 / -1 for use by other indicators.
 *
 * Reference: "Price/Volume Value Histogram" by dman103
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

export interface PriceVolumeValueHistogramInputs {
  /** Number of points averaged */
  lookBack: number;
  /** Colour the candles with the histogram colour */
  colorBars: boolean;
  /** Percent to reduce from the volume factor (0: full volume factor, 100: no volume factor) */
  percentFactorVol: number;
  /** Smooth the average with an EMA */
  emaSmooth: boolean;
  /** EMA length */
  emaLength: number;
}

export const defaultInputs: PriceVolumeValueHistogramInputs = {
  lookBack: 7,
  colorBars: true,
  percentFactorVol: 0,
  emaSmooth: true,
  emaLength: 7,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookBack', type: 'int', title: 'Look back', defval: 7, min: 1 },
  { id: 'colorBars', type: 'bool', title: 'Color bars', defval: true },
  { id: 'percentFactorVol', type: 'int', title: 'Percent to reduce from volume factor [0 - full volume, 100 - no volume]', defval: 0, min: 0, max: 100 },
  { id: 'emaSmooth', type: 'bool', title: 'EMA smoothing', defval: true },
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 7 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Zero', color: color.orange, lineWidth: 1 },
  { id: 'plot1', title: 'Histogram', color: color.lime, lineWidth: 5, style: 'columns' },
  { id: 'plot2', title: '[External Indicator 1 or -1]', color: color.blue, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Price/Volume value histogram',
  shortTitle: 'P/V value histogram',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => b - a <= EPS;
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<PriceVolumeValueHistogramInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // reducedPercent := 1.0 - (percent_factor_vol / 100.0) (set on the first bar)
  const reducedPercent = 1.0 - cfg.percentFactorVol / 100.0;
  const points: number[] = []; // var float[] points_array
  const sumTotal: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const close = bars[i].close;
    const volume = bars[i].volume ?? NaN;
    const close1 = i > 0 ? bars[i - 1].close : NaN;
    const volume1 = i > 0 ? bars[i - 1].volume ?? NaN : NaN;
    const priceUp = gt(close, close1);
    const priceDown = lt(close, close1);
    const volUp = gt(volume, volume1);
    // ratioClose = close[1] != 0 ? close / close[1] : 1; ratioVol = volume[1] != 0 ? volume / volume[1] : 1
    const ratioClose = ne(close1, 0) ? close / close1 : 1;
    const ratioVol = ne(volume1, 0) ? volume / volume1 : 1;
    // volumeFactor = math.max(1, math.min(ratioVol, 2) * reducedPercent) (na when ratioVol is na)
    const volumeFactor = isNaN(ratioVol) ? NaN : Math.max(1, Math.min(ratioVol, 2) * reducedPercent);

    if (priceUp) {
      points.push(volUp ? ratioClose * volumeFactor : ratioClose);
      if (points.length > cfg.lookBack) points.shift();
    } else if (priceDown) {
      points.push(volUp ? -(1 / ratioClose) * volumeFactor : -(1 / ratioClose));
      if (points.length > cfg.lookBack) points.shift();
    }
    // sum_total = array.avg(points_array) (na while the array is empty)
    sumTotal[i] = points.length ? points.reduce((s, v) => s + v, 0) / points.length : NaN;
  }

  // plot_result = emaSmooth ? ta.ema(sum_total, emaLength) : sum_total
  const plotResult = cfg.emaSmooth
    ? ta.ema(Series.fromArray(bars, sumTotal), cfg.emaLength).toArray().map((v) => v ?? NaN)
    : sumTotal;

  // histColor = plot_result >= 0 ? color.lime : color.red (red when plot_result is na)
  const histColor = plotResult.map((v) => (ge(v, 0) ? color.lime : color.red));
  const barColors: BarColorData[] = [];
  // barcolor(color = colorBars ? histColor : na)
  if (cfg.colorBars) for (let i = 0; i < n; i++) barColors.push({ time: bars[i].time, color: histColor[i] });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      // plot(0, color = color.new(color.orange, 0))
      plot0: bars.map((b) => ({ time: b.time, value: 0, color: String(color.new(color.orange, 0)) })),
      // plot(plot_result, color = histColor, style = plot.style_columns, linewidth = 5)
      plot1: bars.map((b, i) => ({ time: b.time, value: plotResult[i], color: histColor[i] })),
      // plot(plot_result > 0 ? 1 : -1, '[External Indicator 1 or -1]', display = display.none, editable = false)
      plot2: bars.map((b, i) => ({ time: b.time, value: gt(plotResult[i], 0) ? 1 : -1 })),
    },
    markers: [],
    barColors,
  };
}

export const PriceVolumeValueHistogram = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
