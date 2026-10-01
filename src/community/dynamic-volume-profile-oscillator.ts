/**
 * Dynamic Volume Profile Oscillator | AlphaAlgos
 *
 * Every `profilePeriods` bars the last `lookback` prices and volumes are stored as a profile; on each bar the
 * volume-weighted mean price (VWAP) of that profile and the volume-weighted mean absolute deviation give the
 * mean-reversion oscillator 50 + (price - VWAP) / (deviation * sensitivity) * 25 (or, without mean reversion, the
 * SMA of the volume normalised between its lowest and highest value). It is smoothed with an EMA, with an adaptive
 * midline (SMA), zones at the midline +/- stdev * zone width drawn as gradients, fast / slow EMA signals, and bar
 * colours by direction.
 *
 * Reference: "Dynamic Volume Profile Oscillator | AlphaAlgos" by AlphaNatt
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, getSourceSeries, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface DynamicVolumeProfileOscillatorInputs {
  priceSrc: SourceType;
  /** Volume source (Pine input.source, default volume) */
  volumeSrc: SourceType | 'volume';
  lookback: number;
  profilePeriods: number;
  smoothing: number;
  sensitivity: number;
  meanReversion: boolean;
  useAdaptiveMidline: boolean;
  midlinePeriod: number;
  zoneWidth: number;
  colorBars: boolean;
}

export const defaultInputs: DynamicVolumeProfileOscillatorInputs = {
  priceSrc: 'close',
  volumeSrc: 'volume',
  lookback: 50,
  profilePeriods: 10,
  smoothing: 5,
  sensitivity: 1.0,
  meanReversion: true,
  useAdaptiveMidline: true,
  midlinePeriod: 50,
  zoneWidth: 1.5,
  colorBars: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'priceSrc', type: 'source', title: 'Price Source', defval: 'close' },
  { id: 'volumeSrc', type: 'source', title: 'Volume Source', defval: 'volume',
    options: ['volume', 'open', 'high', 'low', 'close', 'hl2', 'hlc3', 'ohlc4', 'hlcc4'] },
  { id: 'lookback', type: 'int', title: 'Lookback Period', defval: 50, min: 10 },
  { id: 'profilePeriods', type: 'int', title: 'Profile Calculation Periods', defval: 10, min: 5, max: 100 },
  { id: 'smoothing', type: 'int', title: 'Smoothing Length', defval: 5, min: 1, max: 50 },
  { id: 'sensitivity', type: 'float', title: 'Sensitivity', defval: 1.0, min: 0.1, max: 5.0, step: 0.1 },
  { id: 'meanReversion', type: 'bool', title: 'Mean Reversion Mode', defval: true },
  { id: 'useAdaptiveMidline', type: 'bool', title: 'Use Adaptive Midline', defval: true },
  { id: 'midlinePeriod', type: 'int', title: 'Adaptive Midline Period', defval: 50, min: 10, max: 200 },
  { id: 'zoneWidth', type: 'float', title: 'Zone Width Multiplier', defval: 1.5, min: 0.5, max: 3.0, step: 0.1 },
  { id: 'colorBars', type: 'bool', title: 'Color Bars', defval: true },
];

const BULL = 'rgb(0, 241, 255)';
const BEAR = 'rgb(255, 1, 154)';
/** Transparencies of the gradient lines 2..10 (and of the fills that end on them); the last fill uses 99 */
const GRAD_TRANSP = [70, 75, 80, 83, 86, 89, 92, 95, 98];
const c = (col: string, transp: number) => String(color.new(col, transp));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume Profile Oscillator', color: BULL, lineWidth: 2 },
  { id: 'plot1', title: 'Fast Signal', color: BULL, lineWidth: 1 },
  { id: 'plot2', title: 'Slow Signal', color: BULL, lineWidth: 1 },
  { id: 'plot3', title: 'Adaptive Midline', color: color.gray, lineWidth: 1 },
  { id: 'plot4', title: 'Upper Zone', color: c(BEAR, 0), lineWidth: 1 },
  ...GRAD_TRANSP.map((tr, k) => ({ id: `plot${5 + k}`, title: `UG${k + 2}`, color: c(BEAR, tr), lineWidth: 1 })),
  { id: 'plot14', title: 'Lower Zone', color: c(BULL, 0), lineWidth: 1 },
  ...GRAD_TRANSP.map((tr, k) => ({ id: `plot${15 + k}`, title: `LG${k + 2}`, color: c(BULL, tr), lineWidth: 1 })),
];

export const metadata = {
  title: 'Dynamic Volume Profile Oscillator | AlphaAlgos',
  shortTitle: 'Dynamic Volume Profile Oscillator',
  overlay: false,
};

