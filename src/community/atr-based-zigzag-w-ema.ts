/**
 * ATR Based Zigzag w EMA
 *
 * An ATR zigzag gives the trend: in an uptrend the highest high is tracked and the trend turns down when the low
 * falls more than `atrMult` * ATR below it; in a downtrend the lowest low is tracked and the trend turns up when the
 * high rises more than `atrMult` * ATR above it. The line is the EMA of the median price (high + low) / 2, coloured
 * by the trend, and the bars are coloured the same way.
 *
 * Reference: "ATR Based Zigzag w EMA" by HabibiBudo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface AtrBasedZigzagWEmaInputs {
  atrLength: number;
  atrMult: number;
  /** Line smoothness (EMA length of the median price) */
  lineSmoothLength: number;
  upTrendColor: string;
  downTrendColor: string;
}

export const defaultInputs: AtrBasedZigzagWEmaInputs = {
  atrLength: 14,
  atrMult: 5.0,
  lineSmoothLength: 50,
  upTrendColor: 'rgb(0, 255, 132)',
  downTrendColor: 'rgb(255, 0, 0)',
};

export const inputConfig: InputConfig[] = [
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14 },
  { id: 'atrMult', type: 'float', title: 'ATR Multiplier', defval: 5.0 },
  { id: 'lineSmoothLength', type: 'int', title: 'Line Smoothness (EMA Length)', defval: 50 },
  { id: 'upTrendColor', type: 'color', title: 'Uptrend Line Color', defval: 'rgb(0, 255, 132)' },
  { id: 'downTrendColor', type: 'color', title: 'Downtrend Line Color', defval: 'rgb(255, 0, 0)' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trend Line', color: 'rgb(0, 255, 132)', lineWidth: 3 },
];

export const metadata = {
  title: 'ATR Based Zigzag w EMA',
  shortTitle: 'ATR Based Zigzag w EMA',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

export function calculate(
  bars: Bar[],
  inputs: Partial<AtrBasedZigzagWEmaInputs> = {},
): IndicatorResult & { barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  const atr = A(ta.atr(bars, cfg.atrLength));
  const smooth = A(ta.ema(Series.fromArray(bars, bars.map((b) => (b.high + b.low) / 2)), cfg.lineSmoothLength));

  const trendOf: number[] = new Array(n);
  let LL = NaN; // var float LL = na
  let HH = NaN; // var float HH = na
  let trend = 1; // var int trend = 1
  for (let i = 0; i < n; i++) {
    const { high, low } = bars[i];
    // LL := na(LL[1]) ? low : LL[1]; HH := na(HH[1]) ? high : HH[1]
    if (isNaN(LL)) LL = low;
    if (isNaN(HH)) HH = high;
    const band = atr[i] * cfg.atrMult;
    if (trend > 0) {
      if (ge(high, HH)) HH = high;
      else if (gt(HH - band, low)) {
        trend = -1;
        LL = low;
      }
    } else if (ge(LL, low)) {
      LL = low;
    } else if (gt(high, LL + band)) {
      trend = 1;
      HH = high;
    }
    trendOf[i] = trend;
  }

  const colorOf = (i: number) => (trendOf[i] === 1 ? cfg.upTrendColor : cfg.downTrendColor);
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      // plot(smoothLine, color = trend == 1 ? upTrendColor : downTrendColor, linewidth = 3, title = 'Trend Line')
      plot0: bars.map((b, i) => ({ time: b.time, value: smooth[i], color: colorOf(i) })),
    },
    // barcolor(trend == 1 ? upTrendColor : downTrendColor)
    barColors: bars.map((b, i) => ({ time: b.time as number, color: colorOf(i) })),
  };
}

export const AtrBasedZigzagWEma = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
