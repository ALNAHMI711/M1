/**
 * Ichimoku Score Indicator
 *
 * Ichimoku lines on the price pane (Tenkan Sen, Kijun Sen, Chikou Span drawn `displacement` bars back, Senkou Span A
 * drawn `displacement` bars forward, Senkou Span B drawn 26 bars forward, cloud fill yellow / red) and a score in
 * the indicator pane. The score adds or removes points for: the close against the cloud and the cloud shadow (the
 * highest / lowest cloud of the last `kumoShadowPeriod` bars), Tenkan against Kijun with their position against the
 * cloud and their slopes, the close against the close 26 bars ago (Chikou) with the cloud and the consolidation range
 * of `displacement` bars ago, Span A against Span B with the cloud slopes, and the close against Tenkan and Kijun.
 * An optional SMA smooths the score.
 *
 * Reference: "Ichimoku Score [tanayroy]" by tanayroy
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © tanayroy
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { barInterval, barTime } from '../bar-time';

export interface IchimokuScoreIndicatorInputs {
  tenkanSenPeriod: number;
  kijunSenPeriod: number;
  senkouBLen: number;
  displacement: number;
  chikouspanConsolidationBar: number;
  kumoShadowPeriod: number;
  priceKumoScore: number;
  priceKumoShadowScore: number;
  tenkanSenKijunSenScore: number;
  tenkanSenKumoScore: number;
  kijunSenKumoScore: number;
  tenkanSenSlopeScore: number;
  kijunSenSlopeScore: number;
  chikouSpanScore: number;
  chikouKumoScore: number;
  chikouConsolidationScore: number;
  senkouASenkouBScore: number;
  kumoSlopeScore: number;
  priceTenkanScore: number;
  priceKijunScore: number;
  showSmoothLine: boolean;
  smaPeriod: number;
}

export const defaultInputs: IchimokuScoreIndicatorInputs = {
  tenkanSenPeriod: 9,
  kijunSenPeriod: 26,
  senkouBLen: 52,
  displacement: 26,
  chikouspanConsolidationBar: 5,
  kumoShadowPeriod: 252,
  priceKumoScore: 2.0,
  priceKumoShadowScore: 0.5,
  tenkanSenKijunSenScore: 2.0,
  tenkanSenKumoScore: 0.5,
  kijunSenKumoScore: 0.5,
  tenkanSenSlopeScore: 0.5,
  kijunSenSlopeScore: 0.5,
  chikouSpanScore: 2.0,
  chikouKumoScore: 0.5,
  chikouConsolidationScore: 0.5,
  senkouASenkouBScore: 2.0,
  kumoSlopeScore: 0.5,
  priceTenkanScore: 2.0,
  priceKijunScore: 2.0,
  showSmoothLine: false,
  smaPeriod: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'tenkanSenPeriod', type: 'int', title: 'Tenkan Sen Length', defval: 9, min: 1 },
  { id: 'kijunSenPeriod', type: 'int', title: 'Kijun Sen Length', defval: 26, min: 1 },
  { id: 'senkouBLen', type: 'int', title: 'Senkou B Length', defval: 52, min: 1 },
  { id: 'displacement', type: 'int', title: 'Displacement', defval: 26, min: 1 },
  { id: 'chikouspanConsolidationBar', type: 'int', title: 'Chikou Consolidation Bar', defval: 5, min: 1 },
  { id: 'kumoShadowPeriod', type: 'int', title: 'Kumo Shadow Analyzing Period', defval: 252, min: 1 },
  { id: 'priceKumoScore', type: 'float', title: 'Close Vs. Kumo', defval: 2.0 },
  { id: 'priceKumoShadowScore', type: 'float', title: 'Close Vs. Kumo Shadow', defval: 0.5 },
  { id: 'tenkanSenKijunSenScore', type: 'float', title: 'Tenkan Vs. Kijun Score', defval: 2.0 },
  { id: 'tenkanSenKumoScore', type: 'float', title: 'Tenkan Sen Vs. Kumo', defval: 0.5 },
  { id: 'kijunSenKumoScore', type: 'float', title: 'Kijun Sen Vs. Kumo', defval: 0.5 },
  { id: 'tenkanSenSlopeScore', type: 'float', title: 'Tenkan Sen Slope Score', defval: 0.5 },
  { id: 'kijunSenSlopeScore', type: 'float', title: 'Kijun Sen Slope Score', defval: 0.5 },
  { id: 'chikouSpanScore', type: 'float', title: 'Chikou Span Score', defval: 2.0 },
  { id: 'chikouKumoScore', type: 'float', title: 'Chikou Vs. Kumo Score', defval: 0.5 },
  { id: 'chikouConsolidationScore', type: 'float', title: 'Chikou Consolidation Score', defval: 0.5 },
  { id: 'senkouASenkouBScore', type: 'float', title: 'SenkouA Vs. SenkouB', defval: 2.0 },
  { id: 'kumoSlopeScore', type: 'float', title: 'Kumo Slope Score', defval: 0.5 },
  { id: 'priceTenkanScore', type: 'float', title: 'Price Vs. Tenkan Sen Score', defval: 2.0 },
  { id: 'priceKijunScore', type: 'float', title: 'Price Vs. Kijun Sen Score', defval: 2.0 },
  { id: 'showSmoothLine', type: 'bool', title: 'Show Smooth Score Line', defval: false },
  { id: 'smaPeriod', type: 'int', title: 'Smooth Period', defval: 9 },
];

// The five Ichimoku plots: force_overlay = true, display = display.all - display.status_line (drawn on the price pane)
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Tenkan Sen', color: color.red, lineWidth: 1, forceOverlay: true },
  { id: 'plot1', title: 'Kijun Sen', color: color.green, lineWidth: 1, forceOverlay: true },
  { id: 'plot2', title: 'Chikou Span', color: color.purple, lineWidth: 1, forceOverlay: true },
  { id: 'plot3', title: 'Senkou Span A', color: color.blue, lineWidth: 1, forceOverlay: true },
  { id: 'plot4', title: 'Senkou Span B', color: color.maroon, lineWidth: 1, forceOverlay: true },
  { id: 'plot5', title: 'Ichimoku Score Line', color: color.green, lineWidth: 1 },
  { id: 'plot6', title: 'Smooth Score Line', color: color.red, lineWidth: 1 },
];

export const metadata = {
  title: 'Ichimoku Score [tanayroy]',
  shortTitle: 'IchimokuScore[TR]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (a == b within 1e-10); na compares false */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
