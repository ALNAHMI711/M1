/**
 * Mean Angles
 *
 * Slope angles (radians) of five moving averages (EMA or SMA) of close * scale: for each average,
 * atan((ma - ma[range]) / range). A not-yet-defined average counts as 0. The leading trend uses a short average,
 * the four strength lines use longer ones. Optional dotted levels at +pi/2, 0 and -pi/2.
 *
 * Reference: "Mean Angles" by bharatTrader
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © bharatTrader
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface MeanAnglesInputs {
  /** Number of bars of the slope (Range) */
  base: number;
  /** Mean type: 'EMA' or 'SMA' */
  mean: 'EMA' | 'SMA';
  /** Length of the leading trend average */
  len0: number;
  len1: number;
  len2: number;
  len3: number;
  len4: number;
  /** Multiplier of the close */
  scale: number;
  showLeadingTrend: boolean;
  showLeadingTrendOnly: boolean;
  showRadianLevels: boolean;
}

export const defaultInputs: MeanAnglesInputs = {
  base: 5,
  mean: 'EMA',
  len0: 5,
  len1: 20,
  len2: 50,
  len3: 100,
  len4: 200,
  scale: 1,
  showLeadingTrend: true,
  showLeadingTrendOnly: false,
  showRadianLevels: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'base', type: 'int', title: 'Range', defval: 5, min: 1 },
  { id: 'mean', type: 'string', title: 'Mean Type', defval: 'EMA', options: ['EMA', 'SMA'] },
  { id: 'len0', type: 'int', title: 'Leading Trend', defval: 5, min: 1 },
  { id: 'len1', type: 'int', title: 'EMA 1', defval: 20, min: 1 },
  { id: 'len2', type: 'int', title: 'EMA 2', defval: 50, min: 1 },
  { id: 'len3', type: 'int', title: 'EMA 3', defval: 100, min: 1 },
  { id: 'len4', type: 'int', title: 'EMA 4', defval: 200, min: 1 },
  { id: 'scale', type: 'int', title: 'Scale', defval: 1, min: 1 },
  { id: 'showLeadingTrend', type: 'bool', title: 'Leading Trend Angle', defval: true },
  { id: 'showLeadingTrendOnly', type: 'bool', title: 'Only Leading Trend Angle', defval: false },
  { id: 'showRadianLevels', type: 'bool', title: 'Angle Levels', defval: false },
];

const COL0 = String(color.new(color.navy, 33));
const COL1 = String(color.new(color.fuchsia, 35));
const COL2 = String(color.new(color.orange, 35));
const COL3 = String(color.new(color.green, 35));
const COL4 = String(color.new(color.red, 35));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Leading Trend', color: COL0, lineWidth: 2 },
  { id: 'plot1', title: 'Strength 1', color: COL1, lineWidth: 2 },
  { id: 'plot2', title: 'Strength 2', color: COL2, lineWidth: 2 },
  { id: 'plot3', title: 'Strength 3', color: COL3, lineWidth: 2 },
  { id: 'plot4', title: 'Strength 4', color: COL4, lineWidth: 2 },
];

export const metadata = {
  title: 'Mean Angles',
  shortTitle: 'Meangles',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<MeanAnglesInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const { base } = cfg;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const myClose = Series.fromArray(bars, bars.map((b) => b.close * cfg.scale));
  const isEma = cfg.mean === 'EMA';

  // ma = nz(ta.ema(my_close, len)) (or nz(ta.sma(...))); angle = math.atan((ma - ma[base]) / base)
  const angle = (len: number): number[] => {
    const ma = A(isEma ? ta.ema(myClose, len) : ta.sma(myClose, len)).map((v) => (isNaN(v) ? 0 : v));
    return ma.map((v, i) => (i - base >= 0 ? Math.atan((v - ma[i - base]) / base) : NaN));
  };
  const angles = [cfg.len0, cfg.len1, cfg.len2, cfg.len3, cfg.len4].map(angle);
  const shown = [cfg.showLeadingTrend, ...new Array(4).fill(!cfg.showLeadingTrendOnly)];
  const cols = [COL0, COL1, COL2, COL3, COL4];

  const plots: IndicatorResult['plots'] = {};
  angles.forEach((a, k) => {
    plots[`plot${k}`] = bars.map((b, i) => ({ time: b.time, value: shown[k] ? a[i] : NaN, color: cols[k] }));
  });

  // Pi = 3.14159; hline(+-Pi / 2) and hline(0), dotted, width 3, colour na unless showRadianLevels
  const piBy2 = 3.14159 / 2;
  const level = (c: string) => (cfg.showRadianLevels ? c : 'transparent');
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    hlines: [
      { value: piBy2, options: { title: 'Pi / 2', color: level(color.green), linestyle: 'dotted', linewidth: 3 } },
      { value: 0, options: { title: 'Zero', color: level(color.gray), linestyle: 'dotted', linewidth: 3 } },
      { value: -piBy2, options: { title: '-Pi / 2', color: level(color.red), linestyle: 'dotted', linewidth: 3 } },
    ],
  };
}

export const MeanAngles = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
