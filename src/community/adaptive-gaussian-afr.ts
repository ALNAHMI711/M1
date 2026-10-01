/**
 * Adaptive Gaussian AFR
 *
 * A 4-pole Gaussian filter of hl2 whose length adapts to volatility: length = max(2, round(base length /
 * max(ATR(lookback) / ATR(2 * lookback), 0.5))). A trailing range level (AFR) follows the filter at ATR * factor:
 * while the close is above the previous level it ratchets up to max(filter - ATR * factor, previous level),
 * otherwise it ratchets down to min(filter + ATR * factor, previous level). The level and the price candles are
 * blue when the close is above the previous level and purple otherwise.
 *
 * Reference: "Adaptive Gaussian AFR" by Mattes00
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';

export interface AdaptiveGaussianAFRInputs {
  /** ATR period of the trailing range */
  atrLen: number;
  /** ATR factor of the trailing range */
  atrMult: number;
  /** Gaussian base length */
  gLen: number;
  /** Adaptive lookback (ATR(lookback) / ATR(2 * lookback)) */
  lookback: number;
}

export const defaultInputs: AdaptiveGaussianAFRInputs = {
  atrLen: 14,
  atrMult: 1.5,
  gLen: 20,
  lookback: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrLen', type: 'int', title: 'ATR Period', defval: 14 },
  { id: 'atrMult', type: 'float', title: 'ATR Factor', defval: 1.5, step: 0.05 },
  { id: 'gLen', type: 'int', title: 'Gaussian Base Length', defval: 20 },
  { id: 'lookback', type: 'int', title: 'Adaptive Lookback', defval: 10 },
];

const BULL_COL = String(color.rgb(45, 162, 252));
const BEAR_COL = String(color.rgb(113, 59, 249));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Adaptive Gaussian AFR', color: BULL_COL, lineWidth: 3 },
  { id: 'plot1', title: 'Gaussian Source', color: String(color.new(BULL_COL, 70)), lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Adaptive Gaussian AFR',
  shortTitle: 'AG-AFR',
  overlay: true,
};

const nz = (v: number) => (isNaN(v) ? 0 : v);
/** Pine x / y: na when y is 0 */
const div = (x: number, y: number) => (y === 0 ? NaN : x / y);
/** Pine math.max / math.min: na when an argument is na */
const max = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.max(a, b));
const min = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.min(a, b));

export function calculate(
  bars: Bar[],
  inputs: Partial<AdaptiveGaussianAFRInputs> = {},
): IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: { toArray(): (number | null | undefined)[] }) => s.toArray().map((v) => v ?? NaN);

  // vol_ratio = ta.atr(lookback) / ta.atr(lookback * 2)
  const atrShort = A(ta.atr(bars, cfg.lookback));
  const atrLong = A(ta.atr(bars, cfg.lookback * 2));
  const atrVal = A(ta.atr(bars, cfg.atrLen));

  const gSrc: number[] = new Array(n);
  const afr: number[] = new Array(n);
  const bull: boolean[] = new Array(n);
  const root = Math.pow(Math.sqrt(2), 2.0 / 4.0) - 1.0;
  let prevAfr = 0; // var float afr_level = 0.0
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const volRatio = div(atrShort[i], atrLong[i]);
    // adaptive_len = math.max(2, math.round(g_len / math.max(vol_ratio, 0.5)))
    const adaptiveLen = max(2, Math.round(cfg.gLen / max(volRatio, 0.5)));
    const beta = (1 - Math.cos((2 * Math.PI) / adaptiveLen)) / root;
    const alpha = -beta + Math.sqrt(beta * beta + 2 * beta);
    const g = (k: number) => (i - k >= 0 ? nz(gSrc[i - k]) : 0);
    const hl2 = (b.high + b.low) / 2;
    gSrc[i] = Math.pow(alpha, 4) * hl2
      + 4 * (1 - alpha) * g(1)
      - 6 * Math.pow(1 - alpha, 2) * g(2)
      + 4 * Math.pow(1 - alpha, 3) * g(3)
      - Math.pow(1 - alpha, 4) * g(4);

    const ol = gSrc[i] - atrVal[i] * cfg.atrMult;
    const oh = gSrc[i] + atrVal[i] * cfg.atrMult;
    const last = nz(prevAfr);
    // is_bullish = close > nz(afr_level[1])
    bull[i] = b.close - last > 1e-10;
    afr[i] = bull[i] ? max(ol, last) : min(oh, last);
    prevAfr = afr[i];
  }

  const col = bull.map((x) => (x ? BULL_COL : BEAR_COL));
  const t = (i: number) => bars[i].time;
  const plot0 = bars.map((_b, i) => ({ time: t(i), value: afr[i], color: col[i] }));
  // plot(g_src, "Gaussian Source", color = color.new(syscol, 70), display = display.none)
  const plot1 = bars.map((_b, i) => ({ time: t(i), value: gSrc[i], color: String(color.new(col[i], 70)) }));

  // plotcandle(open, high, low, close, 'BarColor', color = syscol, bordercolor = syscol, wickcolor = syscol, force_overlay = true)
  const candles: PlotCandleData[] = bars.map((b, i) => ({
    time: b.time, open: b.open, high: b.high, low: b.low, close: b.close,
    color: col[i], borderColor: col[i], wickColor: col[i], forceOverlay: true,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1 },
    plotCandles: { BarColor: candles },
  };
}

export const AdaptiveGaussianAFR = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
