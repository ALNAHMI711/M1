/**
 * ADX Trend Strength Filter + TRAMA [DotGain]
 *
 * TRAMA (trend regularity adaptive moving average): the smoothing factor is the square of the SMA over `tramaLength`
 * of a flag that is 1 when the highest high of `tramaLength` bars rises or the lowest low falls. A signal state is
 * kept: bullish when the close is above TRAMA, the EMA of a short RSI is above its SMA and a hand-made ADX is above
 * the threshold; bearish for the opposite; neutral when the close is between TRAMA and the SMA of the close. The bars
 * are green (bullish), red (bearish) or orange (neutral). TRAMA and the SMA are drawn with a fill between them.
 *
 * Reference: "ADX Trend Strength Filter + TRAMA [DotGain]" by DotGain
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: @ DotGain
 */

import {
  ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface AdxTrendStrengthFilterTramaInputs {
  tramaLength: number;
  tramaSrc: SourceType;
  rsiLength: number;
  rsiSmaLength: number;
  rsiEmaLength: number;
  adxLength: number;
  adxThreshold: number;
  showSma: boolean;
  smaLength: number;
}

export const defaultInputs: AdxTrendStrengthFilterTramaInputs = {
  tramaLength: 99,
  tramaSrc: 'close',
  rsiLength: 7,
  rsiSmaLength: 50,
  rsiEmaLength: 35,
  adxLength: 14,
  adxThreshold: 30,
  showSma: true,
  smaLength: 200,
};

export const inputConfig: InputConfig[] = [
  { id: 'tramaLength', type: 'int', title: 'TRAMA Length', defval: 99 },
  { id: 'tramaSrc', type: 'source', title: 'TRAMA Source', defval: 'close' },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 7 },
  { id: 'rsiSmaLength', type: 'int', title: 'RSI SMA Length', defval: 50 },
  { id: 'rsiEmaLength', type: 'int', title: 'RSI EMA Length', defval: 35 },
  { id: 'adxLength', type: 'int', title: 'ADX Length', defval: 14 },
  { id: 'adxThreshold', type: 'float', title: 'ADX Threshold', defval: 30 },
  { id: 'showSma', type: 'bool', title: 'Show SMA', defval: true },
  { id: 'smaLength', type: 'int', title: 'SMA Length', defval: 200 },
];

const TRAMA_COL = String(color.new(color.orange, 33));
const SMA_COL = color.white;
const FILL_COL = String(color.new(color.orange, 80));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'TRAMA', color: TRAMA_COL, lineWidth: 1 },
  { id: 'plot1', title: 'SMA', color: SMA_COL, lineWidth: 2 },
];

export const metadata = {
  title: 'ADX Trend Strength Filter + TRAMA [DotGain]',
  shortTitle: 'ADX TSF',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
/** Pine x != 0: false for na */
const ne0 = (a: number) => !isNaN(a) && Math.abs(a) > EPS;
/** Pine math.min / math.max: na when an argument is na */
const pmin = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.min(a, b));
const pmax = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.max(a, b));

export function calculate(
  bars: Bar[],
  inputs: Partial<AdxTrendStrengthFilterTramaInputs> = {},
): IndicatorResult & { barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const src = A(getSourceSeries(bars, cfg.tramaSrc));
  const close = bars.map((b) => b.close);

  // TRAMA
  const hhChange = A(ta.change(ta.highest(S(bars.map((b) => b.high)), cfg.tramaLength)));
  const llChange = A(ta.change(ta.lowest(S(bars.map((b) => b.low)), cfg.tramaLength)));
  const flag = bars.map((_b, i) => {
    const hh = pmax(Math.sign(hhChange[i]), 0);
    const ll = pmax(Math.sign(-llChange[i]), 0);
    return ne0(hh) || ne0(ll) ? 1.0 : 0.0;
  });
  const tcSma = A(ta.sma(S(flag), cfg.tramaLength));
  const ama = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const prev = i > 0 ? ama[i - 1] : NaN;
    // ama := nz(ama[1] + tc * (tramaSrc - ama[1]), tramaSrc)
    const v = prev + Math.pow(tcSma[i], 2) * (src[i] - prev);
    ama[i] = Number.isFinite(v) ? v : src[i];
  }

  // RSI and its moving averages
  const rsi = ta.rsi(S(close), cfg.rsiLength);
  const rsiSma = A(ta.sma(rsi, cfg.rsiSmaLength));
  const rsiEma = A(ta.ema(rsi, cfg.rsiEmaLength));

  // Hand-made ADX
  const plusDM = bars.map((b, i) => {
    const up = i > 0 ? b.high - bars[i - 1].high : NaN;
    const down = i > 0 ? bars[i - 1].low - b.low : NaN;
    return gt(up, down) && gt(up, 0) ? up : 0;
  });
  const minusDM = bars.map((b, i) => {
    const up = i > 0 ? b.high - bars[i - 1].high : NaN;
    const down = i > 0 ? bars[i - 1].low - b.low : NaN;
    return gt(down, up) && gt(down, 0) ? down : 0;
  });
  const trur = A(ta.rma(ta.tr(bars, true), cfg.adxLength));
  const plusRma = A(ta.rma(S(plusDM), cfg.adxLength));
  const minusRma = A(ta.rma(S(minusDM), cfg.adxLength));
  const dx = bars.map((_b, i) => {
    const plusDI = (100 * plusRma[i]) / trur[i];
    const minusDI = (100 * minusRma[i]) / trur[i];
    return (100 * Math.abs(plusDI - minusDI)) / (plusDI + minusDI);
  });
  const adx = A(ta.rma(S(dx), cfg.adxLength));
  const sma = A(ta.sma(S(close), cfg.smaLength));

  const barColors: BarColorData[] = [];
  let signalState = 0; // var int signalState = 0
  for (let i = 0; i < n; i++) {
    const c = close[i];
    const adxCondition = gt(adx[i], cfg.adxThreshold);
    const priceBetween = gt(c, pmin(ama[i], sma[i])) && lt(c, pmax(ama[i], sma[i]));
    const bull = gt(c, ama[i]) && gt(rsiEma[i], rsiSma[i]) && adxCondition;
    const bear = lt(c, ama[i]) && lt(rsiEma[i], rsiSma[i]) && adxCondition;
    if (priceBetween) signalState = 0;
    else if (signalState === 1) {
      if (bull) signalState = 1;
      else if (bear) signalState = -1;
    } else if (signalState === -1) {
      if (bear) signalState = -1;
      else if (bull) signalState = 1;
    } else if (bull) signalState = 1;
    else if (bear) signalState = -1;
    barColors.push({ time: bars[i].time, color: signalState === 1 ? color.green : signalState === -1 ? color.red : color.orange });
  }

  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: fin(ama[i]), color: TRAMA_COL })),
      plot1: bars.map((b, i) => ({ time: b.time, value: cfg.showSma ? fin(sma[i]) : NaN, color: SMA_COL })),
    },
    // fill(plotTrama, plotSma, color = color.new(color.orange, 80))
    fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: FILL_COL } }],
    barColors,
  };
}

export const AdxTrendStrengthFilterTrama = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
