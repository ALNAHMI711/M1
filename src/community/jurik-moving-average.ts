/**
 * Jurik Moving Average Surrogate
 *
 * Three-stage adaptive filter (surrogate of the Jurik moving average): an EMA-like stage e0 with
 * alpha = beta^power, a detrended stage e1, and a phase-weighted stage e2 that is summed into the JMA.
 * beta = 0.45 * (length - 1) / (0.45 * (length - 1) + 2); phase -100..100 maps to a ratio 0.5..2.5.
 * The line, the bars and (optionally) the background take the direction colour of the JMA slope.
 *
 * Reference: "Jurik Moving Average" by everget
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Copyright (c) 2018-present, Alex Orekhov (everget). Jurik Moving Average Surrogate script may be
 * freely distributed under the MIT license.
 */

import { getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData, BgColorData } from '../types';

export interface JurikMovingAverageInputs {
  length: number;
  /** -100..100 */
  phase: number;
  power: number;
  src: SourceType;
  /** Colour the JMA by its direction */
  highlightDirection: boolean;
  /** Colour the price bars by the JMA direction */
  applyBarColors: boolean;
  /** Colour the background by the JMA direction */
  applyBgColors: boolean;
}

export const defaultInputs: JurikMovingAverageInputs = {
  length: 7,
  phase: 100,
  power: 2,
  src: 'close',
  highlightDirection: true,
  applyBarColors: true,
  applyBgColors: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 7, min: 1 },
  { id: 'phase', type: 'int', title: 'Phase', defval: 100, min: -100, max: 100 },
  { id: 'power', type: 'int', title: 'Power', defval: 2, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'highlightDirection', type: 'bool', title: 'Highlight Direction', defval: true },
  { id: 'applyBarColors', type: 'bool', title: 'Apply Bar Colors', defval: true },
  { id: 'applyBgColors', type: 'bool', title: 'Apply Background Colors', defval: false },
];

const BULLISH_JMA = '#09b71e';
const BEARISH_JMA = '#e91e63';
const DEFAULT_JMA = '#6d1e7f';
const BULLISH = '#4CAF50';
const BEARISH = '#F44336';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'JMA', color: BULLISH_JMA, lineWidth: 2 },
];

export const metadata = {
  title: 'Jurik Moving Average Surrogate',
  shortTitle: 'JMA Surrogate',
  overlay: true,
};

export function calculate(
  bars: Bar[],
  inputs: Partial<JurikMovingAverageInputs> = {},
): IndicatorResult & { barColors: BarColorData[]; bgColors: BgColorData[] } {
  const { length, phase, power, src, highlightDirection, applyBarColors, applyBgColors } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src).toArray();
  const n = bars.length;

  const phaseRatio = phase < -100 ? 0.5 : phase > 100 ? 2.5 : phase / 100 + 1.5;
  const beta = (0.45 * (length - 1)) / (0.45 * (length - 1) + 2);
  const alpha = Math.pow(beta, power);

  // e0 := (1 - alpha) * src + alpha * nz(e0[1]); e1 := (1 - beta) * (src - e0) + beta * nz(e1[1])
  // e2 := (1 - alpha)^2 * (e0 + phaseRatio * e1 - nz(jma[1])) + alpha^2 * nz(e2[1]); jma := e2 + nz(jma[1])
  const jma: number[] = new Array(n);
  let e0 = NaN;
  let e1 = NaN;
  let e2 = NaN;
  const nz = (v: number) => (isNaN(v) ? 0 : v);
  for (let i = 0; i < n; i++) {
    const s = source[i] ?? NaN;
    const prevJma = i > 0 ? jma[i - 1] : NaN;
    e0 = (1 - alpha) * s + alpha * nz(e0);
    e1 = (1 - beta) * (s - e0) + beta * nz(e1);
    e2 = Math.pow(1 - alpha, 2) * (e0 + phaseRatio * e1 - nz(prevJma)) + Math.pow(alpha, 2) * nz(e2);
    jma[i] = e2 + nz(prevJma);
  }

  const bullBar = String(color.new(BULLISH, 50));
  const bearBar = String(color.new(BEARISH, 50));
  const bullBg = String(color.new(BULLISH, 88));
  const bearBg = String(color.new(BEARISH, 88));
  const plot0: { time: number; value: number; color: string }[] = [];
  const barColors: BarColorData[] = [];
  const bgColors: BgColorData[] = [];
  for (let i = 0; i < n; i++) {
    // isBullishSlope = jma > jma[1] (false on the first bar: jma[1] is na)
    const bullish = i > 0 && jma[i] > jma[i - 1];
    const maColor = highlightDirection ? (bullish ? BULLISH_JMA : BEARISH_JMA) : DEFAULT_JMA;
    plot0.push({ time: bars[i].time, value: jma[i], color: maColor });
    if (applyBarColors) barColors.push({ time: bars[i].time, color: bullish ? bullBar : bearBar });
    if (applyBgColors) bgColors.push({ time: bars[i].time, color: bullish ? bullBg : bearBg });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
    barColors,
    bgColors,
  };
}

export const JurikMovingAverage = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
