/**
 * Ultra Smart Trail
 *
 * Trend Flow Line (TFL) = (2 * HMA + DWMA) / 3 of the close. The HMA length is int(length * 100 / 24 * 20 / 100)
 * (20 for a length of 24): wma(2 * wma(close, hmaLen / 2) - wma(close, hmaLen), floor(sqrt(hmaLen))). The DWMA is
 * wma(wma(close, w2), w1) with w1 = round(length / 3) and w2 = round((length - w1) / 3).
 * Two zones around the TFL: TFL +- multiplier * stdev(close, length) (inner and outer multipliers). In an uptrend
 * (TFL above its value `smooth` bars ago) the lower zone is drawn while the previous close is above the outer lower
 * band; otherwise the upper zone is drawn while the previous close is below the outer upper band. Gradient fills fill
 * each zone. The TFL is bullish when the close is at or above it in an uptrend, bearish when the close is at or below
 * it and not in an uptrend, else neutral.
 *
 * Reference: "Ultra Smart Trail" by Rathack
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Rathack
 */

import { taCore, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface UltraSmartTrailInputs {
  /** Show the Trend Flow Line */
  showTfl: boolean;
  /** TFL and standard deviation length */
  length: number;
  /** Lookback of the trend condition (TFL vs TFL `smooth` bars ago) */
  smooth: number;
  /** Multiplier of the inner deviation zone */
  multiplier1: number;
  /** Multiplier of the outer deviation zone */
  multiplier2: number;
  bullColor: string;
  bearColor: string;
  baseColor: string;
}

export const defaultInputs: UltraSmartTrailInputs = {
  showTfl: true,
  length: 24,
  smooth: 9,
  multiplier1: 0.618,
  multiplier2: 1.0,
  bullColor: '#0084ff',
  bearColor: '#ff9100',
  baseColor: '#787b86',
};

export const inputConfig: InputConfig[] = [
  { id: 'showTfl', type: 'bool', title: 'Trend Flow Line', defval: true },
  { id: 'length', type: 'int', title: 'Length', defval: 24, min: 1 },
  { id: 'smooth', type: 'int', title: 'Smooth', defval: 9, min: 1 },
  { id: 'multiplier1', type: 'float', title: 'Multiplier (inner)', defval: 0.618, min: 0.01, step: 0.05 },
  { id: 'multiplier2', type: 'float', title: 'Multiplier', defval: 1.0, min: 0.01, step: 0.05 },
  { id: 'bullColor', type: 'color', title: 'Bullish', defval: '#0084ff' },
  { id: 'bearColor', type: 'color', title: 'Bearish', defval: '#ff9100' },
  { id: 'baseColor', type: 'color', title: 'Base', defval: '#787b86' },
];

// display = display.all - display.status_line on every plot (drawn in the pane)
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Level Upper 2', color: String(color.new('#ff9100', 50)), lineWidth: 1, style: 'linebr' },
  { id: 'plot1', title: 'Level Lower 2', color: String(color.new('#0084ff', 50)), lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'Level Upper', color: 'transparent', lineWidth: 1, style: 'linebr' },
  { id: 'plot3', title: 'Level Lower', color: 'transparent', lineWidth: 1, style: 'linebr' },
  { id: 'plot4', title: 'Trend Flow Line', color: '#787b86', lineWidth: 3 },
];

