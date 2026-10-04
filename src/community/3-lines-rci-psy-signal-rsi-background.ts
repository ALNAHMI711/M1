/**
 * 3 Lines RCI + Psy Signal + RSI Background
 *
 * Three RCI lines (rank correlation of the close with time; short, mid and long length). The script ranks the
 * values itself: rank = 1 + the number of window values above the value (tied values share the best rank), and
 * RCI = 100 * (1 - 6 * sum(d^2) / (n * (n^2 - 1))) with d = bar age - (rank - 1), clamped to -100..100; na while
 * bar_index < length. A psychological line counts the up closes of the last bars (psy = 100 * count / length): above
 * the overbought level it gives a red column (psy - ob) / (100 - ob) * 100, below the oversold level a green column
 * (psy - os) / os * 100. The background is red when RSI is above its overbought line and green when it is below its
 * oversold line. An ADX (Wilder smoothing of +DM, -DM and the true range) is drawn blue below the weak threshold,
 * yellow below the mid threshold and red above. Filled zones from the RCI overheat level to +-100.
 *
 * Reference: "3 Lines RCI + Psy Signal + RSI Background" by masato19810122
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';

export interface ThreeLinesRciPsySignalInputs {
  rciShortLen: number;
  rciMidLen: number;
  rciLongLen: number;
  /** Psychological line length */
  psyLen: number;
  psyOverbought: number;
  psyOversold: number;
  /** RCI overheat line (+ and -) */
  rciOverHeat: number;
  adxLen: number;
  /** ADX weak trend threshold */
  adxWeak: number;
  /** ADX mid trend threshold */
  adxMid: number;
  rsiLen: number;
  rsiOB: number;
  rsiOS: number;
}

export const defaultInputs: ThreeLinesRciPsySignalInputs = {
  rciShortLen: 9,
  rciMidLen: 26,
  rciLongLen: 52,
  psyLen: 12,
  psyOverbought: 70,
  psyOversold: 30,
  rciOverHeat: 80,
  adxLen: 14,
  adxWeak: 20,
  adxMid: 30,
  rsiLen: 14,
  rsiOB: 68,
  rsiOS: 32,
};

