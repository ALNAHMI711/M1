/**
 * Bollinger Free Bars
 *
 * Bollinger Bands (SMA of the source +- stdev * multiplier). A bar whose open and close are both above the upper
 * band (below the lower band) gets a blue triangle above (below) the bar; a bar whose high and low are both above
 * the upper band (below the lower band) gets a red (green) flag above (below) the bar. The two bands are drawn.
 *
 * Reference: "Bollinger Free Bars" by pkuliyi
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType, type Series } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface BollingerFreeBarsInputs {
  /** Period (周期) */
  length: number;
  /** Standard deviation multiplier (标准差倍数) */
  mult: number;
  /** Source (数据源) */
  src: SourceType;
}

export const defaultInputs: BollingerFreeBarsInputs = {
  length: 20,
  mult: 2.0,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: '周期', defval: 20 },
  { id: 'mult', type: 'float', title: '标准差倍数', defval: 2.0 },
  { id: 'src', type: 'source', title: '数据源', defval: 'close' },
];

const UPPER_COLOR = String(color.new('#2196F3', 70));
const LOWER_COLOR = String(color.new('#FF9800', 70));
const HALF_COLOR = String(color.new(color.blue, 0));
const UP_FLAG_COLOR = String(color.new(color.red, 0));
const DN_FLAG_COLOR = String(color.new(color.green, 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Band', color: UPPER_COLOR, lineWidth: 1 },
  { id: 'plot1', title: 'Lower Band', color: LOWER_COLOR, lineWidth: 1 },
];

export const metadata = {
  title: 'Bollinger Free Bars',
  shortTitle: 'Bollinger Free Bars',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<BollingerFreeBarsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const src = getSourceSeries(bars, cfg.src);
  const basis = A(ta.sma(src, cfg.length));
  const dev = A(ta.stdev(src, cfg.length));

  const upper: number[] = bars.map((_b, i) => basis[i] + dev[i] * cfg.mult);
  const lower: number[] = bars.map((_b, i) => basis[i] - dev[i] * cfg.mult);

  const markers: MarkerData[] = [];
  bars.forEach((b, i) => {
    const u = upper[i];
    const l = lower[i];
    // Plotshape order: Half Upper, Half Lower, Complete Upper, Complete Lower (all size.small)
    if (gt(b.open, u) && gt(b.close, u)) {
      markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: HALF_COLOR, size: 'small' });
    }
    if (lt(b.open, l) && lt(b.close, l)) {
      markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: HALF_COLOR, size: 'small' });
    }
    if (gt(b.high, u) && gt(b.low, u)) {
      markers.push({ time: b.time, position: 'aboveBar', shape: 'flag', color: UP_FLAG_COLOR, size: 'small' });
    }
    if (lt(b.high, l) && lt(b.low, l)) {
      markers.push({ time: b.time, position: 'belowBar', shape: 'flag', color: DN_FLAG_COLOR, size: 'small' });
    }
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: upper[i], color: UPPER_COLOR })),
      plot1: bars.map((b, i) => ({ time: b.time, value: lower[i], color: LOWER_COLOR })),
    },
    markers,
  };
}

export const BollingerFreeBars = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
