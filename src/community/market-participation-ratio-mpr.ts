/**
 * Market Participation Ratio (MPR)
 *
 * The price ratio close / sma(close, length) times the volume ratio volume / sma(volume, length), scaled by 100,
 * smoothed by an EMA over `smoothLength` bars. The line is magenta above 100, dark grey below 100 and grey at 100.
 * Horizontal lines at 0, 100 and 50.
 *
 * Reference: "Market Participation Ratio-MPR(TechnoBlooms)" by TechnoBlooms
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: This indicator is created under TechnoBlooms - Innovating Trading Indicators and Strategies.
 * All rights reserved. Unauthorized copying or distribution is prohibited. © TechnoBlooms
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface MarketParticipationRatioMprInputs {
  /** SMA length of the price and of the volume */
  length: number;
  /** EMA length of the smoothing */
  smoothLength: number;
}

export const defaultInputs: MarketParticipationRatioMprInputs = {
  length: 14,
  smoothLength: 7,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
  { id: 'smoothLength', type: 'int', title: 'Smoothing Length', defval: 7, min: 1 },
];

const ABOVE = String(color.rgb(230, 56, 221));
const BELOW = String(color.rgb(85, 85, 80));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Smoothed MPR', color: ABOVE, lineWidth: 3 },
];

export const metadata = {
  title: 'Market Participation Ratio-MPR(TechnoBlooms)',
  shortTitle: 'MPR',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(bars: Bar[], inputs: Partial<MarketParticipationRatioMprInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const close = bars.map((b) => b.close);
  const volume = bars.map((b) => b.volume ?? NaN);

  const priceMA = A(ta.sma(S(close), cfg.length));
  const volumeMA = A(ta.sma(S(volume), cfg.length));
  // Plain divisions: x / 0 is +-infinity (ta.ema skips it like na), 0 / 0 is na
  const mpr = bars.map((_b, i) => (close[i] / priceMA[i]) * (volume[i] / volumeMA[i]) * 100);
  const smoothMPR = A(ta.ema(S(mpr), cfg.smoothLength));

  const plot0 = bars.map((b, i) => {
    const v = smoothMPR[i];
    const c = gt(v, 100) ? ABOVE : lt(v, 100) ? BELOW : color.gray;
    return { time: b.time, value: Number.isFinite(v) ? v : NaN, color: c };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
    hlines: [
      { value: 0, options: { title: 'Zero Line', color: '#eceff5fb', linestyle: 'dashed', linewidth: 1 } },
      { value: 100, options: { title: 'Level 100', color: String(color.rgb(12, 250, 159)), linestyle: 'dotted', linewidth: 2 } },
      { value: 50, options: { title: 'Level 50', color: color.red, linestyle: 'dotted', linewidth: 1 } },
    ],
  };
}

export const MarketParticipationRatioMpr = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
