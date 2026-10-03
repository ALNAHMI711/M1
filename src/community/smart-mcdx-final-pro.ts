/**
 * Smart MCDX FINAL PRO
 *
 * Volume flow = (close - close[1]) * volume. Three EMAs of the flow (banker, hot, retail lengths) are each divided by
 * the EMA of their absolute value over the same length, smoothed by an EMA and scaled by 20: the Retail, Hot and
 * Banker columns. The Banker MA is an EMA of the Banker value. A band between 2 and -2 is filled green when the
 * Banker value is above 0 and its absolute value above the minimum strength, red when it is below 0 with that
 * strength. Dots on the Banker MA mark the crosses of the Banker value and its MA when the trend is strong. A slower
 * "HTF" Banker line uses the banker length and the smoothing multiplied by the HTF multiplier (same timeframe).
 *
 * Reference: "Smart MCDX FINAL PRO" by Sachse-1980
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { HLineConfig } from 'oakscriptjs';

export interface SmartMcdxFinalProInputs {
  bankerLen: number;
  hotLen: number;
  retailLen: number;
  /** EMA length of the smoothing */
  smooth: number;
  /** Show the dots of the Banker / Banker MA crosses */
  showDots: boolean;
  dotUpCol: string;
  dotDnCol: string;
  /** Minimum absolute Banker value of a trend */
  minStrength: number;
  showTrendBand: boolean;
  /** Show the slower Banker line and its MA */
  showHTF: boolean;
  /** Multiplier of the banker length and the smoothing of the slower Banker line */
  htfMult: number;
}

export const defaultInputs: SmartMcdxFinalProInputs = {
  bankerLen: 50,
  hotLen: 40,
  retailLen: 30,
  smooth: 6,
  showDots: true,
  dotUpCol: '#39FF14',
  dotDnCol: '#FF073A',
  minStrength: 5.0,
  showTrendBand: true,
  showHTF: true,
  htfMult: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'bankerLen', type: 'int', title: 'Banker Length', defval: 50 },
  { id: 'hotLen', type: 'int', title: 'Hot Length', defval: 40 },
  { id: 'retailLen', type: 'int', title: 'Retail Length', defval: 30 },
  { id: 'smooth', type: 'int', title: 'Smoothing', defval: 6 },
  { id: 'showDots', type: 'bool', title: 'Show MA Cross Dots', defval: true },
  { id: 'dotUpCol', type: 'color', title: 'Bull Dot (Neon Green)', defval: '#39FF14' },
  { id: 'dotDnCol', type: 'color', title: 'Bear Dot (Neon Red)', defval: '#FF073A' },
  { id: 'minStrength', type: 'float', title: 'Min Strength Filter', defval: 5.0 },
  { id: 'showTrendBand', type: 'bool', title: 'Show Trend Band', defval: true },
  { id: 'showHTF', type: 'bool', title: 'Show HTF Banker (x5)', defval: true },
  { id: 'htfMult', type: 'int', title: 'HTF Multiplier', defval: 5 },
];

const RETAIL_COL = String(color.new(color.green, 20));
const HOT_COL = String(color.new(color.yellow, 40));
const BANKER_COL = String(color.new(color.red, 0));
const BAND_BULL = String(color.new('#39FF14', 85));
const BAND_BEAR = String(color.new('#FF073A', 85));
const HTF_BULL = String(color.new('#39FF14', 80));
const HTF_BEAR = String(color.new('#FF073A', 80));
const HTF_MA_COL = String(color.new(color.white, 80));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Retail', color: RETAIL_COL, lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Hot', color: HOT_COL, lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'Banker', color: BANKER_COL, lineWidth: 1, style: 'columns' },
  { id: 'plot3', title: 'Banker MA', color: color.white, lineWidth: 2 },
  { id: 'plot4', title: 'Trend Band Upper', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Trend Band Lower', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot6', title: 'Bull Dot', color: '#39FF14', lineWidth: 3, style: 'circles' },
  { id: 'plot7', title: 'Bear Dot', color: '#FF073A', lineWidth: 3, style: 'circles' },
  { id: 'plot8', title: 'HTF Banker x5', color: HTF_BULL, lineWidth: 2 },
  { id: 'plot9', title: 'HTF Banker MA x5', color: HTF_MA_COL, lineWidth: 1 },
];

