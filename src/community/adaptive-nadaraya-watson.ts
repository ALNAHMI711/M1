/**
 * Adaptive Nadaraya-Watson (Non Repainting)
 *
 * Endpoint Gaussian kernel regression of the source over the last `lookback` + 1 bars: weights
 * exp(-i^2 / (2 h^2)) for i = 0..lookback. With the adaptive volatility the bandwidth h is the base bandwidth times
 * ATR(20) / SMA(ATR(20), 100), clamped to 0.5..2. Envelopes at the SMA of the absolute error (MAE) times the inner and
 * outer multipliers. The colour is a gradient of the EMA(5) of the slope against 2 standard deviations of the slope.
 * Signals: a rejection of the outer band (high above / low below, close back inside, against the candle direction)
 * with a weakening move while trending; in a range the inner band, with or without the weakening check.
 *
 * Reference: "Adaptive Nadaraya-Watson [Metrify]" by Metrify
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: @Metrify
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface AdaptiveNadarayaWatsonInputs {
  /** Base bandwidth (h) */
  hVal: number;
  /** Lookback window of the kernel regression (and of the MAE) */
  lookback: number;
  /** Bandwidth adapts to volatility */
  useVol: boolean;
  /** Inner band multiplier */
  multIn: number;
  /** Outer band multiplier */
  multOut: number;
  /** Source price */
  src: SourceType;
  /** Range filter: inner band signals need a weakening move */
  filterRng: boolean;
  colBull: string;
  colBear: string;
  colNeut: string;
}

export const defaultInputs: AdaptiveNadarayaWatsonInputs = {
  hVal: 8.0,
  lookback: 50,
  useVol: true,
  multIn: 1.5,
  multOut: 2.8,
  src: 'hlc3',
  filterRng: true,
  colBull: '#00ffaa',
  colBear: '#ff0044',
  colNeut: '#434651',
};

