/**
 * Swing Points
 *
 * Pivot highs / lows with `period` bars on each side give H / L labels on the pivot bar. Every new pivot moves a
 * center line: the first pivot value, then (center * 2 + pivot) / 3; the line is green when the close is above it,
 * red otherwise, and the bar is coloured on the bars where that colour flips. Circles draw the last pivot low
 * (support) and the last pivot high (resistance), shifted back to the pivot bars.
 *
 * Reference: "Swing Points" by CrossTradeTeam
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, MarkerData } from '../types';
import { barInterval, barTime } from '../bar-time';

export interface SwingPointsInputs {
  /** Pivot bars on each side */
  period: number;
  showPivot: boolean;
  showCenterLine: boolean;
  showSupportResistance: boolean;
}

export const defaultInputs: SwingPointsInputs = {
  period: 5,
  showPivot: true,
  showCenterLine: true,
  showSupportResistance: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'period', type: 'int', title: 'Swing Point Period', defval: 5, min: 1, max: 50 },
  { id: 'showPivot', type: 'bool', title: 'Show Swing Points', defval: true },
  { id: 'showCenterLine', type: 'bool', title: 'Show Center Line', defval: true },
  { id: 'showSupportResistance', type: 'bool', title: 'Show Support/Resistance', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Center Line', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Support Level', color: color.green, lineWidth: 2, style: 'circles' },
  { id: 'plot2', title: 'Resistance Level', color: color.red, lineWidth: 2, style: 'circles' },
];

export const metadata = {
  title: 'Swing Points',
  shortTitle: 'Swing Points',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<SwingPointsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const prd = cfg.period;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const interval = barInterval(bars);

  const pivotHigh = A(ta.pivothigh(S(bars.map((b) => b.high)), prd, prd));
  const pivotLow = A(ta.pivotlow(S(bars.map((b) => b.low)), prd, prd));

  const plot0: { time: number; value: number; color: string }[] = [];
  const plot1: { time: number; value: number }[] = [];
  const plot2: { time: number; value: number }[] = [];
  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];

  let centerLine = NaN; // var float centerLine = na
  let prevColor: string | null = null; // centerLineColor[1]
  let support = NaN;
  let resistance = NaN;
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    const ph = pivotHigh[i];
    const pl = pivotLow[i];

    // plotshape(..., offset = -prd): the label of bar i is drawn on the pivot bar i - prd
    if (cfg.showPivot && i - prd >= 0) {
      const pt = barTime(bars, i - prd, interval);
      if (!isNaN(ph)) {
        markers.push({ time: pt, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'H',
          textColor: color.white, size: 'auto' });
      }
      if (!isNaN(pl)) {
        markers.push({ time: pt, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'L',
          textColor: color.white, size: 'auto' });
      }
    }

    // Center line: moved by every new pivot (the pivot high first)
    const lastPivotPoint = !isNaN(ph) ? ph : !isNaN(pl) ? pl : NaN;
    if (!isNaN(lastPivotPoint)) {
      centerLine = isNaN(centerLine) ? lastPivotPoint : (centerLine * 2 + lastPivotPoint) / 3;
    }
    const centerLineColor = gt(bars[i].close, centerLine) ? color.green : color.red;
    plot0.push({ time: t, value: cfg.showCenterLine ? centerLine : NaN, color: centerLineColor });

    // barcolor(centerLineColorChanged ? centerLineColor : na)
    if (prevColor !== null && centerLineColor !== prevColor) barColors.push({ time: t, color: centerLineColor });
    prevColor = centerLineColor;

    // Support / resistance: the last pivot low / high, plotted with offset = -prd
    support = !isNaN(pl) ? pl : support;
    resistance = !isNaN(ph) ? ph : resistance;
    if (i - prd >= 0) {
      const pt = barTime(bars, i - prd, interval);
      plot1.push({ time: pt, value: cfg.showSupportResistance ? support : NaN });
      plot2.push({ time: pt, value: cfg.showSupportResistance ? resistance : NaN });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2 },
    markers,
    barColors,
  };
}

export const SwingPoints = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
