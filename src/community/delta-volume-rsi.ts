/**
 * Delta Volume RSI
 *
 * RSI of the tick-rule volume delta: the delta is +volume on an up close, -volume on a down close and 0 otherwise.
 * gains = rma(positive delta, period), losses = rma(-negative delta, period) (0.0001 when losses is 0);
 * RSI = 100 - 100 / (1 + gains / losses). The line is green at 50 and above, red below. Lines at 70, 50 and 30.
 *
 * Reference: "Delta Volume RSI" by destrobr0685
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface DeltaVolumeRsiInputs {
  /** RSI period */
  period: number;
}

export const defaultInputs: DeltaVolumeRsiInputs = {
  period: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'period', type: 'int', title: 'RSI Period', defval: 14 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Delta Volume RSI', color: color.green, lineWidth: 2 },
];

export const metadata = {
  title: 'Delta Volume RSI',
  shortTitle: 'Delta Volume RSI',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

export function calculate(bars: Bar[], inputs: Partial<DeltaVolumeRsiInputs> = {}): IndicatorResult {
  const { period } = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  // deltaVolume = close > close[1] ? volume : close < close[1] ? -volume : 0
  const delta = bars.map((b, i) => {
    const prev = i > 0 ? bars[i - 1].close : NaN;
    const v = b.volume ?? NaN;
    return gt(b.close, prev) ? v : lt(b.close, prev) ? -v : 0;
  });
  const gains = A(ta.rma(S(delta.map((d) => (gt(d, 0) ? d : 0))), period));
  const lossesRaw = A(ta.rma(S(delta.map((d) => (lt(d, 0) ? -d : 0))), period));

  const plot0 = bars.map((b, i) => {
    const losses = eq(lossesRaw[i], 0) ? 0.0001 : lossesRaw[i];
    const fr = gains[i] / losses;
    const rsi = 100 - 100 / (1 + fr);
    return { time: b.time, value: Number.isFinite(rsi) ? rsi : NaN, color: ge(rsi, 50) ? color.green : color.red };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
    hlines: [
      { value: 70, options: { title: 'Overbought', color: color.red, linestyle: 'dashed' } },
      { value: 50, options: { title: 'Middle', color: color.gray, linestyle: 'dashed' } },
      { value: 30, options: { title: 'Oversold', color: color.green, linestyle: 'dashed' } },
    ],
  };
}

export const DeltaVolumeRsi = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
