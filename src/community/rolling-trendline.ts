/**
 * Rolling Trendline
 *
 * A straight trendline that rolls forward with a fixed slope: slope = (linreg(src, len, 0) - linreg(src, len, len - 1))
 * / (len - 1) / slope divisor. Each bar the line moves by the slope; when the source is further than stdev(src, len)
 * * multiplier from the projected value, the line resets to the source with the current slope and ATR. Bands at
 * trendline +- reset ATR * multiplier, gradient fills from the bands to the line, and circles at the reset points.
 * The colours follow the sign of the active slope.
 *
 * Reference: "Rolling Trendline [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface RollingTrendlineInputs {
  /** Slope lookback: period of the linear regression slope */
  lengthInput: number;
  /** Deviation multiplier: distance (in stdev) before the trendline resets */
  multInput: number;
  /** Slope divisor: higher values give flatter lines */
  slopeDivInput: number;
  /** Source */
  sourceInput: SourceType;
  /** ATR length of the zones */
  atrLengthInput: number;
  /** ATR multiplier of the zone width */
  atrMultInput: number;
  bullColorInput: string;
  bearColorInput: string;
  /** Zone colour (not used by the Pine script) */
  zoneColorInput: string;
  /** Line width of the trendline */
  widthInput: number;
}

export const defaultInputs: RollingTrendlineInputs = {
  lengthInput: 100,
  multInput: 2.0,
  slopeDivInput: 1.5,
  sourceInput: 'close',
  atrLengthInput: 200,
  atrMultInput: 3.0,
  bullColorInput: '#089981',
  bearColorInput: '#f23645',
  zoneColorInput: String(color.new('#787b86', 80)),
  widthInput: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'lengthInput', type: 'int', title: 'Slope Lookback', defval: 100, min: 2 },
  { id: 'multInput', type: 'float', title: 'Deviation Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'slopeDivInput', type: 'float', title: 'Slope Divisor', defval: 1.5, min: 0.1, step: 0.1 },
  { id: 'sourceInput', type: 'source', title: 'Source', defval: 'close' },
  { id: 'atrLengthInput', type: 'int', title: 'ATR Length', defval: 200, min: 1 },
  { id: 'atrMultInput', type: 'float', title: 'ATR Multiplier', defval: 3.0, min: 0.0, step: 0.1 },
  { id: 'bullColorInput', type: 'color', title: 'Bullish Trend', defval: '#089981' },
  { id: 'bearColorInput', type: 'color', title: 'Bearish Trend', defval: '#f23645' },
  { id: 'zoneColorInput', type: 'color', title: 'Zone Color', defval: String(color.new('#787b86', 80)) },
  { id: 'widthInput', type: 'int', title: 'Line Width', defval: 2, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Rolling Trendline', color: '#089981', lineWidth: 2 },
  { id: 'plot1', title: 'Upper Band', color: String(color.new('#089981', 80)), lineWidth: 1 },
  { id: 'plot2', title: 'Lower Band', color: String(color.new('#089981', 80)), lineWidth: 1 },
  { id: 'plot3', title: 'Reset Point', color: '#089981', lineWidth: 3, style: 'circles' },
];

export const metadata = {
  title: 'Rolling Trendline [LuxAlgo]',
  shortTitle: 'LuxAlgo - Rolling Trendline',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

export function calculate(bars: Bar[], inputs: Partial<RollingTrendlineInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const len = cfg.lengthInput;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const srcSeries = getSourceSeries(bars, cfg.sourceInput);
  const src = A(srcSeries);

  const lrCurrent = A(ta.linreg(srcSeries, len, 0));
  const lrPast = A(ta.linreg(srcSeries, len, len - 1));
  const dev = A(ta.stdev(srcSeries, len));
  const atrVal = A(ta.atr(bars, cfg.atrLengthInput));

  const trend: number[] = new Array(n);
  const upper: number[] = new Array(n);
  const lower: number[] = new Array(n);
  const reset: number[] = new Array(n);
  const trendCol: string[] = new Array(n);
  const lineCol: string[] = new Array(n);
  const bandCol: string[] = new Array(n);
  const zoneTop: string[] = new Array(n);
  const zoneBottom: string[] = new Array(n);

  let trendValue = NaN; // var float trendValue = na
  let activeSlope = NaN; // var float activeSlope = na
  let resetAtr = NaN; // var float resetAtr = na
  for (let i = 0; i < n; i++) {
    const lrSlope = (lrCurrent[i] - lrPast[i]) / (len - 1) / cfg.slopeDivInput;
    const threshold = dev[i] * cfg.multInput;
    // projectedValue = trendValue[1] + activeSlope (trendValue still holds the previous bar value here)
    const projectedValue = trendValue + activeSlope;
    const isDeviating = gt(Math.abs(src[i] - projectedValue), threshold);
    // bar_index == lengthInput (bar_index counts from the first bar of the history)
    const isFirstBar = i === len;
    if (isFirstBar || isDeviating) {
      trendValue = src[i];
      activeSlope = lrSlope;
      resetAtr = atrVal[i];
    } else {
      trendValue = projectedValue;
    }
    trend[i] = trendValue;
    upper[i] = trendValue + resetAtr * cfg.atrMultInput;
    lower[i] = trendValue - resetAtr * cfg.atrMultInput;
    reset[i] = isDeviating ? src[i] : NaN;

    const c = ge(activeSlope, 0) ? cfg.bullColorInput : cfg.bearColorInput;
    trendCol[i] = c;
    // color = isDeviating ? na : ...: no line segment into the reset bar
    lineCol[i] = isDeviating ? 'transparent' : c;
    bandCol[i] = isDeviating ? 'transparent' : String(color.new(c, 80));
    zoneTop[i] = String(color.new(c, 80));
    zoneBottom[i] = String(color.new(c, 100));
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: trend[i], color: lineCol[i] })),
      plot1: bars.map((b, i) => ({ time: b.time, value: upper[i], color: bandCol[i] })),
      plot2: bars.map((b, i) => ({ time: b.time, value: lower[i], color: bandCol[i] })),
      plot3: bars.map((b, i) => ({ time: b.time, value: reset[i], color: trendCol[i] })),
    },
    fills: [
      // fill(plotUpper, plotTrend, upperBand, trendValue, color.new(zone, 80), color.new(zone, 100), 'Upper Zone Fill')
      { plot1: 'plot1', plot2: 'plot0', options: { title: 'Upper Zone Fill' },
        gradient: { topValue: upper, bottomValue: trend, topColor: zoneTop, bottomColor: zoneBottom } },
      // fill(plotLower, plotTrend, lowerBand, trendValue, color.new(zone, 80), color.new(zone, 100), 'Lower Zone Fill')
      { plot1: 'plot2', plot2: 'plot0', options: { title: 'Lower Zone Fill' },
        gradient: { topValue: lower, bottomValue: trend, topColor: zoneTop, bottomColor: zoneBottom } },
    ],
  };
}

export const RollingTrendline = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
