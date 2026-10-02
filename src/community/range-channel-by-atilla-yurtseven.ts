/**
 * Range Channel
 *
 * A moving average of the source (linear regression by default, or one of ten other types) and the distance of the
 * source from it in percent, diff = (src / ma - 1) * 100, drawn as a histogram. Since the first bar, the positive
 * diffs and the negative diffs are averaged separately (cumulative means of diff / 100). The channel edges on the
 * price pane are ma * (1 + positive mean) and ma * (1 + negative mean); the oscillator pane also shows both means
 * in percent.
 *
 * Reference: "Range Channel by Atilla Yurtseven" by AtillaYurtseven
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © AtillaYurtseven
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export type RangeChannelMaType =
  | 'SMA (Simple MA)'
  | 'EMA (Exponential MA)'
  | 'WMA (Weighted MA)'
  | 'Linear MA (Linear Regression)'
  | 'SMMA (Smoothed MA)'
  | 'VWMA (Volume Weighted MA)'
  | 'HWMA (Hull WMA)'
  | 'RMA (Running MA)'
  | 'ALMA (Arnaud Legoux MA)'
  | 'DEMA (Double EMA)'
  | 'TEMA (Triple EMA)';

export interface RangeChannelByAtillaYurtsevenInputs {
  src: SourceType;
  /** Moving average length */
  lookBack: number;
  /** Moving average type */
  maType: RangeChannelMaType;
}

export const defaultInputs: RangeChannelByAtillaYurtsevenInputs = {
  src: 'close',
  lookBack: 200,
  maType: 'Linear MA (Linear Regression)',
};

const MA_TYPES: RangeChannelMaType[] = [
  'SMA (Simple MA)', 'EMA (Exponential MA)', 'WMA (Weighted MA)', 'Linear MA (Linear Regression)',
  'SMMA (Smoothed MA)', 'VWMA (Volume Weighted MA)', 'HWMA (Hull WMA)', 'RMA (Running MA)',
  'ALMA (Arnaud Legoux MA)', 'DEMA (Double EMA)', 'TEMA (Triple EMA)',
];

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'lookBack', type: 'int', title: 'Lookback', defval: 200, min: 1 },
  { id: 'maType', type: 'string', title: 'Moving Average Type', defval: 'Linear MA (Linear Regression)', options: MA_TYPES },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Moving Average', color: '#2962FF', lineWidth: 1, forceOverlay: true },
  { id: 'plot1', title: 'Upper Edge', color: color.gray, lineWidth: 1, style: 'circles', forceOverlay: true },
  { id: 'plot2', title: 'Lower Edge', color: color.gray, lineWidth: 1, style: 'circles', forceOverlay: true },
  { id: 'plot3', title: 'Untrended', color: color.green, lineWidth: 1, style: 'histogram' },
  { id: 'plot4', title: 'Positive Mean', color: color.gray, lineWidth: 1, style: 'circles' },
  { id: 'plot5', title: 'Negative Mean', color: color.gray, lineWidth: 1, style: 'circles' },
];

export const metadata = {
  title: 'Range Channel by Atilla Yurtseven',
  shortTitle: 'Range Channel',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };

/** calculate_ma(source, ma_type, look_back) */
function movingAverage(bars: Bar[], source: Series, maType: RangeChannelMaType, len: number): Series {
  const ema = (s: Series) => ta.ema(s, len);
  switch (maType) {
    case 'SMA (Simple MA)':
      return ta.sma(source, len);
    case 'EMA (Exponential MA)':
      return ta.ema(source, len);
    case 'WMA (Weighted MA)':
      return ta.wma(source, len);
    case 'Linear MA (Linear Regression)':
      return ta.linreg(source, len, 0);
    case 'SMMA (Smoothed MA)':
      return ta.sma(source, len); // the Pine script uses ta.sma here
    case 'VWMA (Volume Weighted MA)':
      return ta.vwma(source, len, Series.fromArray(bars, bars.map((b) => b.volume ?? NaN)));
    case 'HWMA (Hull WMA)':
      // ta.wma(2 * ta.wma(source, look_back / 2) - ta.wma(source, look_back), math.round(math.sqrt(look_back)))
      return ta.wma(ta.wma(source, len / 2).mul(2).sub(ta.wma(source, len)), Math.round(Math.sqrt(len)));
    case 'RMA (Running MA)':
      return ta.rma(source, len);
    case 'ALMA (Arnaud Legoux MA)':
      return ta.alma(source, len, 0.85, 6.0);
    case 'TEMA (Triple EMA)': {
      const e1 = ema(source);
      const e2 = ema(e1);
      const e3 = ema(e2);
      return e1.mul(3).sub(e2.mul(3)).add(e3);
    }
    case 'DEMA (Double EMA)': {
      const e1 = ema(source);
      return e1.mul(2).sub(ema(e1));
    }
    default:
      return ta.sma(source, len);
  }
}

export function calculate(bars: Bar[], inputs: Partial<RangeChannelByAtillaYurtsevenInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const src = getSourceSeries(bars, cfg.src);
  const srcA = src.toArray().map((v) => v ?? NaN);
  const ma = movingAverage(bars, src, cfg.maType, cfg.lookBack).toArray().map((v) => v ?? NaN);

  const plots: Record<string, Point[]> = {
    plot0: [], plot1: [], plot2: [], plot3: [], plot4: [], plot5: [],
  };
  const fin = (x: number) => (Number.isFinite(x) ? x : NaN);
  // calculate_diff_averages(diff): var sums and counts of the positive / negative diff / 100 since the first bar
  let posSum = 0.0;
  let posCount = 0;
  let negSum = 0.0;
  let negCount = 0;
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    // a plain division: ma = 0 gives +-infinity (0 / 0 na), as in Pine
    const diff = (srcA[i] / ma[i] - 1) * 100;
    const d = diff / 100;
    if (gt(d, 0)) {
      posSum += d;
      posCount += 1;
    } else if (lt(d, 0)) {
      negSum += d;
      negCount += 1;
    }
    const positiveDiff = posCount > 0 ? posSum / posCount : 0;
    const negativeDiff = negCount > 0 ? negSum / negCount : 0;

    plots.plot0.push({ time: t, value: fin(ma[i]) });
    plots.plot1.push({ time: t, value: fin(ma[i] * (1 + positiveDiff)), color: color.gray });
    plots.plot2.push({ time: t, value: fin(ma[i] * (1 + negativeDiff)), color: color.gray });
    plots.plot3.push({ time: t, value: fin(diff), color: gt(diff, 0) ? color.green : color.red });
    plots.plot4.push({ time: t, value: fin(positiveDiff * 100), color: color.gray });
    plots.plot5.push({ time: t, value: fin(negativeDiff * 100), color: color.gray });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    // hline(0): Pine defaults (colour #787B86, dashed)
    hlines: [{ value: 0, options: { title: 'Zero Line', color: '#787B86', linestyle: 'dashed' } }],
  };
}

export const RangeChannelByAtillaYurtseven = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