/** hline(40 / 20 / 10 / 0 / -10 / -20 / -40): Pine default style (dashed) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper_extreme_plus', price: 40, title: 'Upper Extreme+', color: String(color.new(color.red, 60)), linestyle: 'dashed', linewidth: 2 },
  { id: 'hline_upper_extreme', price: 20, title: 'Upper Extreme', color: String(color.new(color.red, 40)), linestyle: 'dashed', linewidth: 2 },
  { id: 'hline_upper_mid', price: 10, title: 'Upper Mid', color: String(color.new(color.orange, 40)), linestyle: 'dashed', linewidth: 1 },
  { id: 'hline_zero', price: 0, title: 'Zero', color: color.white, linestyle: 'dashed', linewidth: 2 },
  { id: 'hline_lower_mid', price: -10, title: 'Lower Mid', color: String(color.new(color.teal, 40)), linestyle: 'dashed', linewidth: 1 },
  { id: 'hline_lower_extreme', price: -20, title: 'Lower Extreme', color: String(color.new(color.green, 40)), linestyle: 'dashed', linewidth: 2 },
  { id: 'hline_lower_extreme_plus', price: -40, title: 'Lower Extreme+', color: String(color.new(color.green, 60)), linestyle: 'dashed', linewidth: 2 },
];

export const metadata = {
  title: 'Smart MCDX FINAL PRO',
  shortTitle: 'Smart MCDX FINAL PRO',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(bars: Bar[], inputs: Partial<SmartMcdxFinalProInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const scale = 20.0;

  // flow = (close - close[1]) * volume
  const flow = bars.map((b, i) => (i > 0 ? (b.close - bars[i - 1].close) * (b.volume ?? NaN) : NaN));
  const flowS = S(flow);

  // normalize(src, len) = src / ta.ema(math.abs(src), len): a plain division (x / 0 is +-infinity, 0 / 0 na;
  // ta.ema skips the infinite values as Pine)
  const normalize = (src: number[], len: number) => {
    const den = A(ta.ema(S(src.map((v) => Math.abs(v))), len));
    return src.map((v, i) => v / den[i]);
  };
  const line = (len: number) => {
    const raw = A(ta.ema(flowS, len));
    return A(ta.ema(S(normalize(raw, len)), cfg.smooth)).map((v) => v * scale);
  };
  const r = line(cfg.retailLen);
  const h = line(cfg.hotLen);
  const b = line(cfg.bankerLen);
  const bankerMA = A(ta.ema(S(b), cfg.smooth));

  // Trend: trendActive = math.abs(b) > minStrength
  const trendActive = b.map((v) => gt(Math.abs(v), cfg.minStrength));
  const bullTrend = b.map((v, i) => gt(v, 0) && trendActive[i]);
  const bearTrend = b.map((v, i) => lt(v, 0) && trendActive[i]);

  // ta.crossover(b, bankerMA) / ta.crossunder(b, bankerMA)
  const crossUp = ta.crossover(S(b), S(bankerMA)).toArray();
  const crossDown = ta.crossunder(S(b), S(bankerMA)).toArray();

  // HTF Banker: the same steps with bankerLen * htfMult and smooth * htfMult
  const htfLen = cfg.bankerLen * cfg.htfMult;
  const bHtfRaw = A(ta.ema(flowS, htfLen));
  const bHtfNorm = normalize(bHtfRaw, htfLen);
  const bHtf = A(ta.ema(S(bHtfNorm), cfg.smooth * cfg.htfMult)).map((v) => v * scale);
  const bHtfMa = A(ta.ema(S(bHtf), cfg.smooth));

  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const t = (i: number) => bars[i].time;
  const plot0 = [];
  const plot1 = [];
  const plot2 = [];
  const plot3 = [];
  const plot4 = [];
  const plot5 = [];
  const plot6 = [];
  const plot7 = [];
  const plot8 = [];
  const plot9 = [];
  const bandColors: string[] = new Array(n);
  for (let i = 0; i < n; i++) {
    plot0.push({ time: t(i), value: fin(r[i]), color: RETAIL_COL });
    plot1.push({ time: t(i), value: fin(h[i]), color: HOT_COL });
    plot2.push({ time: t(i), value: fin(b[i]), color: BANKER_COL });
    plot3.push({ time: t(i), value: fin(bankerMA[i]), color: color.white });
    // p1 = plot(showTrendBand ? 2 : na, display = display.none); p2 = plot(showTrendBand ? -2 : na, ...)
    plot4.push({ time: t(i), value: cfg.showTrendBand ? 2 : NaN });
    plot5.push({ time: t(i), value: cfg.showTrendBand ? -2 : NaN });
    // fill(p1, p2, color = bullTrend ? color.new(#39FF14, 85) : bearTrend ? color.new(#FF073A, 85) : na)
    bandColors[i] = bullTrend[i] ? BAND_BULL : bearTrend[i] ? BAND_BEAR : 'transparent';
    // bullDot = crossUp and trendActive ? bankerMA : na; plot(showDots ? bullDot : na, style = circles)
    const validBull = !!crossUp[i] && trendActive[i];
    const validBear = !!crossDown[i] && trendActive[i];
    plot6.push({ time: t(i), value: cfg.showDots && validBull ? fin(bankerMA[i]) : NaN, color: cfg.dotUpCol });
    plot7.push({ time: t(i), value: cfg.showDots && validBear ? fin(bankerMA[i]) : NaN, color: cfg.dotDnCol });
    // htfCol = b_htf > b_htf_ma ? htfBullCol : htfBearCol
    plot8.push({ time: t(i), value: cfg.showHTF ? fin(bHtf[i]) : NaN, color: gt(bHtf[i], bHtfMa[i]) ? HTF_BULL : HTF_BEAR });
    plot9.push({ time: t(i), value: cfg.showHTF ? fin(bHtfMa[i]) : NaN, color: HTF_MA_COL });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2, plot3, plot4, plot5, plot6, plot7, plot8, plot9 },
    hlines: hlineConfig.map((hl) => ({
      value: hl.price,
      options: { title: hl.title, color: hl.color, linestyle: hl.linestyle, linewidth: hl.linewidth },
    })),
    fills: [{ plot1: 'plot4', plot2: 'plot5', colors: bandColors }],
  };
}

export const SmartMcdxFinalPro = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
