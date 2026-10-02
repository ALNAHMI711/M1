/**
 * TrendMasterPro_Fekonomi
 *
 * A weighted vote of four signals: MACD line / signal crossover (weight 2), RSI above / below 50 (weight 2), short /
 * long EMA crossover with a +DI / -DI / ADX filter (weight 1), and the price above / below a cloud of two
 * Ichimoku-like spans built from SMAs of the high and low (weight 1, the buy side also needs a volume spike on a
 * green candle). A BUY / SELL label is drawn when the vote share reaches the confidence level. The script plots the
 * two EMAs, the two spans with a green / red fill between them, and the close.
 *
 * The Pine script destructures ta.dmi as [adx, adx_plus_di, adx_minus_di], while ta.dmi returns
 * [+DI, -DI, ADX]: its "adx" is +DI, its "adx_plus_di" is -DI and its "adx_minus_di" is the ADX. The port keeps
 * this behaviour.
 *
 * Reference: "TrendMasterPro_Fekonomi" by fekonomi
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface TrendMasterProFekonomiInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
  shortEmaLength: number;
  longEmaLength: number;
  adxLength: number;
  adxSmoothing: number;
  adxThreshold: number;
  plusDiThreshold: number;
  minusDiThreshold: number;
  conversionLength: number;
  baseLength: number;
  laggingSpan: number;
  /** Not used by the Pine script */
  displacement: number;
  rsiLength: number;
  /** Volume increase threshold (x times the 20-bar average volume) */
  volumeThreshold: number;
  macdWeight: number;
  rsiWeight: number;
  emaWeight: number;
  cloudWeight: number;
  /** Confidence level (%) */
  confidenceLevel: number;
}

export const defaultInputs: TrendMasterProFekonomiInputs = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  shortEmaLength: 9,
  longEmaLength: 21,
  adxLength: 14,
  adxSmoothing: 14,
  adxThreshold: 20,
  plusDiThreshold: 25,
  minusDiThreshold: 25,
  conversionLength: 9,
  baseLength: 26,
  laggingSpan: 52,
  displacement: 26,
  rsiLength: 14,
  volumeThreshold: 1.5,
  macdWeight: 2,
  rsiWeight: 2,
  emaWeight: 1,
  cloudWeight: 1,
  confidenceLevel: 70,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'MACD Fast Length', defval: 12 },
  { id: 'slowLength', type: 'int', title: 'MACD Slow Length', defval: 26 },
  { id: 'signalLength', type: 'int', title: 'MACD Signal Length', defval: 9 },
  { id: 'shortEmaLength', type: 'int', title: 'Short EMA Length', defval: 9 },
  { id: 'longEmaLength', type: 'int', title: 'Long EMA Length', defval: 21 },
  { id: 'adxLength', type: 'int', title: 'ADX Length', defval: 14 },
  { id: 'adxSmoothing', type: 'int', title: 'ADX Smoothing', defval: 14 },
  { id: 'adxThreshold', type: 'int', title: 'ADX Threshold', defval: 20 },
  { id: 'plusDiThreshold', type: 'int', title: '+DI Threshold', defval: 25 },
  { id: 'minusDiThreshold', type: 'int', title: '-DI Threshold', defval: 25 },
  { id: 'conversionLength', type: 'int', title: 'Ichimoku Conversion Line Length', defval: 9 },
  { id: 'baseLength', type: 'int', title: 'Ichimoku Base Line Length', defval: 26 },
  { id: 'laggingSpan', type: 'int', title: 'Ichimoku Lagging Span Length', defval: 52 },
  { id: 'displacement', type: 'int', title: 'Ichimoku Displacement', defval: 26 },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14 },
  { id: 'volumeThreshold', type: 'float', title: 'Volume Increase Threshold (x times avg volume)', defval: 1.5 },
  { id: 'macdWeight', type: 'int', title: 'MACD Weight', defval: 2 },
  { id: 'rsiWeight', type: 'int', title: 'RSI Weight', defval: 2 },
  { id: 'emaWeight', type: 'int', title: 'EMA Weight', defval: 1 },
  { id: 'cloudWeight', type: 'int', title: 'Ichimoku Cloud Weight', defval: 1 },
  { id: 'confidenceLevel', type: 'int', title: 'Confidence Level (%)', defval: 70 },
];

const SPAN_A_COL = String(color.new(color.green, 80));
const SPAN_B_COL = String(color.new(color.red, 80));
const FILL_UP = String(color.new(color.green, 90));
const FILL_DOWN = String(color.new(color.red, 90));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Short EMA', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'Long EMA', color: color.orange, lineWidth: 1 },
  { id: 'plot2', title: 'Leading Span A', color: SPAN_A_COL, lineWidth: 1 },
  { id: 'plot3', title: 'Leading Span B', color: SPAN_B_COL, lineWidth: 1 },
  { id: 'plot4', title: 'Plot', color: color.blue, lineWidth: 1 },
];

