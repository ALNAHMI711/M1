/**
 * Price Acceleration Indicator (PAI)
 *
 * velocity = change(src), acceleration = change(velocity), smoothed = EMA(acceleration, smoothing length), drawn as
 * columns: bright green when above zero and rising, dark green when above zero and not rising, bright red when at or
 * below zero and falling, dark red otherwise. Upper / lower trigger lines are 0.3 times the highest / lowest smoothed
 * acceleration over the lookback.
 *
 * Reference: "Price Acceleration Indicator" by PHICAPITALINVESTMENTS
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Phi Capital Investments
 */

import { ta, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface PriceAccelerationIndicatorInputs {
  src: SourceType;
  /** EMA length of the acceleration */
  smoothLen: number;
  /** Lookback of the highest / lowest smoothed acceleration */
  lookback: number;
}

export const defaultInputs: PriceAccelerationIndicatorInputs = {
  src: 'close',
  smoothLen: 10,
  lookback: 100,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'smoothLen', type: 'int', title: 'Smoothing Length', defval: 10 },
  { id: 'lookback', type: 'int', title: 'Lookback for Peaks', defval: 100 },
];

const UPPER_COLOR = String(color.new(color.green, 60));
const LOWER_COLOR = String(color.new(color.red, 60));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Acceleration Bars', color: '#00ff00', lineWidth: 2, style: 'columns' },
  { id: 'plot1', title: 'Upper Trigger', color: UPPER_COLOR, lineWidth: 1 },
  { id: 'plot2', title: 'Lower Trigger', color: LOWER_COLOR, lineWidth: 1 },
];

export const metadata = {
  title: 'Price Acceleration Indicator',
  shortTitle: 'PAI',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

export function calculate(bars: Bar[], inputs: Partial<PriceAccelerationIndicatorInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: { toArray(): (number | null | undefined)[] }) => s.toArray().map((v) => v ?? NaN);

  const src = getSourceSeries(bars, cfg.src);
  const velocity = ta.change(src);
  const acceleration = ta.change(velocity);
  const smoothedS = ta.ema(acceleration, cfg.smoothLen);
  const smoothed = A(smoothedS);
  const highest = A(ta.highest(smoothedS, cfg.lookback));
  const lowest = A(ta.lowest(smoothedS, cfg.lookback));

  const plot0 = [];
  const plot1 = [];
  const plot2 = [];
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    const s = smoothed[i];
    const prev = i > 0 ? smoothed[i - 1] : NaN;
    // smoothed_acc > 0 ? (smoothed_acc > smoothed_acc[1] ? #00ff00 : #006400)
    //                  : (smoothed_acc < smoothed_acc[1] ? #ff0000 : #8b0000)
    const c = gt(s, 0) ? (gt(s, prev) ? '#00ff00' : '#006400') : lt(s, prev) ? '#ff0000' : '#8b0000';
    plot0.push({ time: t, value: fin(s), color: c });
    plot1.push({ time: t, value: fin(highest[i] * 0.3), color: UPPER_COLOR });
    plot2.push({ time: t, value: fin(lowest[i] * 0.3), color: LOWER_COLOR });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2 },
    hlines: [{ value: 0, options: { title: 'Zero Median', color: color.gray, linestyle: 'solid', linewidth: 1 } }],
  };
}

export const PriceAccelerationIndicator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