export const inputConfig: InputConfig[] = [
  { id: 'hVal', type: 'float', title: 'Base Bandwidth (h)', defval: 8.0, min: 1.0, group: 'Kernel Physics' },
  { id: 'lookback', type: 'int', title: 'Lookback Window', defval: 50, min: 10, max: 500, group: 'Kernel Physics' },
  { id: 'useVol', type: 'bool', title: 'Enable Adaptive Volatility', defval: true, group: 'Kernel Physics' },
  { id: 'multIn', type: 'float', title: 'Inner Band Multiplier (Balanced)', defval: 1.5, step: 0.1, group: 'Envelope Statistics' },
  { id: 'multOut', type: 'float', title: 'Outer Band Multiplier (Precision)', defval: 2.8, step: 0.1, group: 'Envelope Statistics' },
  { id: 'src', type: 'source', title: 'Source Price', defval: 'hlc3', group: 'Envelope Statistics' },
  { id: 'filterRng', type: 'bool', title: 'Range Filter', defval: true, group: 'Risk Management' },
  { id: 'colBull', type: 'color', title: 'Bullish', defval: '#00ffaa', group: 'Visuals' },
  { id: 'colBear', type: 'color', title: 'Bearish', defval: '#ff0044', group: 'Visuals' },
  { id: 'colNeut', type: 'color', title: 'Neutral/Grey', defval: '#434651', group: 'Visuals' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fair Value Core', color: '#434651', lineWidth: 2 },
  { id: 'plot1', title: 'Fair Value Glow 1', color: String(color.new('#434651', 50)), lineWidth: 4 },
  { id: 'plot2', title: 'Fair Value Glow 2', color: String(color.new('#434651', 80)), lineWidth: 8 },
  { id: 'plot3', title: 'Fair Value (fill base)', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'Upper Inner', color: String(color.new('#434651', 80)), lineWidth: 1 },
  { id: 'plot5', title: 'Lower Inner', color: String(color.new('#434651', 80)), lineWidth: 1 },
  { id: 'plot6', title: 'Upper Outer', color: String(color.new('#434651', 60)), lineWidth: 1 },
  { id: 'plot7', title: 'Lower Outer', color: String(color.new('#434651', 60)), lineWidth: 1 },
];

export const metadata = {
  title: 'Adaptive Nadaraya-Watson [Metrify]',
  shortTitle: 'Adaptive Nadaraya-Watson [Metrify]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<AdaptiveNadarayaWatsonInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const src = A(getSourceSeries(bars, cfg.src));
  const L = cfg.lookback;

  // Volatility adjustment
  const volRaw = A(ta.atr(bars, 20));
  const volBase = A(ta.sma(S(volRaw), 100));

  // Kernel regression (endpoint estimator)
  const yHat: number[] = new Array(n);
  for (let b = 0; b < n; b++) {
    // vol_ratio = use_vol ? vol_raw / (vol_base == 0 ? 1 : vol_base) : 1.0 (na == 0 is false: na ratio)
    const volRatio = cfg.useVol ? volRaw[b] / (eq(volBase[b], 0) ? 1 : volBase[b]) : 1.0;
    // math.max(0.5, math.min(vol_ratio, 2.0)): na stays na
    const volMod = isNaN(volRatio) ? NaN : Math.max(0.5, Math.min(volRatio, 2.0));
    const hEff = cfg.hVal * volMod;
    let num = 0.0;
    let den = 0.0;
    for (let i = 0; i <= L; i++) {
      const w = Math.exp(-Math.pow(i, 2) / (2 * Math.pow(hEff, 2)));
      // src[i] before the first bar is na
      num = num + w * (b - i >= 0 ? src[b - i] : NaN);
      den = den + w;
    }
    yHat[b] = num / den;
  }

  // Statistical bounds (MAE)
  const mae = A(ta.sma(S(src.map((s, i) => Math.abs(s - yHat[i]))), L));
  const upperIn = yHat.map((y, i) => y + mae[i] * cfg.multIn);
  const lowerIn = yHat.map((y, i) => y - mae[i] * cfg.multIn);
  const upperOut = yHat.map((y, i) => y + mae[i] * cfg.multOut);
  const lowerOut = yHat.map((y, i) => y - mae[i] * cfg.multOut);

  // Velocity and acceleration
  const velocity = yHat.map((y, i) => (i > 0 ? y - yHat[i - 1] : NaN));
  const accel = velocity.map((v, i) => (i > 0 ? v - velocity[i - 1] : NaN));
  const velVis = A(ta.ema(S(velocity), 5));
  const velStdev = A(ta.stdev(S(velocity), 20));

  const dynCol: string[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const velMax = velStdev[i] * 2.0;
    dynCol[i] = gt(velVis[i], 0)
      ? String(color.from_gradient(velVis[i], 0, velMax, cfg.colNeut, cfg.colBull))
      : String(color.from_gradient(velVis[i], -velMax, 0, cfg.colBear, cfg.colNeut));
  }

  // Signals
  const markers: MarkerData[] = [];
  let prevSellOut = false;
  let prevBuyOut = false;
  let prevSellIn = false;
  let prevBuyIn = false;
  for (let i = 0; i < n; i++) {
    const { high, low, close, open, time } = bars[i];
    const isTrending = gt(Math.abs(velocity[i]), velStdev[i] * 0.5);
    const bullWeaken = gt(velocity[i], 0) && lt(accel[i], 0);
    const bearWeaken = lt(velocity[i], 0) && gt(accel[i], 0);
    const sellOut = gt(high, upperOut[i]) && lt(close, upperOut[i]) && lt(close, open);
    const buyOut = lt(low, lowerOut[i]) && gt(close, lowerOut[i]) && gt(close, open);
    const sellIn = gt(high, upperIn[i]) && lt(close, upperIn[i]) && lt(close, open);
    const buyIn = lt(low, lowerIn[i]) && gt(close, lowerIn[i]) && gt(close, open);
    const newSellOut = sellOut && !prevSellOut;
    const newBuyOut = buyOut && !prevBuyOut;
    const newSellIn = sellIn && !prevSellIn;
    const newBuyIn = buyIn && !prevBuyIn;
    prevSellOut = sellOut;
    prevBuyOut = buyOut;
    prevSellIn = sellIn;
    prevBuyIn = buyIn;

    let signalShort: boolean;
    let signalLong: boolean;
    if (isTrending) {
      signalShort = newSellOut && bullWeaken;
      signalLong = newBuyOut && bearWeaken;
    } else if (cfg.filterRng) {
      signalShort = newSellIn && bullWeaken;
      signalLong = newBuyIn && bearWeaken;
    } else {
      signalShort = newSellIn;
      signalLong = newBuyIn;
    }
    // plotshape(signal_short, 'Short Opportunity', shape.triangledown, location.abovebar, col_bear, size.tiny)
    if (signalShort) {
      markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: cfg.colBear, text: '', textColor: cfg.colBear, size: 'tiny' });
    }
    if (signalLong) {
      markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: cfg.colBull, text: '', textColor: cfg.colBull, size: 'tiny' });
    }
  }

  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const t = (i: number) => bars[i].time;
  const withT = (c: string, tr: number) => String(color.new(c, tr));
  const line = (arr: number[], tr: number | null) => bars.map((_b, i) => ({
    time: t(i), value: fin(arr[i]), color: tr === null ? dynCol[i] : withT(dynCol[i], tr),
  }));
  const fillCol = (tr: number) => dynCol.map((c) => withT(c, tr));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: line(yHat, null),
      plot1: line(yHat, 50),
      plot2: line(yHat, 80),
      // p_mid = plot(y_hat, display = display.none)
      plot3: bars.map((_b, i) => ({ time: t(i), value: fin(yHat[i]) })),
      plot4: line(upperIn, 80),
      plot5: line(lowerIn, 80),
      plot6: line(upperOut, 60),
      plot7: line(lowerOut, 60),
    },
    fills: [
      { plot1: 'plot3', plot2: 'plot4', options: { title: 'Bull Zone' }, colors: fillCol(90) },
      { plot1: 'plot3', plot2: 'plot5', options: { title: 'Bear Zone' }, colors: fillCol(90) },
      { plot1: 'plot4', plot2: 'plot6', options: { title: 'Bull Extreme' }, colors: fillCol(80) },
      { plot1: 'plot5', plot2: 'plot7', options: { title: 'Bear Extreme' }, colors: fillCol(80) },
    ],
    markers,
  };
}

export const AdaptiveNadarayaWatson = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
