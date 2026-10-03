/**
 * Williams Percent Range with Threshold
 *
 * Williams %R of the source over `length` bars: 100 * (src - highest high) / (highest high - lowest low). The trend
 * state turns up when %R is above the uptrend threshold and down when it is below the downtrend threshold (it is
 * kept between them). The %R line is green / red / gray by the state, and the price candles are drawn in the
 * state colour on the price pane.
 *
 * Reference: "Williams Percent Range with Threshold" by xdextra
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { PlotCandleData } from '../types';

export interface WilliamsPercentRangeWithThresholdInputs {
  /** Lookback length of the highest high / lowest low */
  length: number;
  /** Source */
  src: SourceType;
  /** %R above this level: uptrend */
  upperthreshold: number;
  /** %R below this level: downtrend */
  lowerthreshold: number;
}

export const defaultInputs: WilliamsPercentRangeWithThresholdInputs = {
  length: 50,
  src: 'close',
  upperthreshold: -16,
  lowerthreshold: -67,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 50 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'upperthreshold', type: 'float', title: 'Uptrend Threshold', defval: -16, step: 1 },
  { id: 'lowerthreshold', type: 'float', title: 'Downtrend Threshold', defval: -67, step: 1 },
];

const UP_LINE = String(color.rgb(14, 255, 122));
const DOWN_LINE = '#F10A3C';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '%R', color: UP_LINE, lineWidth: 2 },
];

export const metadata = {
  title: 'Williams Percent Range with Threshold',
  shortTitle: 'Williams %R with Threshold',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<WilliamsPercentRangeWithThresholdInputs> = {},
): IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const src = A(getSourceSeries(bars, cfg.src));
  const hi = A(ta.highest(Series.fromArray(bars, bars.map((b) => b.high)), cfg.length));
  const lo = A(ta.lowest(Series.fromArray(bars, bars.map((b) => b.low)), cfg.length));

  const plot0: { time: number; value: number; color: string }[] = [];
  const candles: PlotCandleData[] = [];
  let wrIsUp = false; // var wr_is_up = false
  let wrIsDown = false; // var wr_is_down = false
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    // 100 * (src - max) / (max - min): a plain division (x / 0 is +-infinity, 0 / 0 na)
    const percentR = (100 * (src[i] - hi[i])) / (hi[i] - lo[i]);
    if (gt(percentR, cfg.upperthreshold)) {
      wrIsUp = true;
      wrIsDown = false;
    } else if (lt(percentR, cfg.lowerthreshold)) {
      wrIsUp = false;
      wrIsDown = true;
    }
    const trendColor = wrIsUp ? UP_LINE : wrIsDown ? DOWN_LINE : color.gray;
    const candleColor = wrIsUp ? color.green : wrIsDown ? color.red : color.gray;
    plot0.push({ time: b.time, value: Number.isFinite(percentR) ? percentR : NaN, color: trendColor });
    // plotcandle(open, high, low, close, "Candle Color", color = wickcolor = bordercolor = candle_color, force_overlay = true)
    candles.push({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close,
      color: candleColor, wickColor: candleColor, borderColor: candleColor, forceOverlay: true });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
    hlines: [
      { value: cfg.upperthreshold, options: { title: 'Uptrend Threshold', color: color.gray, linestyle: 'dashed' } },
      { value: cfg.lowerthreshold, options: { title: 'Downtrend Threshold', color: color.gray, linestyle: 'dashed' } },
    ],
    plotCandles: { candleColor: candles },
  };
}

export const WilliamsPercentRangeWithThreshold = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
