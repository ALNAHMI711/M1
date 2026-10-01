/**
 * Aura: Adaptive Statistical Smoother
 *
 * A zero-lag target: the EMA of the source, then a second EMA pass over the last `length` values of that EMA
 * (newest to oldest). R² is the squared correlation of the close with the bar index over `length` bars. When R² > 0.5
 * the Aura MA moves toward the target by R² (aura = R² * target + (1 - R²) * aura); otherwise it is held. Bands are
 * the Aura MA +- mult * stdev(source, length). The trend is +1 above the Aura MA and -1 below it (held on a tie); it
 * colours the line, the bands, the cloud between the bands and the bars. BUY / SELL labels mark the close crossing
 * the Aura MA when R² > 0.3.
 *
 * Reference: "Aura: Adaptive Statistical Smoother [Pineify]" by Pineify
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Pineify
 */

import { ta, Series, color, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

export interface AuraAdaptiveStatisticalSmootherInputs {
  /** Statistical window: R² and stdev length, backward EMA pass length */
  length: number;
  /** Forward-backward smoothing: EMA length */
  smooth: number;
  /** Volatility multiplier of the bands */
  mult: number;
  src: SourceType;
  bullCss: string;
  bearCss: string;
}

export const defaultInputs: AuraAdaptiveStatisticalSmootherInputs = {
  length: 20,
  smooth: 10,
  mult: 1.5,
  src: 'close',
  bullCss: '#089981',
  bearCss: '#F23645',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Statistical Window', defval: 20, min: 2 },
  { id: 'smooth', type: 'int', title: 'Forward-Backward Smoothing', defval: 10, min: 1 },
  { id: 'mult', type: 'float', title: 'Volatility Multiplier', defval: 1.5, step: 0.1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'bullCss', type: 'color', title: 'Bullish Color', defval: '#089981' },
  { id: 'bearCss', type: 'color', title: 'Bearish Color', defval: '#F23645' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Band', color: String(color.new('#089981', 70)), lineWidth: 1 },
  { id: 'plot1', title: 'Lower Band', color: String(color.new('#089981', 70)), lineWidth: 1 },
  { id: 'plot2', title: 'Aura MA', color: '#089981', lineWidth: 3 },
];

export const metadata = {
  title: 'Aura: Adaptive Statistical Smoother [Pineify]',
  shortTitle: 'Aura Trend [Pineify]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const nz = (x: number, y: number) => (isNaN(x) ? y : x);

export function calculate(
  bars: Bar[],
  inputs: Partial<AuraAdaptiveStatisticalSmootherInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, smooth, mult } = cfg;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const srcSeries = getSourceSeries(bars, cfg.src);
  const src = A(srcSeries);
  const close = bars.map((b) => b.close);

  // Forward-backward zero-lag approximation
  const ema1 = A(ta.ema(srcSeries, smooth));
  const alpha = 2 / (smooth + 1);
  const target: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    let ema2 = ema1[i];
    // for i = 1 to length - 1 (a loop from 1 down to a lower bound counts down)
    const step = length - 1 >= 1 ? 1 : -1;
    for (let k = 1; step > 0 ? k <= length - 1 : k >= length - 1; k += step) {
      const past = i - k >= 0 ? ema1[i - k] : NaN;
      ema2 += alpha * (nz(past, ema1[i]) - ema2);
    }
    target[i] = ema2;
  }

  // r2 = nz(math.pow(ta.correlation(close, bar_index, length), 2), 0)
  const corr = A(ta.correlation(S(close), S(bars.map((_b, i) => i)), length));
  const r2 = corr.map((c) => nz(Math.pow(c, 2), 0));

  const stdev = A(ta.stdev(srcSeries, length)).map((v) => v * mult);

  const aura: number[] = new Array(n);
  const trendArr: number[] = new Array(n);
  let auraMa = 0.0; // var float aura_ma = 0.0
  let os = 0.0; // var float os = 0.0
  let trend = 1; // var int trend = 1
  for (let i = 0; i < n; i++) {
    const t = target[i];
    // abs_diff = math.abs(target - nz(target, target)): 0, or na while the target is na
    const absDiff = Math.abs(t - nz(t, t));
    os = gt(r2[i], 0.5) ? Math.sign(nz(src[i], src[i]) - nz(t, t)) : nz(os, 0);
    auraMa = gt(r2[i], 0.5) ? r2[i] * t + (1 - r2[i]) * nz(auraMa, t) : nz(auraMa, t) - absDiff * os;
    aura[i] = auraMa;
    trend = gt(close[i], auraMa) ? 1 : lt(close[i], auraMa) ? -1 : nz(trend, 1);
    trendArr[i] = trend;
  }

  const lineColor = (i: number) => (trendArr[i] === 1 ? cfg.bullCss : cfg.bearCss);
  const bandColor = (i: number) => String(color.new(lineColor(i), 70));
  const areaColor = (i: number) => String(color.new(lineColor(i), 85));

  // ta.crossover(close, aura_ma) / ta.crossunder(close, aura_ma): exact comparisons
  const xUp = A(ta.crossover(S(close), S(aura)));
  const xDown = A(ta.crossunder(S(close), S(aura)));
  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    if (xUp[i] === 1 && gt(r2[i], 0.3)) {
      markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: cfg.bullCss, text: 'BUY',
        textColor: color.white, size: 'small' });
    }
    if (xDown[i] === 1 && gt(r2[i], 0.3)) {
      markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: cfg.bearCss, text: 'SELL',
        textColor: color.white, size: 'small' });
    }
    barColors.push({ time: t, color: lineColor(i) });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: aura[i] + stdev[i], color: bandColor(i) })),
      plot1: bars.map((b, i) => ({ time: b.time, value: aura[i] - stdev[i], color: bandColor(i) })),
      plot2: bars.map((b, i) => ({ time: b.time, value: aura[i], color: lineColor(i) })),
    },
    // fill(p_upper, p_lower, areaColor, title = "Volatility Cloud")
    fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'Volatility Cloud' }, colors: bars.map((_b, i) => areaColor(i)) }],
    markers,
    barColors,
  };
}

export const AuraAdaptiveStatisticalSmoother = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
