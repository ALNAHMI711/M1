/**
 * Percent Off All-time High (% Off High)
 *
 * The all-time high is the highest bar high seen so far (it starts at the high of the first bar). The line is the
 * distance of the close from it in percent: (close / ATH - 1) * 100 (0 on a new high, negative below it).
 *
 * Reference: "Percent Off All-time High (% Off High)" by xHmmmmm
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © xHmmmmm
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

// The Pine script has no inputs
export interface PercentOffAllTimeHighInputs {}

export const defaultInputs: PercentOffAllTimeHighInputs = {};

export const inputConfig: InputConfig[] = [];

/** Pine default plot colour */
const PLOT_COLOR = '#2962FF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '% Off High', color: PLOT_COLOR, lineWidth: 1 },
];

export const metadata = {
  title: '% off high',
  shortTitle: '% off high',
  overlay: false,
  format: 'percent',
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(bars: Bar[], _inputs: Partial<PercentOffAllTimeHighInputs> = {}): IndicatorResult {
  // GetATH(high): var ATH = high (first bar); if high > nz(ATH, -1e10) then ATH := high
  let ath = NaN;
  const plot0 = bars.map((b, i) => {
    if (i === 0) ath = b.high;
    if (gt(b.high, isNaN(ath) ? -1e10 : ath)) ath = b.high;
    // A plain division: x / 0 is +-infinity (0 / 0 NaN); the plot shows na for both
    const v = (b.close / ath - 1) * 100;
    return { time: b.time, value: Number.isFinite(v) ? v : NaN, color: PLOT_COLOR };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, format: metadata.format },
    plots: { plot0 },
  };
}

export const PercentOffAllTimeHigh = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
