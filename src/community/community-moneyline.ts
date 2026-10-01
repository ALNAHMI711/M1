/**
 * Community MoneyLine
 *
 * An ATR trailing stop on Heikin-Ashi prices (or plain prices). Long stop = close - ATR * depth, short stop =
 * close + ATR * depth; each stop only moves in the trend direction while the previous close is beyond the previous
 * stop. The trend turns bearish when the low breaks below the previous stop and bullish when the high breaks above it;
 * an optional momentum filter also asks the close to be below / above an EMA. The line (green / red) breaks on a flip
 * bar, a cloud fills the space between the line and the close, and labels mark the flips.
 *
 * Reference: "Community MoneyLine" by rafstar_kaczmarek
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface CommunityMoneylineInputs {
  /** ATR length */
  atrPeriod: number;
  /** ATR multiplier of the stop distance */
  multiplier: number;
  /** Use Heikin-Ashi close / high / low */
  useHA: boolean;
  /** Label distance from the stop, in ATR */
  offsetMult: number;
  /** A flip also needs the close below (bearish) / above (bullish) the EMA */
  filterNoise: boolean;
  /** Length of the filter EMA (of the close) */
  emaLength: number;
}

export const defaultInputs: CommunityMoneylineInputs = {
  atrPeriod: 7,
  multiplier: 3.5,
  useHA: true,
  offsetMult: 0.6,
  filterNoise: false,
  emaLength: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrPeriod', type: 'int', title: 'ATR Sensitivity', defval: 7, min: 1 },
  { id: 'multiplier', type: 'float', title: 'Trend Depth', defval: 3.5, step: 0.1 },
  { id: 'useHA', type: 'bool', title: 'Use Heikin Ashi Smoothing', defval: true },
  { id: 'offsetMult', type: 'float', title: 'Label Offset', defval: 0.6, step: 0.1 },
  { id: 'filterNoise', type: 'bool', title: 'Enable Momentum Filter', defval: false },
  { id: 'emaLength', type: 'int', title: 'Filter EMA Length', defval: 50, min: 1 },
];

const LINE_BULL = String(color.new(color.green, 0));
const LINE_BEAR = String(color.new(color.red, 0));
const FILL_BULL = String(color.new(color.green, 85));
const FILL_BEAR = String(color.new(color.red, 85));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MoneyLine', color: LINE_BULL, lineWidth: 2, style: 'linebr' },
  { id: 'plot1', title: 'Price Reference', color: color.blue, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Community MoneyLine',
  shortTitle: 'Community MoneyLine',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<CommunityMoneylineInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  const filterEma = A(ta.ema(Series.fromArray(bars, bars.map((b) => b.close)), cfg.emaLength));
  const atrValue = A(ta.atr(bars, cfg.atrPeriod));

  const plot0: { time: number; value: number; color: string }[] = [];
  const plot1: { time: number; value: number }[] = [];
  const fillColors: string[] = [];
  const markers: MarkerData[] = [];

  let haOpen = NaN;
  let haClosePrev = NaN;
  let priceClosePrev = NaN; // price_close[1]
  let trailStop = NaN; // var float trailStop = na (its value at the start of a bar is trailStop[1])
  let isBullish = true; // var bool isBullish = true
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    // Heikin-Ashi: haOpen := na(haOpen[1]) ? (open + close) / 2 : (haOpen[1] + haClose[1]) / 2
    const haClose = (b.open + b.high + b.low + b.close) / 4;
    haOpen = i === 0 ? (b.open + b.close) / 2 : (haOpen + haClosePrev) / 2;
    const haHigh = Math.max(b.high, Math.max(haOpen, haClose));
    const haLow = Math.min(b.low, Math.min(haOpen, haClose));
    const priceClose = cfg.useHA ? haClose : b.close;
    const priceHigh = cfg.useHA ? haHigh : b.high;
    const priceLow = cfg.useHA ? haLow : b.low;

    const atr = atrValue[i] * cfg.multiplier;
    let longStop = priceClose - atr;
    let shortStop = priceClose + atr;
    const prevStop = trailStop; // trailStop[1]
    // if not (trailStop[1] != trailStop[1]): na != na is false in Pine, so this block runs on every bar
    longStop = gt(priceClosePrev, prevStop) ? Math.max(longStop, prevStop) : longStop;
    shortStop = lt(priceClosePrev, prevStop) ? Math.min(shortStop, prevStop) : shortStop;

    // prevIsBullish = bar_index > 0 ? isBullish[1] : true equals the current var value: the else branch keeps it
    let flipTriggered = false;
    if (isBullish && lt(priceLow, prevStop)) {
      if (!cfg.filterNoise || lt(b.close, filterEma[i])) {
        isBullish = false;
        flipTriggered = true;
      }
    } else if (!isBullish && gt(priceHigh, prevStop)) {
      if (!cfg.filterNoise || gt(b.close, filterEma[i])) {
        isBullish = true;
        flipTriggered = true;
      }
    }
    trailStop = isBullish ? longStop : shortStop;
    const displayStop = flipTriggered ? NaN : trailStop;

    plot0.push({ time: b.time, value: Number.isFinite(displayStop) ? displayStop : NaN, color: isBullish ? LINE_BULL : LINE_BEAR });
    plot1.push({ time: b.time, value: b.close });
    fillColors.push(isBullish ? FILL_BULL : FILL_BEAR);

    // plotshape(..., style = shape.labelup / labeldown, location = location.absolute, size = size.small)
    const labelBuffer = atrValue[i] * cfg.offsetMult;
    if (flipTriggered) {
      const price = isBullish ? trailStop - labelBuffer : trailStop + labelBuffer;
      if (Number.isFinite(price)) {
        markers.push(isBullish
          ? { time: b.time, position: 'atPriceBottom', price, shape: 'labelUp', color: color.green, text: 'Bullish', textColor: color.white, size: 'small' }
          : { time: b.time, position: 'atPriceTop', price, shape: 'labelDown', color: color.red, text: 'Bearish', textColor: color.white, size: 'small' });
      }
    }

    haClosePrev = haClose;
    priceClosePrev = priceClose;
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1 },
    // fill(mlPlot, pricePlot, color = fillColor, title = 'MoneyLine Cloud')
    fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'MoneyLine Cloud' }, colors: fillColors }],
    markers,
  };
}

export const CommunityMoneyline = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
