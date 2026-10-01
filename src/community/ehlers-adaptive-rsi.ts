/**
 * Ehlers Adaptive RSI (Auto)
 *
 * An RSI whose length adapts to the volatility. The relative ATR (ATR(1) / SMA(close, 20)) gives an instant period
 * 0.33 * 360 / (relative ATR * 100 + 0.00001), smoothed by EMA(50) and EMA(10); the RSI length is half of it,
 * rounded and clamped to 3..30. Average gain and loss are Wilder averages with this variable length. Fixed levels
 * 65 / 35 with a zone fill; gradient fills between the RSI and 50 above 65 (green) and below 35 (red).
 *
 * Reference: "Ehlers Adaptive RSI" by Julien_Exe
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: @ Julien_Eche
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface EhlersAdaptiveRsiInputs {
  /** Source of the RSI */
  src: SourceType;
}

export const defaultInputs: EhlersAdaptiveRsiInputs = {
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Adaptive RSI', color: '#9E9E9E', lineWidth: 1 },
  // plot(50, color = na, editable = false, display = display.none): base of the extreme zone fills
  { id: 'plot1', title: 'Midline Plot', color: 'transparent', lineWidth: 1, display: 'none' },
];

const OB_LEVEL = 65;
const OS_LEVEL = 35;
const MID_COLOR = String(color.new('#787B86', 50));
const ZONE_FILL = color.rgb(158, 158, 158, 90);

/** hline(50 / 65 / 35) (default linestyle: dashed) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_mid', price: 50, title: 'Midline', color: MID_COLOR, linestyle: 'dashed' },
  { id: 'hline_upper', price: OB_LEVEL, title: 'Overbought', color: '#787B86', linestyle: 'dashed' },
  { id: 'hline_lower', price: OS_LEVEL, title: 'Oversold', color: '#787B86', linestyle: 'dashed' },
];

/** fill(upper, lower, color = color.rgb(158, 158, 158, 90)) */
export const fillConfig: FillConfig[] = [
  { id: 'fill_zone', plot1: 'hline_upper', plot2: 'hline_lower', color: ZONE_FILL, title: 'Zone Fill' },
];

export const metadata = {
  title: 'Ehlers Adaptive RSI (Auto)',
  shortTitle: 'Ehlers Adaptive RSI',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

export function calculate(bars: Bar[], inputs: Partial<EhlersAdaptiveRsiInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const src = A(getSourceSeries(bars, cfg.src));

  // dynamicPeriod()
  const atrValue = A(ta.atr(bars, 1));
  const priceScale = A(ta.sma(S(bars.map((b) => b.close)), 20));
  const instArg = bars.map((_b, i) => {
    const relativeAtr = gt(priceScale[i], 0) ? atrValue[i] / priceScale[i] : 0;
    return 0.33 * (360 / (Math.abs(relativeAtr) * 100 + 0.00001));
  });
  const instPeriod = A(ta.ema(S(instArg), 50));
  const periodVal = A(ta.ema(S(instPeriod), 10));
  // math.max(3, math.min(30, math.round(period_val / 2))): na while period_val is na
  const length = periodVal.map((v) => Math.max(3, Math.min(30, Math.round(v / 2))));

  // Wilder averages with the variable length; var float avgGain / avgLoss = na
  const rsi: number[] = new Array(n);
  let avgGain = NaN;
  let avgLoss = NaN;
  for (let i = 0; i < n; i++) {
    const prev = i > 0 ? src[i - 1] : NaN;
    const gain = Math.max(0, src[i] - prev); // math.max(0, na) = na
    const loss = Math.max(0, prev - src[i]);
    const len = length[i];
    avgGain = isNaN(avgGain) ? gain : (avgGain * (len - 1) + gain) / len;
    avgLoss = isNaN(avgLoss) ? loss : (avgLoss * (len - 1) + loss) / len;
    // rs = avgLoss == 0 ? 100 : avgGain / avgLoss; adaptive_rsi = avgLoss == 0 ? 100 : 100 - 100 / (1 + rs)
    const rs = eq(avgLoss, 0) ? 100.0 : avgGain / avgLoss;
    const v = eq(avgLoss, 0) ? 100.0 : 100 - 100 / (1 + rs);
    rsi[i] = Number.isFinite(v) ? v : NaN;
  }

  const green0 = String(color.new(color.green, 0));
  const green100 = String(color.new(color.green, 100));
  const red0 = String(color.new(color.red, 0));
  const red100 = String(color.new(color.red, 100));
  const fillArr = <T>(v: T) => new Array<T>(n).fill(v);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: rsi[i] })),
      plot1: bars.map((b) => ({ time: b.time, value: 50 })),
    },
    hlines: [
      { value: 50, options: { title: 'Midline', color: MID_COLOR, linestyle: 'dashed' } },
      { value: OB_LEVEL, options: { title: 'Overbought', color: '#787B86', linestyle: 'dashed' } },
      { value: OS_LEVEL, options: { title: 'Oversold', color: '#787B86', linestyle: 'dashed' } },
    ],
    fills: [
      { plot1: 'hline_upper', plot2: 'hline_lower', options: { title: 'Zone Fill' }, colors: fillArr(ZONE_FILL) },
      // fill(rsiPlot, midLinePlot, 100, obLevel, top_color = color.new(color.green, 0),
      //      bottom_color = color.new(color.green, 100))
      { plot1: 'plot0', plot2: 'plot1', options: { title: 'Overbought Fill' },
        gradient: { topValue: fillArr(100), bottomValue: fillArr(OB_LEVEL), topColor: fillArr<string | null>(green0),
          bottomColor: fillArr<string | null>(green100) } },
      // fill(rsiPlot, midLinePlot, osLevel, 0, top_color = color.new(color.red, 100), bottom_color = color.new(color.red, 0))
      { plot1: 'plot0', plot2: 'plot1', options: { title: 'Oversold Fill' },
        gradient: { topValue: fillArr(OS_LEVEL), bottomValue: fillArr(0), topColor: fillArr<string | null>(red100),
          bottomColor: fillArr<string | null>(red0) } },
    ],
  };
}

export const EhlersAdaptiveRsi = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