export const metadata = {
  title: 'TrendMasterPro_Fekonomi',
  shortTitle: 'TrendMasterPro_Fekonomi',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

export function calculate(
  bars: Bar[],
  inputs: Partial<TrendMasterProFekonomiInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const close = bars.map((b) => b.close);
  const closeS = S(close);
  const highS = S(bars.map((b) => b.high));
  const lowS = S(bars.map((b) => b.low));
  const volume = bars.map((b) => b.volume ?? NaN);

  const [macdS, signalS] = ta.macd(closeS, cfg.fastLength, cfg.slowLength, cfg.signalLength);
  const macdLine = A(macdS);
  const signalLine = A(signalS);
  const rsi = A(ta.rsi(closeS, cfg.rsiLength));
  const shortEma = A(ta.ema(closeS, cfg.shortEmaLength));
  const longEma = A(ta.ema(closeS, cfg.longEmaLength));
  // [adx, adx_plus_di, adx_minus_di] = ta.dmi(...): ta.dmi returns [+DI, -DI, ADX]
  const [dmiA, dmiB, dmiC] = ta.dmi(bars, cfg.adxLength, cfg.adxSmoothing);
  const adx = A(dmiA);
  const adxPlusDi = A(dmiB);
  const adxMinusDi = A(dmiC);
  const smaHL = (len: number) => {
    const h = A(ta.sma(highS, len));
    const l = A(ta.sma(lowS, len));
    return h.map((v, i) => (v + l[i]) / 2);
  };
  const conversionLine = smaHL(cfg.conversionLength);
  const baseLine = smaHL(cfg.baseLength);
  const spanA = conversionLine.map((v, i) => (v + baseLine[i]) / 2);
  const spanB = smaHL(cfg.laggingSpan);
  const averageVolume = A(ta.sma(S(volume), 20));

  const totalWeight = cfg.macdWeight + cfg.rsiWeight + cfg.emaWeight + cfg.cloudWeight;
  const confidence = cfg.confidenceLevel / 100;
  // ta.crossover(a, b): a > b and a[1] <= b[1]; ta.crossunder(a, b): a < b and a[1] >= b[1]; exact comparisons
  const crossover = (a: number[], b: number[], i: number) => i > 0 && a[i] > b[i] && a[i - 1] <= b[i - 1];
  const crossunder = (a: number[], b: number[], i: number) => i > 0 && a[i] < b[i] && a[i - 1] >= b[i - 1];

  const markers: MarkerData[] = [];
  const fillColors: string[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = bars[i].time as number;
    const macdBuy = crossover(macdLine, signalLine, i);
    const macdSell = crossunder(macdLine, signalLine, i);
    const rsiBuy = gt(rsi[i], 50);
    const rsiSell = lt(rsi[i], 50);
    const emaBuy = crossover(shortEma, longEma, i);
    const emaSell = crossunder(shortEma, longEma, i);
    const adxBuy = gt(adx[i], cfg.adxThreshold) && gt(adxPlusDi[i], adxMinusDi[i]) && gt(adxPlusDi[i], cfg.plusDiThreshold);
    const adxSell = gt(adx[i], cfg.adxThreshold) && gt(adxMinusDi[i], adxPlusDi[i]) && gt(adxMinusDi[i], cfg.minusDiThreshold);
    const cloudBuy = gt(close[i], Math.max(spanA[i], spanB[i])) && gt(spanA[i], spanB[i]);
    const cloudSell = lt(close[i], Math.min(spanA[i], spanB[i])) && lt(spanA[i], spanB[i]);
    // volume_increase = na(average_volume) ? false : volume > average_volume * volume_threshold and close > open
    const volumeIncrease = isNaN(averageVolume[i])
      ? false
      : gt(volume[i], averageVolume[i] * cfg.volumeThreshold) && gt(close[i], bars[i].open);
    const buyConditions = (macdBuy ? cfg.macdWeight : 0) + (rsiBuy ? cfg.rsiWeight : 0)
      + (emaBuy && adxBuy ? cfg.emaWeight : 0) + (cloudBuy && volumeIncrease ? cfg.cloudWeight : 0);
    const sellConditions = (macdSell ? cfg.macdWeight : 0) + (rsiSell ? cfg.rsiWeight : 0)
      + (emaSell && adxSell ? cfg.emaWeight : 0) + (cloudSell ? cfg.cloudWeight : 0);
    if (ge(buyConditions / totalWeight, confidence)) {
      markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'BUY', textColor: color.blue });
    }
    if (ge(sellConditions / totalWeight, confidence)) {
      markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL', textColor: color.blue });
    }
    // fill_color = leading_span_a > leading_span_b ? color.new(color.green, 90) : color.new(color.red, 90)
    fillColors[i] = gt(spanA[i], spanB[i]) ? FILL_UP : FILL_DOWN;
  }

  const line = (vals: number[]) => bars.map((b, i) => ({ time: b.time as number, value: vals[i] }));
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: line(shortEma), plot1: line(longEma), plot2: line(spanA), plot3: line(spanB), plot4: line(close) },
    fills: [{ plot1: 'plot2', plot2: 'plot3', options: { title: 'Plots Background' }, colors: fillColors }],
    markers,
  };
}

export const TrendMasterProFekonomi = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
