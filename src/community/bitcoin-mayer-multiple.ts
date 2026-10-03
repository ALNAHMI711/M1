/**
 * Mayer Multiple
 *
 * Mayer Multiple = close / SMA(close, length), drawn as a histogram. Fixed reference lines at 0.55, 0.70, 0.85, 1.00,
 * 1.20, 1.45, 1.90, 2.20, 2.60 and 3.00. The histogram takes the colour of the highest reference level it is above
 * (black at or below 0.55).
 *
 * Reference: "Bitcoin: Mayer Multiple" by sito4713
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface BitcoinMayerMultipleInputs {
  /** Length of the price SMA */
  psmaLength: number;
}

export const defaultInputs: BitcoinMayerMultipleInputs = {
  psmaLength: 200,
};

export const inputConfig: InputConfig[] = [
  { id: 'psmaLength', type: 'int', title: 'Price SMA Length', defval: 200 },
];

const AZURE = String(color.new(color.rgb(0, 128, 255), 0));
const AQUA = String(color.new(color.rgb(0, 255, 255), 0));
const MINT = String(color.new(color.rgb(0, 255, 128), 0));
const CHARTREUSE = String(color.new(color.rgb(128, 255, 0), 0));
const YELLOW = String(color.new(color.rgb(255, 255, 0), 0));
const AMBER = String(color.new(color.rgb(255, 204, 0), 0));
const ORANGE = String(color.new(color.rgb(255, 128, 0), 0));
const RED = String(color.new(color.rgb(255, 0, 0), 0));
const VIOLET = String(color.new(color.rgb(148, 78, 208), 0));
const BLACK = color.black;

/** Reference levels: value, title, colour, width (Pine plot order) */
const LEVELS: [number, string, string, number][] = [
  [0.55, 'Smash Buy', BLACK, 2],
  [0.7, '90% Higher', VIOLET, 2],
  [0.85, '75% Higher', AZURE, 2],
  [1.0, 'Boost DCA', AQUA, 1],
  [1.2, 'Median', MINT, 1],
  [1.45, 'Caution', CHARTREUSE, 1],
  [1.9, 'Danger', YELLOW, 1],
  [2.2, 'Extreme Euphoria', AMBER, 1],
  [2.6, 'Correction Imminent', ORANGE, 1],
  [3.0, 'Correction Imminent', RED, 1],
];

export const plotConfig: PlotConfig[] = [
  ...LEVELS.map(([, title, c, w], k) => ({ id: `plot${k}`, title, color: c, lineWidth: w })),
  { id: 'plot10', title: 'Mayer Multiple', color: BLACK, lineWidth: 3, style: 'histogram' },
];

export const metadata = {
  title: 'Mayer Multiple',
  shortTitle: 'Mayer Multiple',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(bars: Bar[], inputs: Partial<BitcoinMayerMultipleInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const close = Series.fromArray(bars, bars.map((b) => b.close));
  const ma = A(ta.sma(close, cfg.psmaLength));

  const plots: Record<string, { time: number; value: number; color?: string }[]> = {};
  LEVELS.forEach(([value, , c], k) => {
    plots[`plot${k}`] = bars.map((b) => ({ time: b.time, value, color: c }));
  });
  plots.plot10 = bars.map((b, i) => {
    const multiple = b.close / ma[i];
    const c = gt(multiple, 2.6) ? RED
      : gt(multiple, 2.2) ? ORANGE
      : gt(multiple, 1.9) ? AMBER
      : gt(multiple, 1.45) ? YELLOW
      : gt(multiple, 1.2) ? CHARTREUSE
      : gt(multiple, 1.0) ? MINT
      : gt(multiple, 0.85) ? AQUA
      : gt(multiple, 0.7) ? AZURE
      : gt(multiple, 0.55) ? VIOLET
      : BLACK;
    return { time: b.time, value: Number.isFinite(multiple) ? multiple : NaN, color: c };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
  };
}

export const BitcoinMayerMultiple = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
