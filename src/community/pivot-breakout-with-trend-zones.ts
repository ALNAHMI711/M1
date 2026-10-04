/**
 * Pivot Breakout with Trend Zones
 *
 * The last pivot high (left / right bars) and the last pivot low are drawn as crosses, shifted by the line offset.
 * The first close above the last pivot high (once per pivot) is a breakout up: a white candle, and the trend turns
 * up. The first close below the last pivot low is a breakout down: a black candle, and the trend turns down. The
 * other candles are teal in an uptrend and red in a downtrend (red before the first breakout). Candles have no wick
 * and no border colour.
 *
 * Reference: "Pivot Breakout with Trend Zones" by dreamaker7
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: ©author dreamaker7
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';
import { barInterval, barTime } from '../bar-time';

export interface PivotBreakoutWithTrendZonesInputs {
  /** Left bars of the pivot high */
  leftLenH: number;
  /** Right bars of the pivot high */
  rightLenH: number;
  /** Left bars of the pivot low */
  leftLenL: number;
  /** Right bars of the pivot low */
  rightLenL: number;
  /** Colour the candles (breakouts and trend zones) */
  showColorFill: boolean;
  /** Offset of the pivot lines (bars, <= 0) */
  lineOffset: number;
}

export const defaultInputs: PivotBreakoutWithTrendZonesInputs = {
  leftLenH: 9,
  rightLenH: 9,
  leftLenL: 9,
  rightLenL: 9,
  showColorFill: true,
  lineOffset: -9,
};

export const inputConfig: InputConfig[] = [
  { id: 'leftLenH', type: 'int', title: 'Left Bars (High)', defval: 9 },
  { id: 'rightLenH', type: 'int', title: 'Right Bars (High)', defval: 9 },
  { id: 'leftLenL', type: 'int', title: 'Left Bars (Low)', defval: 9 },
  { id: 'rightLenL', type: 'int', title: 'Right Bars (Low)', defval: 9 },
  { id: 'showColorFill', type: 'bool', title: 'Enable Candle Color Fill', defval: true,
    tooltip: 'Enable pivot breakout candles and trend zone coloring' },
  { id: 'lineOffset', type: 'int', title: 'Line Offset', defval: -9, min: -50, max: 0 },
];

const HIGH_COL = 'rgba(206, 130, 130, 0.5)'; // color.rgb(206, 130, 130, 50)
const LOW_COL = '#557b9bcc';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Pivot High', color: HIGH_COL, lineWidth: 1, style: 'cross' },
  { id: 'plot1', title: 'Pivot Low', color: LOW_COL, lineWidth: 1, style: 'cross' },
];

export const metadata = {
  title: 'Pivot Breakout with Trend Zones',
  shortTitle: 'Pivot Breakout with Trend Zones',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color?: string };

export function calculate(
  bars: Bar[],
  inputs: Partial<PivotBreakoutWithTrendZonesInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const ph = A(ta.pivothigh(Series.fromArray(bars, bars.map((b) => b.high)), cfg.leftLenH, cfg.rightLenH));
  const pl = A(ta.pivotlow(Series.fromArray(bars, bars.map((b) => b.low)), cfg.leftLenL, cfg.rightLenL));

  const defaultUpColor = '#26A69A';
  const defaultDownColor = '#EF5350';
  const breakoutHigh = color.white;
  const breakoutLow = color.black;

  const trailHighArr: number[] = new Array(n);
  const trailLowArr: number[] = new Array(n);
  const candles: PlotCandleData[] = [];
  let trailHigh = NaN; // var float trailHigh = na
  let trailLow = NaN;
  let breachedHigh = false;
  let breachedLow = false;
  let inUptrend = false;
  let candleColor = 'transparent'; // var color candleColor = na
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    if (!isNaN(ph[i])) trailHigh = ph[i];
    if (!isNaN(pl[i])) trailLow = pl[i];
    trailHighArr[i] = trailHigh;
    trailLowArr[i] = trailLow;

    // Reset the breakout status on a new pivot
    if (!isNaN(trailHigh) && eq(ph[i], trailHigh)) breachedHigh = false;
    if (!isNaN(trailLow) && eq(pl[i], trailLow)) breachedLow = false;

    const breakHigh = !isNaN(trailHigh) && gt(b.close, trailHigh) && !breachedHigh;
    const breakLow = !isNaN(trailLow) && lt(b.close, trailLow) && !breachedLow;
    if (breakHigh) {
      breachedHigh = true;
      inUptrend = true;
    }
    if (breakLow) {
      breachedLow = true;
      inUptrend = false;
    }

    if (cfg.showColorFill) {
      if (breakHigh) candleColor = breakoutHigh;
      else if (breakLow) candleColor = breakoutLow;
      else candleColor = inUptrend ? defaultUpColor : defaultDownColor;
    } else {
      candleColor = 'transparent';
    }
    // plotcandle(open, high, low, close, color = candleColor, wickcolor = na, bordercolor = na)
    candles.push({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, color: candleColor,
      wickColor: 'transparent', borderColor: 'transparent' });
  }

  // plot(..., offset = lineOffset): the value of bar i is drawn on bar i + lineOffset
  const interval = barInterval(bars);
  const off = cfg.lineOffset;
  const shifted = (vals: number[], c: string): Point[] => {
    const out: Point[] = [];
    for (let i = 0; i < n; i++) {
      const j = i + off;
      if (j < 0) continue;
      out.push({ time: barTime(bars, j, interval), value: vals[i], color: c });
    }
    return out;
  };

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: shifted(trailHighArr, HIGH_COL),
      plot1: shifted(trailLowArr, LOW_COL),
    },
    markers: [],
    plotCandles: { plotcandle0: candles },
  };
}

export const PivotBreakoutWithTrendZones = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
