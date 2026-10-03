/**
 * WD Gann Square Root Levels
 *
 * Constant levels around a base price: the square root of the base price plus / minus 0.25, 0.50, 1.00 and 1.50,
 * squared again. The four levels above are the resistances, the four levels below the supports; the base price is
 * drawn too.
 *
 * Reference: "HTH - WD Gann Square Root Levels" by tamillselvan
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { math, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface HthWdGannSquareRootLevelsInputs {
  /** Base price of the levels */
  basePrice: number;
}

export const defaultInputs: HthWdGannSquareRootLevelsInputs = {
  basePrice: 55168.90,
};

export const inputConfig: InputConfig[] = [
  { id: 'basePrice', type: 'float', title: 'Base Price', defval: 55168.90 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Resistance 1', color: color.red, lineWidth: 1 },
  { id: 'plot1', title: 'Resistance 2', color: color.red, lineWidth: 1 },
  { id: 'plot2', title: 'Resistance 3', color: color.red, lineWidth: 1 },
  { id: 'plot3', title: 'Resistance 4', color: color.red, lineWidth: 1 },
  { id: 'plot4', title: 'Support 1', color: color.green, lineWidth: 1 },
  { id: 'plot5', title: 'Support 2', color: color.green, lineWidth: 1 },
  { id: 'plot6', title: 'Support 3', color: color.green, lineWidth: 1 },
  { id: 'plot7', title: 'Support 4', color: color.green, lineWidth: 1 },
  { id: 'plot8', title: 'Base Price', color: color.blue, lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'WD Gann Square Root Levels',
  shortTitle: 'WD Gann Square Root Levels',
  overlay: true,
};

/** Angle fractions (45, 90, 180 ... degrees) */
const ANGLE_FRACTIONS = [0.25, 0.50, 1.00, 1.50];

export function calculate(
  bars: Bar[],
  inputs: Partial<HthWdGannSquareRootLevelsInputs> = {},
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const sqrtPrice = math.sqrt(cfg.basePrice);
  const res = ANGLE_FRACTIONS.map((f) => math.pow(sqrtPrice + f, 2));
  const sup = ANGLE_FRACTIONS.map((f) => math.pow(sqrtPrice - f, 2));
  const levels = [...res, ...sup, cfg.basePrice];
  const colors = [...res.map(() => color.red), ...sup.map(() => color.green), color.blue];

  const plots: IndicatorResult['plots'] = {};
  levels.forEach((level, k) => {
    plots[`plot${k}`] = bars.map((b) => ({ time: b.time, value: Number.isFinite(level) ? level : NaN, color: colors[k] }));
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
  };
}

export const HthWdGannSquareRootLevels = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
