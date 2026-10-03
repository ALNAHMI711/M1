/**
 * Strict 1-Signal Pro Scalper v2
 *
 * A VWMA of hlc3 and an EMA trend baseline of the close. BUY when the close crosses over the VWMA while the VWMA
 * rises and the last signal was not a BUY; SELL when the close crosses under the VWMA while the VWMA falls and the
 * last signal was not a SELL (signals alternate). The signals are text labels at the bar low (BUY) / high (SELL).
 *
 * Reference: "Pro Scalper - 2 MinutesTF by Ayoob" by FGMNDFBF
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface ProScalperAyoobInputs {
  /** VWMA length */
  lenVwma: number;
  /** EMA length of the trend baseline */
  lenTrend: number;
}

export const defaultInputs: ProScalperAyoobInputs = {
  lenVwma: 7,
  lenTrend: 200,
};

export const inputConfig: InputConfig[] = [
  { id: 'lenVwma', type: 'int', title: 'VWMA Length', defval: 7 },
  { id: 'lenTrend', type: 'int', title: 'Institutional Trend MA', defval: 200 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VWMA 7', color: color.blue, lineWidth: 2 },
  { id: 'plot1', title: '200 Trend Baseline', color: color.gray, lineWidth: 2 },
];

export const metadata = {
  title: 'Strict 1-Signal Pro Scalper v2',
  shortTitle: 'Strict 1-Signal Pro Scalper v2',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<ProScalperAyoobInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const close = S(bars.map((b) => b.close));

  const vwma7 = ta.vwma(S(bars.map((b) => (b.high + b.low + b.close) / 3)), cfg.lenVwma, S(bars.map((b) => b.volume ?? NaN)));
  const trendMA = A(ta.ema(close, cfg.lenTrend));
  const crossUp = A(ta.crossover(close, vwma7));
  const crossDn = A(ta.crossunder(close, vwma7));
  const vw = A(vwma7);

  const markers: MarkerData[] = [];
  const noShape = String(color.new(color.white, 100));
  let state = 0; // var int current_state = 0
  for (let i = 0; i < n; i++) {
    const prev = i > 0 ? vw[i - 1] : NaN;
    const rising = gt(vw[i], prev); // vwma7 > vwma7[1]
    const falling = gt(prev, vw[i]); // vwma7 < vwma7[1]
    let isLong = false;
    let isShort = false;
    if (crossUp[i] === 1 && rising && state !== 1) {
      isLong = true;
      state = 1;
    }
    if (crossDn[i] === 1 && falling && state !== -1) {
      isShort = true;
      state = -1;
    }
    // plotshape(isLong ? low : na, location.absolute, color.new(color.white, 100), shape.labelup, text = "BUY",
    //   textcolor = color.green, size.small)
    if (isLong) {
      markers.push({ time: bars[i].time, position: 'atPriceBottom', price: bars[i].low, shape: 'labelUp',
        color: noShape, text: 'BUY', textColor: color.green, size: 'small' });
    }
    if (isShort) {
      markers.push({ time: bars[i].time, position: 'atPriceTop', price: bars[i].high, shape: 'labelDown',
        color: noShape, text: 'SELL', textColor: color.red, size: 'small' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: vw[i], color: color.blue })),
      plot1: bars.map((b, i) => ({ time: b.time, value: trendMA[i], color: color.gray })),
    },
    markers,
  };
}

export const ProScalperAyoob = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