export const metadata = {
  title: 'Ultra Smart Trail',
  shortTitle: 'Ultra Smart Trail',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

export function calculate(bars: Bar[], inputs: Partial<UltraSmartTrailInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const L = cfg.length;
  const close = bars.map((b) => b.close);
  const na = (v: number | null | undefined) => (v === null || v === undefined ? NaN : v);

  // _calcTrendFlowLine(close, iLength)
  const hmaLen = Math.trunc(((((L * 100) / 24) * 20) / 100));
  const wHalf = taCore.wma(close, hmaLen / 2);
  const wFull = taCore.wma(close, hmaLen);
  const diff = close.map((_c, i) => 2 * na(wHalf[i]) - na(wFull[i]));
  const hma = taCore.wma(diff, Math.floor(Math.sqrt(hmaLen)));
  const w1 = Math.round(L / 3);
  const w2 = Math.round((L - w1) / 3);
  const dwma = taCore.wma(taCore.wma(close, w2), w1);
  // math.avg(fHma_, fDwma_, fHma_)
  const tfl = close.map((_c, i) => (na(hma[i]) + na(dwma[i]) + na(hma[i])) / 3);

  const sd = taCore.stdev(close, L);
  const upper1: number[] = new Array(n);
  const lower1: number[] = new Array(n);
  const upper2: number[] = new Array(n);
  const lower2: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const dev1 = cfg.multiplier1 * na(sd[i]);
    const dev2 = cfg.multiplier2 * na(sd[i]);
    upper1[i] = tfl[i] + dev1;
    lower1[i] = tfl[i] - dev1;
    upper2[i] = tfl[i] + dev2;
    lower2[i] = tfl[i] - dev2;
  }

  const bearHalf = String(color.new(cfg.bearColor, 50));
  const bullHalf = String(color.new(cfg.bullColor, 50));
  const bearClear = String(color.new(cfg.bearColor, 100));
  const bullClear = String(color.new(cfg.bullColor, 100));
  const bear80 = String(color.new(cfg.bearColor, 80));
  const bull80 = String(color.new(cfg.bullColor, 80));

  const plot0 = [];
  const plot1 = [];
  const plot2 = [];
  const plot3 = [];
  const plot4 = [];
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    const c = close[i];
    const past = i - cfg.smooth >= 0 ? tfl[i - cfg.smooth] : NaN;
    // bUptrend = fTfl > fTfl[iSmooth]
    const up = gt(tfl[i], past);
    const tflColor = ge(c, tfl[i]) && up ? cfg.bullColor : le(c, tfl[i]) && !up ? cfg.bearColor : cfg.baseColor;
    const prevClose = i > 0 ? close[i - 1] : NaN;
    const notTooLow = gt(prevClose, lower2[i]);
    const notTooHigh = lt(prevClose, upper2[i]);
    const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
    plot0.push({ time: t, value: !up && notTooHigh ? fin(upper2[i]) : NaN, color: bearHalf });
    plot1.push({ time: t, value: up && notTooLow ? fin(lower2[i]) : NaN, color: bullHalf });
    plot2.push({ time: t, value: !up && notTooHigh ? fin(upper1[i]) : NaN, color: bearClear });
    plot3.push({ time: t, value: up && notTooLow ? fin(lower1[i]) : NaN, color: bullClear });
    plot4.push({ time: t, value: cfg.showTfl ? fin(tfl[i]) : NaN, color: tflColor });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2, plot3, plot4 },
    fills: [
      // fill(plotLevelLower2, plotLevelLower1, fLowerBand1, fLowerBand2, color.new(cBull, 100), color.new(cBull, 80))
      { plot1: 'plot1', plot2: 'plot3', options: { title: 'Smart Trail Lower' }, gradient: {
        topValue: lower1.slice(), bottomValue: lower2.slice(),
        topColor: new Array(n).fill(bullClear), bottomColor: new Array(n).fill(bull80) } },
      // fill(plotLevelUpper1, plotLevelUpper2, fUpperBand1, fUpperBand2, color.new(cBear, 100), color.new(cBear, 80))
      { plot1: 'plot2', plot2: 'plot0', options: { title: 'Smart Trail Upper' }, gradient: {
        topValue: upper1.slice(), bottomValue: upper2.slice(),
        topColor: new Array(n).fill(bearClear), bottomColor: new Array(n).fill(bear80) } },
    ],
  };
}

export const UltraSmartTrail = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