export const inputConfig: InputConfig[] = [
  { id: 'rciShortLen', type: 'int', title: 'RCI 短期', defval: 9 },
  { id: 'rciMidLen', type: 'int', title: 'RCI 中期', defval: 26 },
  { id: 'rciLongLen', type: 'int', title: 'RCI 長期', defval: 52 },
  { id: 'psyLen', type: 'int', title: 'サイコロジカル期間', defval: 12 },
  { id: 'psyOverbought', type: 'int', title: 'サイコロジカル買われすぎ', defval: 70 },
  { id: 'psyOversold', type: 'int', title: 'サイコロジカル売られすぎ', defval: 30 },
  { id: 'rciOverHeat', type: 'int', title: 'RCI 過熱ライン', defval: 80 },
  { id: 'adxLen', type: 'int', title: 'ADX期間', defval: 14 },
  { id: 'adxWeak', type: 'int', title: 'ADX弱いトレンド閾値', defval: 20 },
  { id: 'adxMid', type: 'int', title: 'ADX中間トレンド閾値', defval: 30 },
  { id: 'rsiLen', type: 'int', title: 'RSI 長さ', defval: 14 },
  { id: 'rsiOB', type: 'int', title: 'RSI 買われすぎライン', defval: 68 },
  { id: 'rsiOS', type: 'int', title: 'RSI 売られすぎライン', defval: 32 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RCI 短期', color: color.red, lineWidth: 1 },
  { id: 'plot1', title: 'RCI 中期', color: color.blue, lineWidth: 1 },
  { id: 'plot2', title: 'RCI 長期', color: color.green, lineWidth: 1 },
  { id: 'plot3', title: 'サイコロジカルシグナル', color: color.gray, lineWidth: 3, style: 'columns' },
  { id: 'plot4', title: 'ADX', color: color.blue, lineWidth: 2 },
];

const RED = String(color.new(color.red, 0));
const GREEN = String(color.new(color.green, 0));
const GRAY = String(color.new(color.gray, 0));

/** The 8 hlines with the default inputs (the result `hlines` follow the inputs) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_top1', price: 80, title: '', color: RED, linestyle: 'dashed' },
  { id: 'hline_top2', price: 100, title: '', color: RED, linestyle: 'dashed' },
  { id: 'hline_bottom1', price: -80, title: '', color: GREEN, linestyle: 'dashed' },
  { id: 'hline_bottom2', price: -100, title: '', color: GREEN, linestyle: 'dashed' },
  { id: 'hline_plus80', price: 80, title: 'RCI +80ライン', color: color.red, linestyle: 'dotted' },
  { id: 'hline_minus80', price: -80, title: 'RCI -80ライン', color: color.green, linestyle: 'dotted' },
  { id: 'hline_zero', price: 0, title: 'ゼロライン', color: color.gray, linestyle: 'dashed' },
  { id: 'hline_adx_mid', price: 30, title: '中間閾値', color: color.gray, linestyle: 'dotted' },
];

const TOP_FILL = String(color.new(color.red, 80));
const BOTTOM_FILL = String(color.new(color.green, 80));

export const fillConfig: FillConfig[] = [
  { id: 'fill_top', plot1: 'hline_top1', plot2: 'hline_top2', color: TOP_FILL },
  { id: 'fill_bottom', plot1: 'hline_bottom1', plot2: 'hline_bottom2', color: BOTTOM_FILL },
];

export const metadata = {
  title: '3 Lines RCI + Psy Signal + RSI Background',
  shortTitle: '3 Lines RCI + Psy Signal + RSI Background',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;

export function calculate(
  bars: Bar[],
  inputs: Partial<ThreeLinesRciPsySignalInputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const close = bars.map((b) => b.close);

  const rsi = A(ta.rsi(S(close), cfg.rsiLen));

  // rci(src, length): the script's own ranking (no averaging of tied ranks); na while bar_index < length
  const rci = (src: number[], length: number): number[] => {
    const out: number[] = new Array(n).fill(NaN);
    const arr: number[] = new Array(length);
    for (let bi = length; bi < n; bi++) {
      for (let i = 0; i < length; i++) arr[i] = src[bi - i];
      let sumD = 0;
      for (let i = 0; i < length; i++) {
        let rank = 1.0;
        for (let j = 0; j < length; j++) if (gt(arr[j], arr[i])) rank += 1;
        const d = i - (rank - 1);
        sumD += d * d;
      }
      const rciVal = 100 * (1 - (6 * sumD) / (length * (length * length - 1)));
      out[bi] = Math.max(-100, Math.min(100, rciVal));
    }
    return out;
  };
  const rciShort = rci(close, cfg.rciShortLen);
  const rciMid = rci(close, cfg.rciMidLen);
  const rciLong = rci(close, cfg.rciLongLen);

  // Psychological line and its columns
  const psySignal: number[] = new Array(n);
  const psyColor: string[] = new Array(n);
  for (let bi = 0; bi < n; bi++) {
    let psyCount = 0;
    for (let i = 0; i <= cfg.psyLen - 1; i++) {
      // close[i] > close[i + 1] (na before the first bar compares false)
      if (bi - i - 1 >= 0 && gt(close[bi - i], close[bi - i - 1])) psyCount += 1;
    }
    const psy = (100.0 * psyCount) / cfg.psyLen;
    let sig = NaN;
    let col = GRAY;
    if (gt(psy, cfg.psyOverbought)) {
      sig = ((psy - cfg.psyOverbought) / (100 - cfg.psyOverbought)) * 100;
      col = RED;
    } else if (gt(cfg.psyOversold, psy)) {
      sig = ((psy - cfg.psyOversold) / cfg.psyOversold) * 100;
      col = GREEN;
    }
    psySignal[bi] = Number.isFinite(sig) ? sig : NaN;
    psyColor[bi] = col;
  }

  // ADX from +DI / -DI
  const plusDM: number[] = new Array(n);
  const minusDM: number[] = new Array(n);
  const tr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const prev = i > 0 ? bars[i - 1] : undefined;
    const upMove = b.high - (prev ? prev.high : NaN);
    const downMove = (prev ? prev.low : NaN) - b.low;
    plusDM[i] = gt(upMove, downMove) && gt(upMove, 0) ? upMove : 0;
    minusDM[i] = gt(downMove, upMove) && gt(downMove, 0) ? downMove : 0;
    const prevClose = prev ? prev.close : NaN;
    // math.max with an na argument is na
    tr[i] = Math.max(b.high - b.low, Math.max(Math.abs(b.high - prevClose), Math.abs(b.low - prevClose)));
  }
  const smTR = A(ta.rma(S(tr), cfg.adxLen));
  const smPlusDM = A(ta.rma(S(plusDM), cfg.adxLen));
  const smMinusDM = A(ta.rma(S(minusDM), cfg.adxLen));
  const dx = bars.map((_b, i) => {
    const plusDI = (100 * smPlusDM[i]) / smTR[i];
    const minusDI = (100 * smMinusDM[i]) / smTR[i];
    return (100 * Math.abs(plusDI - minusDI)) / (plusDI + minusDI);
  });
  const adxVal = A(ta.rma(S(dx), cfg.adxLen));

  const bgColors: BgColorData[] = [];
  const obBg = String(color.new(color.red, 87));
  const osBg = String(color.new(color.green, 87));
  for (let i = 0; i < n; i++) {
    // bgcolor(rsi > rsiOB ? ... : na), then bgcolor(rsi < rsiOS ? ... : na)
    if (gt(rsi[i], cfg.rsiOB)) bgColors.push({ time: bars[i].time as number, color: obBg });
    if (gt(cfg.rsiOS, rsi[i])) bgColors.push({ time: bars[i].time as number, color: osBg });
  }

  const t = (i: number) => bars[i].time as number;
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const ohl = cfg.rciOverHeat;
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((_b, i) => ({ time: t(i), value: rciShort[i], color: RED })),
      plot1: bars.map((_b, i) => ({ time: t(i), value: rciMid[i], color: String(color.new(color.blue, 0)) })),
      plot2: bars.map((_b, i) => ({ time: t(i), value: rciLong[i], color: GREEN })),
      plot3: bars.map((_b, i) => ({ time: t(i), value: psySignal[i], color: psyColor[i] })),
      // adxColor = adxVal < adxWeak ? blue : adxVal < adxMid ? yellow : red
      plot4: bars.map((_b, i) => ({
        time: t(i), value: fin(adxVal[i]),
        color: gt(cfg.adxWeak, adxVal[i]) ? color.blue : gt(cfg.adxMid, adxVal[i]) ? color.yellow : color.red,
      })),
    },
    hlines: [
      { value: ohl, options: { title: '', color: RED, linestyle: 'dashed' } },
      { value: 100, options: { title: '', color: RED, linestyle: 'dashed' } },
      { value: -ohl, options: { title: '', color: GREEN, linestyle: 'dashed' } },
      { value: -100, options: { title: '', color: GREEN, linestyle: 'dashed' } },
      { value: ohl, options: { title: 'RCI +80ライン', color: color.red, linestyle: 'dotted' } },
      { value: -ohl, options: { title: 'RCI -80ライン', color: color.green, linestyle: 'dotted' } },
      { value: 0, options: { title: 'ゼロライン', color: color.gray, linestyle: 'dashed' } },
      { value: cfg.adxMid, options: { title: '中間閾値', color: color.gray, linestyle: 'dotted' } },
    ],
    fills: [
      // fill(topZoneLine1, topZoneLine2, color.new(color.red, 80)); fill(bottomZoneLine1, bottomZoneLine2, ...)
      { plot1: 'hline_top1', plot2: 'hline_top2', colors: new Array<string>(n).fill(TOP_FILL) },
      { plot1: 'hline_bottom1', plot2: 'hline_bottom2', colors: new Array<string>(n).fill(BOTTOM_FILL) },
    ],
    bgColors,
  };
}

export const ThreeLinesRciPsySignal = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
