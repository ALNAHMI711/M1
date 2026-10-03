/**
 * MACD Dynamic Squeeze Pro
 *
 * MACD (EMA fast - EMA slow) with an SMA signal line and a four-colour histogram (growing / falling, above / below
 * zero), a ribbon fill between MACD and signal, and faded dots on the MACD line at every cross. A squeeze is a bar
 * where |histogram| is below `ratio` times its SMA. An "explosion" diamond is drawn on the price chart when MACD
 * crosses the signal in the trend direction (both lines above zero for a bullish cross, below zero for a bearish
 * cross) within `lookback` bars after a squeeze bar.
 *
 * Reference: "MACD Dynamic Squeeze Pro [ZynAlgo]" by ZynAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © ZynAlgo
 */

import { ta, Series, callsite, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface MacdDynamicSqueezeProInputs {
  /** Fast EMA length */
  fastLen: number;
  /** Slow EMA length */
  slowLen: number;
  /** Signal SMA length */
  sigLen: number;
  /** Length of the SMA of |histogram| (compression baseline) */
  sqzLen: number;
  /** Squeeze compression ratio */
  sqzMult: number;
  /** Maximum bars between the squeeze and the explosion trigger */
  sqzLookback: number;
  /** MACD line colour */
  colMacd: string;
  /** Signal line colour */
  colSig: string;
}

export const defaultInputs: MacdDynamicSqueezeProInputs = {
  fastLen: 12,
  slowLen: 26,
  sigLen: 9,
  sqzLen: 20,
  sqzMult: 0.5,
  sqzLookback: 3,
  colMacd: '#FFFFFF',
  colSig: '#FDD835',
};

const GRP_MACD = 'MACD Settings';
const GRP_SQZ = 'Squeeze & Explosion Logic';
const GRP_UI = 'ZynAlgo UI & Colors';

export const inputConfig: InputConfig[] = [
  { id: 'fastLen', type: 'int', title: 'Fast Length', defval: 12, group: GRP_MACD },
  { id: 'slowLen', type: 'int', title: 'Slow Length', defval: 26, group: GRP_MACD },
  { id: 'sigLen', type: 'int', title: 'Signal Length', defval: 9, group: GRP_MACD },
  { id: 'sqzLen', type: 'int', title: 'Momentum Average Length', defval: 20, group: GRP_SQZ },
  { id: 'sqzMult', type: 'float', title: 'Squeeze Compression Ratio', defval: 0.5, step: 0.1, max: 1.0, group: GRP_SQZ },
  { id: 'sqzLookback', type: 'int', title: 'Squeeze Valid Lookback (Bars)', defval: 3, min: 1, group: GRP_SQZ },
  { id: 'colMacd', type: 'color', title: 'MACD Line', defval: '#FFFFFF', group: GRP_UI },
  { id: 'colSig', type: 'color', title: 'Signal Line', defval: '#FDD835', group: GRP_UI },
];

const C_BULL = String(color.rgb(57, 255, 20));
const C_BEAR = String(color.rgb(191, 0, 255));
const C_FALL_ABOVE = String(color.new(C_BULL, 60));
const C_FALL_BELOW = String(color.new(C_BEAR, 60));
const C_RIBBON_BULL = String(color.new(C_BULL, 85));
const C_RIBBON_BEAR = String(color.new(C_BEAR, 85));
const C_CROSS_UP = String(color.new(C_BULL, 50));
const C_CROSS_DOWN = String(color.new(C_BEAR, 50));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Histogram', color: C_BULL, lineWidth: 2, style: 'columns' },
  { id: 'plot1', title: 'MACD Line', color: '#FFFFFF', lineWidth: 2 },
  { id: 'plot2', title: 'Signal Line', color: '#FDD835', lineWidth: 1 },
  { id: 'plot3', title: 'Cross Up', color: C_CROSS_UP, lineWidth: 2, style: 'circles' },
  { id: 'plot4', title: 'Cross Down', color: C_CROSS_DOWN, lineWidth: 2, style: 'circles' },
];

