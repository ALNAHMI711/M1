/**
 * ADX with Shaded Zone
 *
 * Hand-written DMI: true range = max(high - low, |high - close[1]|, |low - close[1]|), +DM = max(change(high), 0),
 * -DM = max(-change(low), 0) (not exclusive, as the Pine script), each smoothed with an RMA of `length`.
 * +DI = 100 * RMA(+DM) / RMA(TR), -DI = 100 * RMA(-DM) / RMA(TR), DX = 100 * |+DI - -DI| / (+DI + -DI),
 * ADX = RMA(DX). Dotted levels at 20 and 25; a grey background on the bars where the ADX is below 25.
 *
 * Reference: "ADX with Shaded Zone" by MathThomas
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';

export interface AdxWithShadedZoneInputs {
  /** RMA length of the true range, the directional movements and the DX */
  length: number;
}

export const defaultInputs: AdxWithShadedZoneInputs = {
  length: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'ADX Length', defval: 14 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '+DI', color: color.green, lineWidth: 1 },
  { id: 'plot1', title: '-DI', color: color.red, lineWidth: 1 },
  { id: 'plot2', title: 'ADX', color: color.blue, lineWidth: 1 },
];

export const metadata = {
  title: 'ADX with Shaded Zone',
  shortTitle: 'ADX with Shaded Zone',
  overlay: false,
};

/** Pine float comparisons: a < b only when b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<AdxWithShadedZoneInputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  // math.max / math.abs of na is na
  const max = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.max(a, b));

  const tr: number[] = new Array(n);
  const plusDM: number[] = new Array(n);
  const minusDM: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const prevClose = i > 0 ? bars[i - 1].close : NaN;
    const highLow = b.high - b.low;
    const highClose = Math.abs(b.high - prevClose);
    const lowClose = Math.abs(b.low - prevClose);
    tr[i] = max(max(highLow, highClose), lowClose);
    // ta.change(high) / ta.change(low): na on bar 0
    const chHigh = i > 0 ? b.high - bars[i - 1].high : NaN;
    const chLow = i > 0 ? b.low - bars[i - 1].low : NaN;
    plusDM[i] = max(chHigh, 0);
    minusDM[i] = max(-chLow, 0);
  }

  const smoothTR = A(ta.rma(S(tr), cfg.length));
  const smoothPlusDM = A(ta.rma(S(plusDM), cfg.length));
  const smoothMinusDM = A(ta.rma(S(minusDM), cfg.length));

  // Plain divisions: x / 0 is +-infinity, 0 / 0 is na (ta.rma skips the infinite values like na)
  const plusDI = smoothPlusDM.map((p, i) => (100 * p) / smoothTR[i]);
  const minusDI = smoothMinusDM.map((m, i) => (100 * m) / smoothTR[i]);
  const dx = plusDI.map((p, i) => (100 * Math.abs(p - minusDI[i])) / (p + minusDI[i]));
  const adx = A(ta.rma(S(dx), cfg.length));

  const fin = (x: number) => (Number.isFinite(x) ? x : NaN);
  const shade = String(color.new(color.gray, 85));
  const bgColors: BgColorData[] = [];
  for (let i = 0; i < n; i++) {
    // bgcolor((adx < 25) ? color.new(color.gray, 85) : na, title = "Shaded Zone (20-25)")
    if (lt(adx[i], 25)) bgColors.push({ time: bars[i].time, color: shade });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: fin(plusDI[i]), color: color.green })),
      plot1: bars.map((b, i) => ({ time: b.time, value: fin(minusDI[i]), color: color.red })),
      plot2: bars.map((b, i) => ({ time: b.time, value: fin(adx[i]), color: color.blue })),
    },
    hlines: [
      { value: 20, options: { title: '20 Level', color: color.red, linestyle: 'dotted' } },
      { value: 25, options: { title: '25 Level', color: color.green, linestyle: 'dotted' } },
    ],
    bgColors,
  };
}

export const AdxWithShadedZone = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
