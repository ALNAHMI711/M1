/**
 * Change-Point Detection (CUSUM)
 *
 * CUSUM on the z-score of the log returns of the close (sma / stdev over `length` bars): sPos = max(0, sPos + z - k),
 * sNeg = min(0, sNeg + z + k). A change up is sPos > h, a change down sNeg < -h; on a change (and on bar `length`)
 * the regime price is set to the close, the trend to the change direction and both sums to 0. Plots: the regime
 * price coloured by the trend, and the regime price + sPos / sNeg times the stdev of the close, with fills to the
 * regime price; the lines break on a level change. Triangles mark the changes.
 *
 * Reference: "Change-Point Detection (CUSUM) [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface ChangePointDetectionInputs {
  /** Period of the rolling statistics of the log returns */
  length: number;
  /** Threshold (h) */
  threshold: number;
  /** Slack (k) */
  slack: number;
}

export const defaultInputs: ChangePointDetectionInputs = {
  length: 50,
  threshold: 4.0,
  slack: 0.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Lookback Period', defval: 50, min: 10, group: 'Algorithm Settings',
    tooltip: 'Period used to calculate the rolling statistics of log-returns.' },
  { id: 'threshold', type: 'float', title: 'Threshold (h)', defval: 4.0, min: 0.1, step: 0.1, group: 'Algorithm Settings',
    tooltip: 'Sensitivity of the detection. Higher values require more accumulation to trigger a change.' },
  { id: 'slack', type: 'float', title: 'Slack (k)', defval: 0.5, min: 0.0, step: 0.1, group: 'Algorithm Settings',
    tooltip: "The 'allowable' deviation. Smaller values make the algorithm more sensitive." },
];

const BULL_COLOR = '#089981';
const BEAR_COLOR = '#f23645';
const BULL_PRESSURE = String(color.new(BULL_COLOR, 80));
const BEAR_PRESSURE = String(color.new(BEAR_COLOR, 80));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Regime Price', color: BULL_COLOR, lineWidth: 2, style: 'linebr' },
  { id: 'plot1', title: 'Bullish Pressure', color: BULL_PRESSURE, lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'Bearish Pressure', color: BEAR_PRESSURE, lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'Change-Point Detection (CUSUM) [LuxAlgo]',
  shortTitle: 'LuxAlgo - Change-Point Detection',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
/** Pine a != b: false with na */
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;

type Point = { time: number; value: number; color: string };

export function calculate(
  bars: Bar[],
  inputs: Partial<ChangePointDetectionInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const len = cfg.length;
  const close = bars.map((b) => b.close);

  // logReturns = math.log(src / nz(src[1], src))
  const logReturns = close.map((c, i) => Math.log(c / (i > 0 && !isNaN(close[i - 1]) ? close[i - 1] : c)));
  const rollingMean = A(ta.sma(S(logReturns), len));
  const rollingStd = A(ta.stdev(S(logReturns), len));
  const priceVol = A(ta.stdev(S(close), len));

  const plot0: Point[] = [];
  const plot1: Point[] = [];
  const plot2: Point[] = [];
  const markers: MarkerData[] = [];
  let sPos = 0; // var float sPos = 0.0
  let sNeg = 0; // var float sNeg = 0.0
  let trend = 0; // var int trend = 0
  let regimePrice = NaN; // var float regimePrice = na
  let prevRegimePrice = NaN;
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    // zScore = (logReturns - rollingMean) / (rollingStd == 0 ? 1.0 : rollingStd)
    const sd = rollingStd[i];
    const div = !isNaN(sd) && Math.abs(sd) <= EPS ? 1.0 : sd;
    const z = (logReturns[i] - rollingMean[i]) / div;
    if (!isNaN(z)) {
      sPos = Math.max(0, sPos + z - cfg.slack);
      sNeg = Math.min(0, sNeg + z + cfg.slack);
    }
    const changeUp = gt(sPos, cfg.threshold);
    const changeDn = lt(sNeg, -cfg.threshold);
    // bar_index == lengthInput: bar_index counts from the first bar of the data
    if (changeUp || changeDn || i === len) {
      trend = changeUp ? 1 : changeDn ? -1 : trend;
      regimePrice = close[i];
      sPos = 0;
      sNeg = 0;
    }

    const trendColor = trend === 1 ? BULL_COLOR : trend === -1 ? BEAR_COLOR : color.gray;
    const isLevelChange = ne(regimePrice, prevRegimePrice);
    prevRegimePrice = regimePrice;
    plot0.push({ time: t, value: regimePrice, color: isLevelChange ? 'transparent' : trendColor });
    plot1.push({ time: t, value: regimePrice + sPos * priceVol[i], color: isLevelChange ? 'transparent' : BULL_PRESSURE });
    plot2.push({ time: t, value: regimePrice + sNeg * priceVol[i], color: isLevelChange ? 'transparent' : BEAR_PRESSURE });

    // plotshape(changeUp, 'Change Up', shape.triangleup, location.belowbar, BULL_COLOR, size = size.tiny)
    if (changeUp) markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: BULL_COLOR, size: 'tiny' });
    // plotshape(changeDn, 'Change Down', shape.triangledown, location.abovebar, BEAR_COLOR, size = size.tiny)
    if (changeDn) markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: BEAR_COLOR, size: 'tiny' });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2 },
    fills: [
      // fill(pRegime, pCusumPos, color.new(BULL_COLOR, 90), 'Bullish CUSUM Fill')
      { plot1: 'plot0', plot2: 'plot1', options: { title: 'Bullish CUSUM Fill' },
        colors: new Array<string>(n).fill(String(color.new(BULL_COLOR, 90))) },
      // fill(pRegime, pCusumNeg, color.new(BEAR_COLOR, 90), 'Bearish CUSUM Fill')
      { plot1: 'plot0', plot2: 'plot2', options: { title: 'Bearish CUSUM Fill' },
        colors: new Array<string>(n).fill(String(color.new(BEAR_COLOR, 90))) },
    ],
    markers,
  };
}

export const ChangePointDetection = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