export const metadata = {
  title: 'MACD Dynamic Squeeze Pro [ZynAlgo]',
  shortTitle: 'MACD Squeeze [ZynAlgo]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<MacdDynamicSqueezeProInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const close = S(bars.map((b) => b.close));

  const fastMa = A(ta.ema(close, cfg.fastLen));
  const slowMa = A(ta.ema(close, cfg.slowLen));
  const macd = fastMa.map((f, i) => f - slowMa[i]);
  const macdS = S(macd);
  const signal = A(ta.sma(macdS, cfg.sigLen));
  const signalS = S(signal);
  const hist = macd.map((m, i) => m - signal[i]);

  // Histogram colours
  const histColor = hist.map((h, i) => {
    const prev = i > 0 ? hist[i - 1] : NaN;
    if (gt(h, 0) && gt(h, prev)) return C_BULL;
    if (gt(h, 0) && lt(h, prev)) return C_FALL_ABOVE;
    if (lt(h, 0) && lt(h, prev)) return C_BEAR;
    return C_FALL_BELOW;
  });

  // Plain crosses (dots): ta.crossover / ta.crossunder on every bar
  const crossUp = A(ta.crossover(macdS, signalS));
  const crossDown = A(ta.crossunder(macdS, signalS));

  // Squeeze: hist_abs < ta.sma(hist_abs, sqz_len) * sqz_mult; was_squeezed = ta.barssince(is_squeezed) <= lookback
  const histAbs = hist.map((h) => Math.abs(h));
  const histAvg = A(ta.sma(S(histAbs), cfg.sqzLen));
  const since = callsite.barssince();
  // Explosion: bull_trend and ta.crossover(macd, signal) and was_squeezed. Pine v6 `and` is lazy: the crossover
  // only runs (and keeps history) on the bars where the trend condition is true: one call site each.
  const bullCross = callsite.crossover();
  const bearCross = callsite.crossunder();
  const markers: MarkerData[] = [];
  for (let i = 0; i < n; i++) {
    const isSqueezed = lt(histAbs[i], histAvg[i] * cfg.sqzMult);
    const bs = since(isSqueezed);
    const wasSqueezed = !isNaN(bs) && bs <= cfg.sqzLookback;
    const bullTrend = gt(macd[i], 0) && gt(signal[i], 0);
    const bearTrend = lt(macd[i], 0) && lt(signal[i], 0);
    const bullExplosion = bullTrend && bullCross(macd[i], signal[i]) && wasSqueezed;
    const bearExplosion = bearTrend && bearCross(macd[i], signal[i]) && wasSqueezed;
    // plotshape(bull_explosion ? low : na, shape.diamond, location.belowbar, c_bull, size.small, force_overlay = true)
    if (bullExplosion && !isNaN(bars[i].low)) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'diamond', color: C_BULL, size: 'small', forceOverlay: true });
    }
    if (bearExplosion && !isNaN(bars[i].high)) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'diamond', color: C_BEAR, size: 'small', forceOverlay: true });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: hist[i], color: histColor[i] })),
      plot1: bars.map((b, i) => ({ time: b.time, value: macd[i], color: cfg.colMacd })),
      plot2: bars.map((b, i) => ({ time: b.time, value: signal[i], color: cfg.colSig })),
      // plot(ta.crossover(macd, signal) ? macd : na, 'Cross Up', style = plot.style_circles, ...)
      plot3: bars.map((b, i) => ({ time: b.time, value: crossUp[i] ? macd[i] : NaN, color: C_CROSS_UP })),
      plot4: bars.map((b, i) => ({ time: b.time, value: crossDown[i] ? macd[i] : NaN, color: C_CROSS_DOWN })),
    },
    hlines: [
      { value: 0, options: { title: 'Zero Line', color: String(color.new(color.white, 50)), linestyle: 'dashed' } },
    ],
    fills: [
      // fill(p_macd, p_sig, color = macd > signal ? color.new(c_bull, 85) : color.new(c_bear, 85))
      { plot1: 'plot1', plot2: 'plot2', options: { title: 'Momentum Ribbon' },
        colors: macd.map((m, i) => (gt(m, signal[i]) ? C_RIBBON_BULL : C_RIBBON_BEAR)) },
    ],
    markers,
  };
}

export const MacdDynamicSqueezePro = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
