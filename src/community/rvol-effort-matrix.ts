/**
 * RVOL Effort Matrix
 *
 * Relative volume: rvol = volume / sma(volume, lookback), in four zones (below average, average, above average,
 * extreme) by three thresholds, each with its own colour. The buy / sell split estimates 70 % buy volume on an up
 * candle, 30 % on a down candle and 50 % otherwise; buy and sell relative volumes are drawn as columns (the sell
 * columns one bar to the left), with the RVOL line on top. Optional background colour by zone.
 *
 * Reference: "RVOL Effort Matrix" by TheLeadingIndicator
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Open Source | Designed by Adrian Dyer for "The Leading Indicator", Engineered by PineForge
 * Laboratory (2025)
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import { barInterval, barTime } from '../bar-time';

export interface RvolEffortMatrixInputs {
  /** Average volume lookback */
  lookback: number;
  /** Average volume threshold */
  avgThresh: number;
  /** Above average threshold */
  aboveThresh: number;
  /** Extreme volume threshold */
  strongThresh: number;
  colBelow: string;
  colAvg: string;
  colAbove: string;
  colExtreme: string;
  /** Background highlight by zone */
  showBG: boolean;
  /** Show the buy / sell ratio overlay (else the total RVOL columns) */
  showSplitOverlay: boolean;
}

export const defaultInputs: RvolEffortMatrixInputs = {
  lookback: 22,
  avgThresh: 0.702,
  aboveThresh: 1.414,
  strongThresh: 4.0,
  colBelow: color.red,
  colAvg: color.yellow,
  colAbove: color.green,
  colExtreme: color.fuchsia,
  showBG: false,
  showSplitOverlay: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'Average Volume Lookback', defval: 22, min: 1, group: 'Settings' },
  { id: 'avgThresh', type: 'float', title: 'Average Volume Threshold', defval: 0.702, min: 0.1, step: 0.1, group: 'Settings' },
  { id: 'aboveThresh', type: 'float', title: 'Above Average Threshold', defval: 1.414, min: 0.5, step: 0.05, group: 'Settings' },
  { id: 'strongThresh', type: 'float', title: 'Extreme Volume Threshold', defval: 4.0, min: 1.5, step: 0.5, group: 'Settings' },
  { id: 'colBelow', type: 'color', title: 'Below Avg', defval: color.red, group: 'Colors' },
  { id: 'colAvg', type: 'color', title: 'Avg Zone', defval: color.yellow, group: 'Colors' },
  { id: 'colAbove', type: 'color', title: 'Above Avg', defval: color.green, group: 'Colors' },
  { id: 'colExtreme', type: 'color', title: 'Extreme', defval: color.fuchsia, group: 'Colors' },
  { id: 'showBG', type: 'bool', title: 'Background Highlight by Zone', defval: false, group: 'Display Options' },
  { id: 'showSplitOverlay', type: 'bool', title: 'Show Buy/Sell Ratio Overlay', defval: true, group: 'Display Options' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Relativity Overlay', color: color.red, lineWidth: 1, style: 'line' },
  { id: 'plot1', title: 'Total RVOL', color: color.red, lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'Buy RVOL', color: String(color.new(color.green, 0)), lineWidth: 1, style: 'columns' },
  { id: 'plot3', title: 'Sell RVOL', color: String(color.new(color.red, 20)), lineWidth: 1, style: 'columns', offset: -1 },
];

export const metadata = {
  title: 'RVOL Effort Matrix',
  shortTitle: 'RVOL',
  overlay: false,
  precision: 1,
  format: 'volume',
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };

export function calculate(
  bars: Bar[],
  inputs: Partial<RvolEffortMatrixInputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const volume = bars.map((b) => b.volume ?? NaN);
  const avgVol = ta.sma(Series.fromArray(bars, volume), cfg.lookback).toArray().map((v) => v ?? NaN);
  const interval = barInterval(bars);
  // Plain divisions: x / 0 is +-infinity (0 / 0 na); the zone comparisons use the infinite value, plots show na
  const fin = (x: number) => (Number.isFinite(x) ? x : NaN);

  const sellBelow = String(color.new(color.red, 70));
  const sellOther = String(color.new(color.red, 20));
  const buyColor = String(color.new(color.green, 0));
  const bgZone = [
    String(color.new(color.red, 80)),
    String(color.new(color.yellow, 80)),
    String(color.new(color.green, 80)),
    String(color.new(color.fuchsia, 80)),
  ];
  const zoneColor = [cfg.colBelow, cfg.colAvg, cfg.colAbove, cfg.colExtreme];

  const plot0: Point[] = [];
  const plot1: Point[] = [];
  const plot2: Point[] = [];
  const plot3: Point[] = [];
  const bgColors: BgColorData[] = [];
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const t = b.time;
    const vol = volume[i];
    const rvol = vol / avgVol[i];
    // zone = rvol < avgThresh ? 0 : rvol < aboveThresh ? 1 : rvol < strongThresh ? 2 : 3 (na rvol: 3)
    const zone = lt(rvol, cfg.avgThresh) ? 0 : lt(rvol, cfg.aboveThresh) ? 1 : lt(rvol, cfg.strongThresh) ? 2 : 3;
    const volColor = zoneColor[zone];
    const bodyUp = gt(b.close, b.open);
    const bodyDown = lt(b.close, b.open);
    const volBuy = bodyUp ? vol * 0.7 : bodyDown ? vol * 0.3 : vol * 0.5;
    const volSell = vol - volBuy;
    const rvolBuy = volBuy / avgVol[i];
    const rvolSell = volSell / avgVol[i];

    plot0.push({ time: t, value: cfg.showSplitOverlay ? fin(rvol) : NaN, color: volColor });
    plot1.push({ time: t, value: cfg.showSplitOverlay ? NaN : fin(rvol), color: volColor });
    plot2.push({ time: t, value: cfg.showSplitOverlay ? fin(rvolBuy) : NaN, color: buyColor });
    // plot(..., "Sell RVOL", offset = -1): the value (and colour) of bar i is drawn on bar i - 1
    if (i >= 1) {
      plot3.push({
        time: barTime(bars, i - 1, interval),
        value: cfg.showSplitOverlay ? fin(rvolSell) : NaN,
        color: zone === 0 ? sellBelow : sellOther,
      });
    }
    // bgcolor(showBG ? bgCol : na); zone is never na here, so bgCol is always a zone colour
    if (cfg.showBG) bgColors.push({ time: t, color: bgZone[zone] });
  }

  return {
    metadata: {
      title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay,
      precision: metadata.precision, format: metadata.format,
    },
    plots: { plot0, plot1, plot2, plot3 },
    bgColors,
  };
}

export const RvolEffortMatrix = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
