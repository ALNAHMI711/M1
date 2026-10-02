/**
 * Multiple RSI
 *
 * Three RSI lines of the close (fast, medium, slow lengths). The fast line is green when it is at or above the medium
 * line (else yellow), the medium line blue when it is at or above the slow line (else orange), the slow line aqua when
 * the three lines are in order fast >= medium >= slow (else red). Triangles at the bottom of the pane mark the
 * crossovers / crossunders of the medium line and the slow line. Dotted lines at the overbought, 50 and oversold
 * levels with a light fill between them.
 *
 * Reference: "Multiple RSI" by PrasadJoshi12
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © PrasadJoshi12
 */

import { taCore, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface MultipleRsiInputs {
  /** Fast RSI length */
  fastRSILength: number;
  /** Medium RSI length */
  mediumRSILength: number;
  /** Slow RSI length */
  slowRSILength: number;
  /** Overbought level (hline) */
  overBoughtLevel: number;
  /** Oversold level (hline) */
  overSoldLevel: number;
  /** Dark theme: gray level lines (else black) */
  darkTheme: boolean;
}

export const defaultInputs: MultipleRsiInputs = {
  fastRSILength: 8,
  mediumRSILength: 12,
  slowRSILength: 16,
  overBoughtLevel: 70,
  overSoldLevel: 30,
  darkTheme: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastRSILength', type: 'int', title: 'Fast RSI', defval: 8 },
  { id: 'mediumRSILength', type: 'int', title: 'Medium RSI', defval: 12 },
  { id: 'slowRSILength', type: 'int', title: 'Slow RSI', defval: 16 },
  { id: 'overBoughtLevel', type: 'int', title: 'Default Overbought level', defval: 70 },
  { id: 'overSoldLevel', type: 'int', title: 'Default Oversold level', defval: 30 },
  { id: 'darkTheme', type: 'bool', title: 'Is Dark Theme', defval: true },
];

// display = display.all - display.status_line on every plot (drawn in the pane)
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast RSI', color: color.green, lineWidth: 1 },
  { id: 'plot1', title: 'Midum RSI', color: color.blue, lineWidth: 1 },
  { id: 'plot2', title: 'Slow RSI', color: color.aqua, lineWidth: 1 },
];

/** hline(70 / 50 / 30, color = gray (dark theme), linestyle = dotted) with the default inputs */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_ob', price: 70, title: 'Overbought Level', color: color.gray, linestyle: 'dotted' },
  { id: 'hline_mid', price: 50, title: 'Middle Level', color: color.gray, linestyle: 'dotted' },
  { id: 'hline_os', price: 30, title: 'Oversold Level', color: color.gray, linestyle: 'dotted' },
];

const FILL_COLOR = String(color.new('#cc8cb3', 90));

/** fill(hline_30, hline_50) and fill(hline_50, hline_70), color.new(#cc8cb3, 90) */
export const fillConfig: FillConfig[] = [
  { id: 'fill_low', plot1: 'hline_os', plot2: 'hline_mid', color: FILL_COLOR, title: 'Hlines Background' },
  { id: 'fill_high', plot1: 'hline_mid', plot2: 'hline_ob', color: FILL_COLOR, title: 'Hlines Background' },
];

export const metadata = {
  title: 'Multiple RSI',
  shortTitle: 'MultiRSI',
  overlay: false,
};

/** Pine float comparisons: a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

export function calculate(
  bars: Bar[],
  inputs: Partial<MultipleRsiInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const close = bars.map((b) => b.close);
  const rsiFast = taCore.rsi(close, cfg.fastRSILength);
  const rsiMedium = taCore.rsi(close, cfg.mediumRSILength);
  const rsiSlow = taCore.rsi(close, cfg.slowRSILength);

  const plot0: { time: number; value: number; color: string }[] = [];
  const plot1: { time: number; value: number; color: string }[] = [];
  const plot2: { time: number; value: number; color: string }[] = [];
  const markers: MarkerData[] = [];
  // ta.crossover / ta.crossunder compare exactly (no 1e-10), with the last bar where both values were not na
  let prevMedium = NaN;
  let prevSlow = NaN;
  for (let i = 0; i < n; i++) {
    const f = rsiFast[i];
    const m = rsiMedium[i];
    const s = rsiSlow[i];
    const fastUp = ge(f, m);
    const mediumUp = ge(m, s);
    const slowUp = ge(f, m) && ge(m, s) && ge(f, s);
    const t = bars[i].time;
    plot0.push({ time: t, value: f, color: fastUp ? color.green : color.yellow });
    plot1.push({ time: t, value: m, color: mediumUp ? color.blue : color.orange });
    plot2.push({ time: t, value: s, color: slowUp ? color.aqua : color.red });

    if (!isNaN(m) && !isNaN(s)) {
      const crossedOver = m > s && prevMedium <= prevSlow;
      const crossedUnder = m < s && prevMedium >= prevSlow;
      // plotshape(..., style = shape.triangleup / triangledown, location = location.bottom, size = size.tiny)
      if (crossedOver) markers.push({ time: t, position: 'bottom', shape: 'triangleUp', color: color.fuchsia, size: 'tiny' });
      if (crossedUnder) markers.push({ time: t, position: 'bottom', shape: 'triangleDown', color: color.red, size: 'tiny' });
      prevMedium = m;
      prevSlow = s;
    }
  }

  // var HlineColor = DarkTheme ? color.gray : color.black
  const hlineColor = cfg.darkTheme ? color.gray : color.black;
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2 },
    hlines: [
      { value: cfg.overBoughtLevel, options: { title: 'Overbought Level', color: hlineColor, linestyle: 'dotted' } },
      { value: 50, options: { title: 'Middle Level', color: hlineColor, linestyle: 'dotted' } },
      { value: cfg.overSoldLevel, options: { title: 'Oversold Level', color: hlineColor, linestyle: 'dotted' } },
    ],
    fills: [
      { plot1: 'hline_os', plot2: 'hline_mid', options: { title: 'Hlines Background', color: FILL_COLOR } },
      { plot1: 'hline_mid', plot2: 'hline_ob', options: { title: 'Hlines Background', color: FILL_COLOR } },
    ],
    markers,
  };
}

export const MultipleRsi = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
