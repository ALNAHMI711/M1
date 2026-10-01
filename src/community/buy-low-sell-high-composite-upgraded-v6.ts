/**
 * Buy Low Sell High Composite Upgraded V6
 *
 * Six indicators, each normalised to about -1..+1 with normalize(x, lo, hi) = -1 + 2 * (x - lo) / (hi - lo):
 * RSI (25..75), the EMA(5) - EMA(35) difference ("Elliott Wave", +-2 ATR(9)), CMO (-50..50), the MACD histogram
 * (MACD - SMA of MACD, +-2 ATR(9)), MFI of hlc3 (25..75) and the ADX signed by the +DI / -DI direction (-50..50).
 * A disabled indicator adds 0. The sum is normalised over -4..4 and smoothed by an EMA (or a triple EMA). The area
 * is red at or below 0, lime above; the outer line is lime / red / gray by the EMA of the bar-to-bar slope against
 * the slope threshold.
 *
 * Reference: "Buy Low Sell High Composite Upgraded V6 [kristian6ncqq]" by kristian6ncqq
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © kristian6ncqq
 */

import { ta, Series, getSourceSeries, fixnan, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface BuyLowSellHighCompositeUpgradedV6Inputs {
  useRSI: boolean;
  /** Use the EMA(5) - EMA(35) difference ("Elliott Wave") */
  useEW: boolean;
  useCMO: boolean;
  useMACD: boolean;
  useMFI: boolean;
  useADX: boolean;
  /** Triple EMA smoothing of the composite instead of one EMA */
  useTEMA: boolean;
  rsiLength: number;
  cmoLength: number;
  macdFast: number;
  macdSlow: number;
  macdSignalLen: number;
  mfiLength: number;
  adxLen: number;
  diLen: number;
  smoothingLength: number;
  slopeSmoothingLen: number;
  slopeThreshold: number;
}

export const defaultInputs: BuyLowSellHighCompositeUpgradedV6Inputs = {
  useRSI: true,
  useEW: true,
  useCMO: true,
  useMACD: true,
  useMFI: true,
  useADX: true,
  useTEMA: false,
  rsiLength: 14,
  cmoLength: 14,
  macdFast: 12,
  macdSlow: 26,
  macdSignalLen: 9,
  mfiLength: 14,
  adxLen: 14,
  diLen: 14,
  smoothingLength: 4,
  slopeSmoothingLen: 3,
  slopeThreshold: 0.02,
};

export const inputConfig: InputConfig[] = [
  { id: 'useRSI', type: 'bool', title: 'Use RSI', defval: true },
  { id: 'useEW', type: 'bool', title: 'Use EW', defval: true },
  { id: 'useCMO', type: 'bool', title: 'Use CMO', defval: true },
  { id: 'useMACD', type: 'bool', title: 'Use MACD', defval: true },
  { id: 'useMFI', type: 'bool', title: 'Use MFI', defval: true },
  { id: 'useADX', type: 'bool', title: 'Use ADX', defval: true },
  { id: 'useTEMA', type: 'bool', title: 'Use TEMA', defval: false },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'cmoLength', type: 'int', title: 'CMO Length', defval: 14, min: 1 },
  { id: 'macdFast', type: 'int', title: 'MACD Fast Length', defval: 12, min: 1 },
  { id: 'macdSlow', type: 'int', title: 'MACD Slow Length', defval: 26, min: 1 },
  { id: 'macdSignalLen', type: 'int', title: 'MACD Signal Length', defval: 9, min: 1 },
  { id: 'mfiLength', type: 'int', title: 'MFI Length', defval: 14, min: 1 },
  { id: 'adxLen', type: 'int', title: 'ADX Smoothing Length', defval: 14, min: 1 },
  { id: 'diLen', type: 'int', title: 'Directional Index Length', defval: 14, min: 1 },
  { id: 'smoothingLength', type: 'int', title: 'Composite Smoothing Length', defval: 4, min: 1 },
  { id: 'slopeSmoothingLen', type: 'int', title: 'Slope Smoothing Length', defval: 3, min: 1 },
  { id: 'slopeThreshold', type: 'float', title: 'Slope Threshold', defval: 0.02, min: 0.001, step: 0.001 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Composite Inner', color: String(color.new(color.lime, 60)), lineWidth: 2, style: 'area' },
  { id: 'plot1', title: 'Composite Outer', color: color.gray, lineWidth: 3 },
];

export const metadata = {
  title: 'Buy Low Sell High Composite Upgraded V6 [kristian6ncqq]',
  shortTitle: 'BLSH',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

/** normalize(value, minValue, maxValue): delta = maxValue - minValue == 0 ? 0.0001 : maxValue - minValue */
function normalize(value: number, minValue: number, maxValue: number): number {
  const delta = eq(maxValue - minValue, 0) ? 0.0001 : maxValue - minValue;
  return -1 + ((value - minValue) / delta) * 2;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<BuyLowSellHighCompositeUpgradedV6Inputs> = {},
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const close = getSourceSeries(bars, 'close');
  const zeros = new Array(n).fill(0);

  // atrValue = ta.atr(9); priceRange = 2 * atrValue
  const atr = A(ta.atr(bars, 9));
  const priceRange = atr.map((v) => 2 * v);

  // RSI
  let rsiN = zeros;
  if (cfg.useRSI) {
    const rsi = A(ta.rsi(close, cfg.rsiLength));
    rsiN = rsi.map((v) => normalize(v, 25, 75));
  }
  // Elliott Wave: ta.ema(close, 5) - ta.ema(close, 35)
  let ewN = zeros;
  if (cfg.useEW) {
    const e5 = A(ta.ema(close, 5));
    const e35 = A(ta.ema(close, 35));
    ewN = e5.map((v, i) => normalize(v - e35[i], -priceRange[i], priceRange[i]));
  }
  // CMO
  let cmoN = zeros;
  if (cfg.useCMO) {
    const cmo = A(ta.cmo(close, cfg.cmoLength));
    cmoN = cmo.map((v) => normalize(v, -50, 50));
  }
  // MACD histogram: macd - ta.sma(macd, macdSignalLen)
  let macdN = zeros;
  if (cfg.useMACD) {
    const fast = A(ta.ema(close, cfg.macdFast));
    const slow = A(ta.ema(close, cfg.macdSlow));
    const macd = fast.map((v, i) => v - slow[i]);
    const signal = A(ta.sma(S(macd), cfg.macdSignalLen));
    macdN = macd.map((v, i) => normalize(v - signal[i], -priceRange[i], priceRange[i]));
  }
  // MFI of hlc3
  let mfiN = zeros;
  if (cfg.useMFI) {
    const vol = S(bars.map((b) => b.volume ?? NaN));
    const mfi = A(ta.mfi(getSourceSeries(bars, 'hlc3'), cfg.mfiLength, vol));
    mfiN = mfi.map((v) => normalize(v, 25, 75));
  }
  // ADX signed by the direction: pdi > mdi ? adx : -adx
  let adxN = zeros;
  if (cfg.useADX) {
    // dirmov(diLen)
    const up = bars.map((b, i) => (i > 0 ? b.high - bars[i - 1].high : NaN)); // ta.change(high)
    const down = bars.map((b, i) => (i > 0 ? -(b.low - bars[i - 1].low) : NaN)); // -ta.change(low)
    const plusDM = up.map((u, i) => (isNaN(u) ? NaN : gt(u, down[i]) && gt(u, 0) ? u : 0));
    const minusDM = down.map((d, i) => (isNaN(d) ? NaN : gt(d, up[i]) && gt(d, 0) ? d : 0));
    const truerange = A(ta.rma(ta.tr(bars, false), cfg.diLen));
    const plusRma = A(ta.rma(S(plusDM), cfg.diLen));
    const minusRma = A(ta.rma(S(minusDM), cfg.diLen));
    // plain divisions: x / 0 is +-infinity (kept by fixnan), 0 / 0 is na (replaced by fixnan)
    const plus = fixnan(plusRma.map((v, i) => (100 * v) / truerange[i]));
    const minus = fixnan(minusRma.map((v, i) => (100 * v) / truerange[i]));
    // adx = 100 * ta.rma(math.abs(plus - minus) / (sum == 0 ? 1 : sum), adxLen)
    const ratio = plus.map((p, i) => {
      const sum = p + minus[i];
      return Math.abs(p - minus[i]) / (eq(sum, 0) ? 1 : sum);
    });
    const adx = A(ta.rma(S(ratio), cfg.adxLen)).map((v) => 100 * v);
    adxN = adx.map((v, i) => normalize(gt(plus[i], minus[i]) ? v : -v, -50, 50));
  }

  // Composite (Pine addition order)
  const compositeNormalized = bars.map((_b, i) =>
    normalize(ewN[i] + rsiN[i] + macdN[i] + mfiN[i] + cmoN[i] + adxN[i], -4, 4));
  let smoothed: number[];
  if (cfg.useTEMA) {
    const step1 = A(ta.ema(S(compositeNormalized), cfg.smoothingLength));
    const step2 = A(ta.ema(S(step1), cfg.smoothingLength));
    const step3 = A(ta.ema(S(step2), cfg.smoothingLength));
    smoothed = step1.map((v, i) => v * 3 - step2[i] * 3 + step3[i]);
  } else {
    smoothed = A(ta.ema(S(compositeNormalized), cfg.smoothingLength));
  }

  // slope = smoothed - smoothed[1]; slopeSmoothed = ta.ema(slope, slopeSmoothingLen)
  const slope = smoothed.map((v, i) => (i > 0 ? v - smoothed[i - 1] : NaN));
  const slopeSmoothed = A(ta.ema(S(slope), cfg.slopeSmoothingLen));

  const inner: { time: number; value: number; color: string }[] = [];
  const outer: { time: number; value: number; color: string }[] = [];
  const innerRed = String(color.new(color.red, 60));
  const innerLime = String(color.new(color.lime, 60));
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    const v = Number.isFinite(smoothed[i]) ? smoothed[i] : NaN;
    // compositeColor = smoothed <= 0 ? color.red : color.lime
    inner.push({ time: t, value: v, color: le(smoothed[i], 0) ? innerRed : innerLime });
    const isUptrend = gt(slopeSmoothed[i], cfg.slopeThreshold);
    const isDowntrend = gt(-cfg.slopeThreshold, slopeSmoothed[i]);
    outer.push({ time: t, value: v, color: isUptrend ? color.lime : isDowntrend ? color.red : color.gray });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: inner, plot1: outer },
  };
}

export const BuyLowSellHighCompositeUpgradedV6 = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
