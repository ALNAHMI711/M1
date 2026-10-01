/**
 * Loacally Weighted MA (LWMA) Direction Histogram
 *
 * The LWMA is a linearly weighted average of the last `length` source values (weight length for the current bar,
 * down to 1 for the oldest). The histogram is LWMA - LWMA[lookback]: blue columns when it is >= 0, yellow otherwise.
 * The price candles take the histogram colour. The LWMA line itself is hidden by default.
 *
 * Reference: "Loacally Weighted MA (LWMA) Direction Histogram" by LuxmiAI
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxmiAI
 */

import { getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { PlotCandleData } from '../types';

export interface LoacallyWeightedMaDirectionHistogramInputs {
  /** LWMA length */
  length: number;
  /** Bars back of the LWMA difference */
  dir: number;
  source: SourceType;
}

export const defaultInputs: LoacallyWeightedMaDirectionHistogramInputs = {
  length: 60,
  dir: 1,
  source: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'LWMA Length', defval: 60, min: 1 },
  { id: 'dir', type: 'int', title: 'LWMA Direction Lookback', defval: 1, min: 1 },
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
];

const ABOVE = String(color.new(color.blue, 0));
const BELOW = String(color.new(color.yellow, 0));
const LINE = String(color.new(color.aqua, 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA Direction Histogram', color: ABOVE, lineWidth: 2, style: 'columns' },
  { id: 'plot1', title: 'Plot LWMA', color: LINE, lineWidth: 1, display: 'none', forceOverlay: true },
];

export const metadata = {
  title: 'Loacally Weighted MA (LWMA) Direction Histogram',
  shortTitle: 'Loacally Weighted MA (LWMA) Direction Histogram',
  overlay: false,
};

/** Pine a >= b: false with na, else not (b - a > 1e-10) */
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > 1e-10);

export function calculate(
  bars: Bar[],
  inputs: Partial<LoacallyWeightedMaDirectionHistogramInputs> = {},
): IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const len = cfg.length;
  const src = getSourceSeries(bars, cfg.source).toArray().map((v) => v ?? NaN);

  // lwma(src, len): sum of src[i] * (len - i) for i = 0..len-1, divided by the sum of the weights (na when a value
  // of the window is na or before the first bar)
  const lwma: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    let totalWeight = 0;
    let weightedSum = 0;
    for (let k = 0; k <= len - 1; k++) {
      const w = len - k;
      totalWeight += w;
      weightedSum += (i - k >= 0 ? src[i - k] : NaN) * w;
    }
    lwma[i] = weightedSum / totalWeight;
  }
  // histogram = lwmaLine - lwmaLine[dir]
  const hist = lwma.map((v, i) => (i - cfg.dir >= 0 ? v - lwma[i - cfg.dir] : NaN));
  const col = hist.map((h) => (ge(h, 0) ? ABOVE : BELOW));

  const candles: PlotCandleData[] = bars.map((b, i) => ({
    // plotcandle(open, high, low, close, color / wickcolor / bordercolor = candlecolor, force_overlay = true)
    time: b.time, open: b.open, high: b.high, low: b.low, close: b.close,
    color: col[i], wickColor: col[i], borderColor: col[i], forceOverlay: true,
  }));
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      // plot(histogram, style = plot.style_columns, color = histogram >= 0 ? above_color : below_color, linewidth = 2)
      plot0: bars.map((b, i) => ({ time: b.time, value: fin(hist[i]), color: col[i] })),
      // plot(lwmaLine, color = color.new(color.aqua, 0), force_overlay = true, display = display.none)
      plot1: bars.map((b, i) => ({ time: b.time, value: fin(lwma[i]), color: LINE })),
    },
    plotCandles: { histogramColoredCandles: candles },
  };
}

export const LoacallyWeightedMaDirectionHistogram = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
