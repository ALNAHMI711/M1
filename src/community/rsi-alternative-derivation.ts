/**
 * RSI: Alternative Derivation
 *
 * An RSI built from the distance of the close to its Wilder average: distance = close - RMA(close, length),
 * standardized by the Wilder average of the absolute close-to-close change (RMA(|close - close[1]|, length)),
 * normalized by (length - 1) and mapped to 0..100: RSI = 50 * (1 + normalized distance). The "Show Steps" input
 * draws one step of the computation instead (change, distance, standardized distance, normalized distance, RSI).
 * An optional line draws the regular ta.rsi for comparison.
 *
 * Reference: "RSI: alternative derivation" by AdaptiveRSI
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: This Pine Script code is subject to the terms of the Creative Commons
 * Attribution-NonCommercial-ShareAlike 4.0 International License (https://creativecommons.org/licenses/by-nc-sa/4.0/).
 * © AdaptiveRSI
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export type RsiAlternativeDerivationStep = 'change' | 'distance' | 'standardized distance' | 'normalized distance' | 'RSI';

export interface RsiAlternativeDerivationInputs {
  /** Length of the Wilder averages */
  length: number;
  /** Step of the computation to draw */
  step: RsiAlternativeDerivationStep;
  /** Draw the regular RSI for comparison */
  rsiComparison: boolean;
}

export const defaultInputs: RsiAlternativeDerivationInputs = {
  length: 14,
  step: 'RSI',
  rsiComparison: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 2 },
  {
    id: 'step', type: 'string', title: 'Show Steps:', defval: 'RSI',
    options: ['change', 'distance', 'standardized distance', 'normalized distance', 'RSI'],
  },
  { id: 'rsiComparison', type: 'bool', title: 'Plot Regular RSI for Comparison', defval: false },
];

const ALT_COL = String(color.new(color.gray, 50));
const RSI_COL = String(color.new(color.red, 25));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'alternative RSI', color: ALT_COL, lineWidth: 3 },
  { id: 'plot1', title: 'regular RSI', color: RSI_COL, lineWidth: 1 },
];

export const metadata = {
  title: 'RSI: Alternative Derivation',
  shortTitle: 'AdaptiveRSI · RSI alternative derivation',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<RsiAlternativeDerivationInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const { length } = cfg;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const closeArr = bars.map((b) => b.close);
  const close = S(closeArr);

  // myEMA = ta.rma(close, Length); CC_vol = ta.rma(math.abs(close - close[1]), Length)
  const myEma = A(ta.rma(close, length));
  const absChange = closeArr.map((c, i) => (i > 0 ? Math.abs(c - closeArr[i - 1]) : NaN));
  const ccVol = A(ta.rma(S(absChange), length));
  const normalizationFactor = length - 1.0;
  // ta.rsi inside the ternary: it runs on every bar when the input is on, never when it is off
  const rsi = cfg.rsiComparison ? A(ta.rsi(close, length)) : null;

  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const plot0 = bars.map((b, i) => {
    const distance = b.close - myEma[i];
    // A plain division: x / 0 is +-infinity (0 / 0 NaN); the plot shows na for both
    const standardized = distance / ccVol[i];
    const normalized = standardized / normalizationFactor;
    const myRsi = 50 * (1 + normalized);
    let v: number;
    switch (cfg.step) {
      case 'change': v = ccVol[i]; break;
      case 'distance': v = distance; break;
      case 'standardized distance': v = standardized; break;
      case 'normalized distance': v = normalized; break;
      case 'RSI': v = myRsi; break;
      default: v = NaN;
    }
    return { time: b.time, value: fin(v), color: ALT_COL };
  });
  const plot1 = bars.map((b, i) => ({ time: b.time, value: rsi ? fin(rsi[i]) : NaN, color: RSI_COL }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1 },
  };
}

export const RsiAlternativeDerivation = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