export function calculate(
  bars: Bar[],
  inputs: Partial<DynamicVolumeProfileOscillatorInputs> = {},
): IndicatorResult & { barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const price = A(getSourceSeries(bars, cfg.priceSrc));
  const vol = cfg.volumeSrc === 'volume' ? bars.map((b) => b.volume ?? NaN) : A(getSourceSeries(bars, cfg.volumeSrc));

  // calculate_volume_profile(): var arrays refreshed when empty or on bar_index % profile_periods == 0
  const vwap: number[] = new Array(n);
  const dev: number[] = new Array(n);
  let prices: number[] = [];
  let profile: number[] = [];
  for (let i = 0; i < n; i++) {
    if (profile.length === 0 || i % cfg.profilePeriods === 0) {
      prices = [];
      profile = [];
      for (let k = 0; k <= Math.min(cfg.lookback - 1, i); k++) {
        prices.push(price[i - k]);
        profile.push(vol[i - k]);
      }
    }
    const sumVol = profile.reduce((a, v) => a + v, 0);
    if (sumVol > 0) {
      let spv = 0;
      for (let k = 0; k < prices.length; k++) spv += prices[k] * profile[k];
      const vw = spv / sumVol;
      let sd = 0;
      for (let k = 0; k < prices.length; k++) sd += Math.abs(prices[k] - vw) * (profile[k] / sumVol);
      vwap[i] = vw;
      dev[i] = sd;
    } else {
      vwap[i] = price[i];
      dev[i] = 0;
    }
  }

  let raw: number[];
  if (cfg.meanReversion) {
    // A deviation of 0 (profile of one bar) gives +-Infinity in Pine (0 / 0: NaN). The value only feeds ta.ema,
    // which skips an infinite value as na, so NaN gives the same result.
    raw = price.map((p, i) => {
      const d = dev[i] * cfg.sensitivity;
      return d === 0 ? NaN : 50 + ((p - vwap[i]) / d) * 25;
    });
  } else {
    // normalize(sma(volume), lowest(sma(volume), lookback), highest(sma(volume), lookback))
    const sv = A(ta.sma(S(vol), cfg.smoothing));
    const lo = A(ta.lowest(S(sv), cfg.lookback));
    const hi = A(ta.highest(S(sv), cfg.lookback));
    raw = sv.map((v, i) => {
      const range = hi[i] - lo[i];
      return range <= 0 ? 50 : Math.min(100, Math.max(0, ((v - lo[i]) / range) * 100));
    });
  }
  const osc = A(ta.ema(S(raw), cfg.smoothing));
  const mid = cfg.useAdaptiveMidline ? A(ta.sma(S(osc), cfg.midlinePeriod)) : new Array(n).fill(50);
  const sd = A(ta.stdev(S(osc), cfg.midlinePeriod)).map((v) => v * cfg.zoneWidth);
  const fast = A(ta.ema(S(osc), 5));
  const slow = A(ta.ema(S(osc), 15));

  const plots: Record<string, { time: number; value: number; color?: string }[]> = {};
  for (let k = 0; k < 24; k++) plots[`plot${k}`] = [];
  const barColors: BarColorData[] = [];
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    const bullish = osc[i] > mid[i] || fast[i] > slow[i];
    const main = bullish ? BULL : BEAR;
    plots.plot0.push({ time: t, value: osc[i], color: main });
    plots.plot1.push({ time: t, value: fast[i], color: c(main, 40) });
    plots.plot2.push({ time: t, value: slow[i], color: c(main, 70) });
    plots.plot3.push({ time: t, value: mid[i] });
    const upper = mid[i] + sd[i];
    const lower = mid[i] - sd[i];
    const upStep = (upper - mid[i]) / 10;
    const loStep = (mid[i] - lower) / 10;
    plots.plot4.push({ time: t, value: upper });
    plots.plot14.push({ time: t, value: lower });
    for (let k = 1; k <= 9; k++) {
      plots[`plot${4 + k}`].push({ time: t, value: upper - upStep * k });
      plots[`plot${14 + k}`].push({ time: t, value: lower + loStep * k });
    }
    if (cfg.colorBars) barColors.push({ time: t, color: main });
  }

  // fill(gradK, gradK+1, color.new(zone colour, transparency of gradK+1)); fill(grad10, mid_line, transparency 99)
  const fills: IndicatorResult['fills'] = [];
  for (const [first, col] of [[4, BEAR], [14, BULL]] as const) {
    for (let k = 0; k < 9; k++) {
      fills.push({ plot1: `plot${first + k}`, plot2: `plot${first + k + 1}`, options: { color: c(col, GRAD_TRANSP[k]) } });
    }
    fills.push({ plot1: `plot${first + 9}`, plot2: 'plot3', options: { color: c(col, 99) } });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills,
    barColors,
  };
}

export const DynamicVolumeProfileOscillator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