/** `==`: false with na and with +-infinity */
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

export function calculate(bars: Bar[], inputs: Partial<IchimokuScoreIndicatorInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const d = cfg.displacement;
  const highS = S(bars.map((b) => b.high));
  const lowS = S(bars.map((b) => b.low));
  const close = bars.map((b) => b.close);
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  /** x[k]: na before the first bar */
  const at = (x: number[], i: number) => (i >= 0 ? x[i] : NaN);

  // donchian(len) = math.avg(ta.lowest(len), ta.highest(len))
  const donchian = (len: number) => {
    const lo = A(ta.lowest(lowS, len));
    const hi = A(ta.highest(highS, len));
    return lo.map((l, i) => (l + hi[i]) / 2);
  };
  const tenkan = donchian(cfg.tenkanSenPeriod);
  const kijun = donchian(cfg.kijunSenPeriod);
  const senkouA = tenkan.map((t, i) => (t + kijun[i]) / 2);
  const senkouB = donchian(cfg.senkouBLen);

  // Cloud shadow: highest / lowest of senkou_a[displacement] and senkou_b[displacement] over kumoShadowPeriod bars
  const senkouAd = senkouA.map((_v, i) => at(senkouA, i - d));
  const senkouBd = senkouB.map((_v, i) => at(senkouB, i - d));
  const highestA = A(ta.highest(S(senkouAd), cfg.kumoShadowPeriod));
  const lowestA = A(ta.lowest(S(senkouAd), cfg.kumoShadowPeriod));
  const highestB = A(ta.highest(S(senkouBd), cfg.kumoShadowPeriod));
  const lowestB = A(ta.lowest(S(senkouBd), cfg.kumoShadowPeriod));

  // for i = displacement - 1 to displacement - chikouspan_consolidation_bar: history offsets of the loops
  const kFrom = Math.min(d - 1, d - cfg.chikouspanConsolidationBar);
  const kTo = Math.max(d - 1, d - cfg.chikouspanConsolidationBar);
  if (kFrom < 0) throw new Error('Invalid history reference: negative offset (displacement - chikou consolidation bar < 0)');

  // ta.change(x) / x: plain divisions
  const slope = (x: number[]) => x.map((v, i) => (i > 0 ? v - x[i - 1] : NaN) / v);
  const senkouASlp = slope(senkouA);
  const senkouBSlp = slope(senkouB);
  const tenkanSlp = slope(tenkan);
  const kijunSlp = slope(kijun);

  const score: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const c = close[i];
    let s = 0.0;
    const aD = at(senkouA, i - d);
    const bD = at(senkouB, i - d);
    const kumoUp = ge(aD, bD) ? aD : bD;
    const kumoDown = ge(aD, bD) ? bD : aD;
    const highestCloud = ge(highestA[i], highestB[i]) ? highestA[i] : highestB[i];
    const lowestCloud = le(lowestA[i], lowestB[i]) ? lowestA[i] : lowestB[i];
    const a2d = at(senkouA, i - 2 * d);
    const b2d = at(senkouB, i - 2 * d);
    const kumoUpChikou = ge(a2d, b2d) ? a2d : b2d;
    let chikouHigh = 0.0;
    let chikouLow = at(low, i - (d - 1));
    for (let k = kFrom; k <= kTo; k++) {
      chikouHigh = Math.max(at(high, i - k), chikouHigh);
      chikouLow = Math.min(at(low, i - k), chikouLow);
    }

    // Close vs. kumo and kumo shadow
    if (gt(c, kumoUp)) {
      s += cfg.priceKumoScore;
      s = lt(c, highestCloud) ? s - cfg.priceKumoShadowScore : s + cfg.priceKumoShadowScore;
    } else if (lt(c, kumoDown)) {
      s -= cfg.priceKumoScore;
      s = gt(c, lowestCloud) ? s + cfg.priceKumoShadowScore : s - cfg.priceKumoShadowScore;
    }

    // Tenkan vs. Kijun
    const t = tenkan[i];
    const kj = kijun[i];
    if (gt(t, kj)) {
      s += cfg.tenkanSenKijunSenScore;
      s = gt(t, kumoUp) ? s + cfg.tenkanSenKumoScore : s - cfg.tenkanSenKumoScore;
      s = gt(kj, kumoUp) ? s + cfg.kijunSenKumoScore : s - cfg.kijunSenKumoScore;
      s = gt(kijunSlp[i], 0) ? s + cfg.kijunSenSlopeScore : s - cfg.kijunSenSlopeScore;
      s = gt(tenkanSlp[i], 0) ? s + cfg.tenkanSenSlopeScore : s - cfg.tenkanSenSlopeScore;
    } else if (lt(t, kj)) {
      s -= 2.0; // the Pine script removes a constant 2.0 here (not the input score)
      s = lt(t, kumoUp) ? s - cfg.tenkanSenKumoScore : s + cfg.tenkanSenKumoScore;
      s = lt(kj, kumoUp) ? s - cfg.kijunSenKumoScore : s + cfg.kijunSenKumoScore;
      s = lt(kijunSlp[i], 0) ? s - cfg.kijunSenSlopeScore : s + cfg.kijunSenSlopeScore;
      s = lt(tenkanSlp[i], 0) ? s - cfg.tenkanSenSlopeScore : s + cfg.tenkanSenSlopeScore;
    }

    // Chikou: close vs. close[26] (a constant 26 in the Pine script)
    if (gt(c, at(close, i - 26))) {
      s += cfg.chikouSpanScore;
      s = gt(c, kumoUpChikou) ? s + cfg.chikouKumoScore : s - cfg.chikouKumoScore;
      s = le(c, chikouHigh) ? s - cfg.chikouConsolidationScore : s + cfg.chikouConsolidationScore;
    } else {
      s -= cfg.chikouSpanScore;
      s = le(c, kumoUpChikou) ? s - cfg.chikouKumoScore : s + cfg.chikouKumoScore;
      s = ge(c, chikouLow) ? s + cfg.chikouConsolidationScore : s - cfg.chikouConsolidationScore;
    }

    // Span A vs. Span B and the cloud slopes
    const sa = senkouASlp[i];
    const sb = senkouBSlp[i];
    if (gt(senkouA[i], senkouB[i])) {
      s += cfg.senkouASenkouBScore;
      if (gt(sa, 0) && eq(sb, 0)) s += cfg.kumoSlopeScore;
      else if (lt(sa, 0) && eq(sb, 0)) s -= cfg.kumoSlopeScore;
      else if (gt(sa, 0) && gt(sb, 0)) s += cfg.kumoSlopeScore;
      else if (lt(sa, 0) && gt(sb, 0)) s -= cfg.kumoSlopeScore;
    } else if (lt(senkouA[i], senkouB[i])) {
      s -= cfg.senkouASenkouBScore;
      if (lt(sa, 0) && eq(sb, 0)) s -= cfg.kumoSlopeScore;
      else if (gt(sa, 0) && eq(sb, 0)) s += cfg.kumoSlopeScore;
      else if (lt(sa, 0) && lt(sb, 0)) s -= cfg.kumoSlopeScore;
      else if (gt(sa, 0) && lt(sb, 0)) s += cfg.kumoSlopeScore;
    }

    // Close vs. Tenkan and Kijun
    s = gt(c, t) ? s + cfg.priceTenkanScore : s - cfg.priceTenkanScore;
    s = gt(c, kj) ? s + cfg.priceKijunScore : s - cfg.priceKijunScore;
    score[i] = s;
  }
  const smooth = A(ta.sma(S(score), cfg.smaPeriod));

  const interval = barInterval(bars);
  /** plot(..., offset = k): the value of bar i is drawn on bar i + k (future bars with barTime; none before bar 0) */
  const shifted = (vals: number[], k: number, col: string) => {
    const out: { time: number; value: number; color: string }[] = [];
    for (let i = 0; i < n; i++) {
      if (i + k >= 0) out.push({ time: barTime(bars, i + k, interval), value: vals[i], color: col });
    }
    return out;
  };
  // fill(p1, p2, color = senkou_a > senkou_b ? color.new(color.yellow, 70) : color.new(color.red, 70));
  // the colour of bar i goes with the plot points of bar i
  const bullCloud = String(color.new(color.yellow, 70));
  const bearCloud = String(color.new(color.red, 70));
  const cloud = senkouA.map((a, i) => (gt(a, senkouB[i]) ? bullCloud : bearCloud));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: tenkan[i], color: color.red })),
      plot1: bars.map((b, i) => ({ time: b.time, value: kijun[i], color: color.green })),
      // plot(close, offset = -displacement)
      plot2: shifted(close, -d, color.purple),
      // plot(senkou_a, offset = displacement); plot(senkou_b, offset = 26)
      plot3: shifted(senkouA, d, color.blue),
      plot4: shifted(senkouB, 26, color.maroon),
      plot5: bars.map((b, i) => ({ time: b.time, value: score[i], color: color.green })),
      plot6: bars.map((b, i) => ({ time: b.time, value: cfg.showSmoothLine ? smooth[i] : NaN, color: color.red })),
    },
    // hline(0, title = "Score Line"): Pine default colour #787B86, dashed
    hlines: [{ value: 0, options: { title: 'Score Line', color: '#787B86', linestyle: 'dashed' } }],
    fills: [{ plot1: 'plot3', plot2: 'plot4', options: { title: 'Plots Background' }, colors: cloud }],
  };
}

export const IchimokuScoreIndicator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
