/**
 * GBR Micro Kernel Trend
 *
 * Laplace kernel smoothing of the source: the weighted mean of src[i] for i = 0 .. window with the weights
 * exp(-i / h) (na history values count as 0 but keep their weight). The direction is up when the kernel rises and
 * down when it falls (it keeps its value on a flat bar); the line is green up and red down. Labels mark the bars
 * where the direction turns up (below the bar) or down (above the bar).
 *
 * Reference: "GBR Micro Kernel Trend [Laplace Smoothing]" by THEGBR
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface GbrMicroKernelTrendInputs {
  /** Smoothing bandwidth (h) */
  h: number;
  /** Calculation window (the loop runs over window + 1 bars) */
  window: number;
  src: SourceType;
}

export const defaultInputs: GbrMicroKernelTrendInputs = {
  h: 14.0,
  window: 50,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'h', type: 'float', title: 'Smoothing Bandwidth (h)', defval: 14.0, step: 1.0 },
  { id: 'window', type: 'int', title: 'Calculation Window', defval: 50 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

const COL_BUY = String(color.new('#00FF00', 0));
const COL_SELL = String(color.new('#FF0033', 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'GBR Kernel Line', color: COL_BUY, lineWidth: 3 },
];

export const metadata = {
  title: 'GBR Micro Kernel Trend',
  shortTitle: 'GBR Micro Kernel Trend',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<GbrMicroKernelTrendInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const { h, window } = cfg;
  const n = bars.length;
  const src = getSourceSeries(bars, cfg.src).toArray().map((v) => v ?? NaN);

  // for i = 0 to window: counts down when window < 0
  const step = window >= 0 ? 1 : -1;
  const kernel: number[] = new Array(n);
  for (let bar = 0; bar < n; bar++) {
    let sum = 0.0;
    let sumw = 0.0;
    for (let i = 0; step > 0 ? i <= window : i >= window; i += step) {
      const weight = Math.exp(-Math.abs(i) / h);
      const x = bar - i >= 0 && bar - i < n ? src[bar - i] : NaN;
      // nz(src[i]): na (and +-infinity) is 0
      sum += (Number.isFinite(x) ? x : 0) * weight;
      sumw += weight;
    }
    kernel[bar] = sum / sumw;
  }

  const dirs: number[] = new Array(n);
  let dir = 1;
  for (let i = 0; i < n; i++) {
    const prev = i > 0 ? kernel[i - 1] : NaN;
    if (gt(kernel[i], prev)) dir = 1;
    else if (gt(prev, kernel[i])) dir = -1;
    dirs[i] = dir;
  }

  const plot0 = bars.map((b, i) => ({
    time: b.time, value: Number.isFinite(kernel[i]) ? kernel[i] : NaN, color: dirs[i] === 1 ? COL_BUY : COL_SELL,
  }));

  const markers: MarkerData[] = [];
  const buyShape = String(color.new(COL_BUY, 85));
  const sellShape = String(color.new(COL_SELL, 85));
  for (let i = 1; i < n; i++) {
    if (dirs[i] === 1 && dirs[i - 1] === -1) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: buyShape, text: '▲',
        textColor: COL_BUY, size: 'tiny' });
    }
    if (dirs[i] === -1 && dirs[i - 1] === 1) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: sellShape, text: '▼',
        textColor: COL_SELL, size: 'tiny' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
    markers,
  };
}

export const GbrMicroKernelTrend = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
