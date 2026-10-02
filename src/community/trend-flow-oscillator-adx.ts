/**
 * Trend Flow Oscillator (CMF + MFI) + ADX
 *
 * TFO = CMF + scaled MFI, optionally smoothed with an SMA. MFI = ta.mfi(source, mfiLen) scaled to -1..+1
 * ((mfi - 50) / 50). CMF = sum(ad, cmfLen) / sum(volume, cmfLen) with ad = ((2 * close - high - low) / (high - low))
 * * volume (0 when high == low). The TFO line is light blue when >= 0 and rising, dark blue when >= 0 and not
 * rising, red when < 0 and falling, maroon otherwise. The ADX (DMI with Wilder smoothing) is scaled with
 * (adx - 25) / 25. A grey background marks the bars where |TFO| > 1. CMF and scaled MFI are hidden plots.
 *
 * Reference: "Trend Flow Oscillator (CMF + MFI) + ADX" by WalrusQuant
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © VP_Futures
 */

import {
  ta, math, fixnan, Series, getSourceSeries, color,
  type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { BgColorData } from '../types';

export interface TrendFlowOscillatorAdxInputs {
  /** MFI length */
  mfiLen: number;
  /** CMF length */
  cmfLen: number;
  /** Price source of the MFI */
  src: SourceType;
  /** SMA length of the TFO (1 = no smoothing) */
  smoothLen: number;
  /** ADX smoothing */
  adxLen: number;
  /** DI length */
  diLen: number;
}

export const defaultInputs: TrendFlowOscillatorAdxInputs = {
  mfiLen: 14,
  cmfLen: 20,
  src: 'hlc3',
  smoothLen: 2,
  adxLen: 14,
  diLen: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'mfiLen', type: 'int', title: 'MFI Length', defval: 14, min: 1 },
  { id: 'cmfLen', type: 'int', title: 'CMF Length', defval: 20, min: 1 },
  { id: 'src', type: 'source', title: 'Price Source', defval: 'hlc3' },
  { id: 'smoothLen', type: 'int', title: 'TFO Smoothing', defval: 2, min: 1, max: 10 },
  { id: 'adxLen', type: 'int', title: 'ADX Smoothing', defval: 14 },
  { id: 'diLen', type: 'int', title: 'DI Length', defval: 14 },
];

const COL_UP_RISING = String(color.new('#46abe1', 20));
const COL_UP_FALLING = String(color.new('#1040df', 20));
const COL_DOWN_FALLING = String(color.new(color.red, 20));
const COL_DOWN_RISING = String(color.new(color.maroon, 20));
const BG_EXTREME = String(color.new(color.gray, 95));
const BAND_COL = String(color.new(color.gray, 70));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'TFO', color: COL_UP_RISING, lineWidth: 2 },
  { id: 'plot1', title: 'ADX (scaled)', color: color.yellow, lineWidth: 1 },
  { id: 'plot2', title: 'CMF', color: String(color.new(color.blue, 70)), lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'MFI Scaled', color: String(color.new(color.orange, 70)), lineWidth: 1, display: 'none' },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, title: 'Zero', color: color.gray, linestyle: 'dashed' },
  { id: 'hline_upper', price: 0.7, title: 'Upper', color: BAND_COL, linestyle: 'dashed' },
  { id: 'hline_lower', price: -0.7, title: 'Lower', color: BAND_COL, linestyle: 'dashed' },
];

export const metadata = {
  title: 'Trend Flow Oscillator (CMF + MFI) + ADX',
  shortTitle: 'TFO+ADX',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<TrendFlowOscillatorAdxInputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const vol = bars.map((b) => b.volume ?? NaN);

  // mfi = (ta.mfi(src, mfiLen) - 50) / 50
  const mfiRaw = A(ta.mfi(getSourceSeries(bars, cfg.src), cfg.mfiLen, S(vol)));
  const mfi = mfiRaw.map((v) => (v - 50.0) / 50.0);

  // ad = high == low ? 0 : ((2 * close - high - low) / (high - low)) * volume
  const ad = bars.map((b, i) => (eq(b.high, b.low) ? 0.0 : ((2.0 * b.close - b.high - b.low) / (b.high - b.low)) * vol[i]));
  const sumAd = A(math.sum(S(ad), cfg.cmfLen) as Series);
  const sumVol = A(math.sum(S(vol), cfg.cmfLen) as Series);
  // plain division: x / 0 is +-infinity, 0 / 0 na
  const cmf = sumAd.map((v, i) => v / sumVol[i]);

  // tfo = smoothLen > 1 ? ta.sma(cmf + mfi, smoothLen) : cmf + mfi
  const tfoRaw = cmf.map((v, i) => v + mfi[i]);
  const tfo = cfg.smoothLen > 1 ? A(ta.sma(S(tfoRaw), cfg.smoothLen)) : tfoRaw;

  // dirmov(diLen)
  const up = bars.map((b, i) => (i > 0 ? b.high - bars[i - 1].high : NaN));
  const down = bars.map((b, i) => (i > 0 ? -(b.low - bars[i - 1].low) : NaN));
  const plusDM = up.map((u, i) => (isNaN(u) ? NaN : gt(u, down[i]) && gt(u, 0) ? u : 0));
  const minusDM = down.map((d, i) => (isNaN(d) ? NaN : gt(d, up[i]) && gt(d, 0) ? d : 0));
  const trRma = A(ta.rma(ta.tr(bars, false), cfg.diLen));
  const plusRma = A(ta.rma(S(plusDM), cfg.diLen));
  const minusRma = A(ta.rma(S(minusDM), cfg.diLen));
  const plus = fixnan(plusRma.map((v, i) => (100 * v) / trRma[i]));
  const minus = fixnan(minusRma.map((v, i) => (100 * v) / trRma[i]));
  // adx = 100 * ta.rma(math.abs(p - m) / (sumDM == 0 ? 1 : sumDM), adxLen)
  const dx = plus.map((p, i) => {
    const sumDM = p + minus[i];
    return Math.abs(p - minus[i]) / (eq(sumDM, 0) ? 1 : sumDM);
  });
  const adxRaw = A(ta.rma(S(dx), cfg.adxLen)).map((v) => 100 * v);
  const adxNorm = adxRaw.map((v) => (v - 25) / 25);

  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const t = (i: number) => bars[i].time;
  const plot0 = new Array(n);
  const plot1 = new Array(n);
  const plot2 = new Array(n);
  const plot3 = new Array(n);
  const bgColors: BgColorData[] = [];
  for (let i = 0; i < n; i++) {
    const prev = i > 0 ? tfo[i - 1] : NaN;
    const c = ge(tfo[i], 0)
      ? (gt(tfo[i], prev) ? COL_UP_RISING : COL_UP_FALLING)
      : (lt(tfo[i], prev) ? COL_DOWN_FALLING : COL_DOWN_RISING);
    plot0[i] = { time: t(i), value: fin(tfo[i]), color: c };
    plot1[i] = { time: t(i), value: fin(adxNorm[i]), color: color.yellow };
    plot2[i] = { time: t(i), value: fin(cmf[i]) };
    plot3[i] = { time: t(i), value: fin(mfi[i]) };
    // bgcolor(math.abs(tfo) > 1.0 ? color.new(color.gray, 95) : na)
    if (gt(Math.abs(tfo[i]), 1.0)) bgColors.push({ time: t(i), color: BG_EXTREME });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2, plot3 },
    hlines: hlineConfig.map((h) => ({ value: h.price, options: { title: h.title, color: h.color, linestyle: h.linestyle } })),
    bgColors,
  };
}

export const TrendFlowOscillatorAdx = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
