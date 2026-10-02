/**
 * WAE Sniper Scalp XAUUSD M1 (Tuned)
 *
 * A Waddah Attar Explosion variant. t1 = (MACD - MACD[1]) * sensitivity, with MACD = EMA(fast) - EMA(slow) of the
 * close; trend up = t1 when t1 > 0 (else 0), trend down = -t1 when t1 < 0 (else 0), drawn as columns. The explosion
 * line is the Bollinger band width (2 * mult * stdev) and the dead zone is the RMA of the true range * ATR mult.
 * A buy signal: trend up above the dead zone and the explosion line, rising, with the close above the trend EMA; a
 * sell signal: the same for trend down with the close below the trend EMA. A signal is drawn only when the previous
 * bar was not locked in the same direction (the lock is set by a signal and cleared by an opposite signal).
 *
 * Reference: "WAE Sniper Scalp – XAUUSD M1 (Tuned)" by khonthailoei19071983
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface WaeSniperScalpXauusdM1TunedInputs {
  sensitivity: number;
  /** Fast EMA length */
  fastLength: number;
  /** Slow EMA length */
  slowLength: number;
  /** Bollinger band length */
  channelLength: number;
  /** Bollinger band multiplier */
  mult: number;
  /** Trend EMA filter length */
  emaFilterLen: number;
  /** ATR dead zone length */
  atrLength: number;
  /** ATR dead zone multiplier */
  atrMult: number;
}

export const defaultInputs: WaeSniperScalpXauusdM1TunedInputs = {
  sensitivity: 150,
  fastLength: 12,
  slowLength: 26,
  channelLength: 20,
  mult: 2.0,
  emaFilterLen: 200,
  atrLength: 14,
  atrMult: 1.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'sensitivity', type: 'int', title: 'Sensitivity', defval: 150 },
  { id: 'fastLength', type: 'int', title: 'Fast EMA', defval: 12 },
  { id: 'slowLength', type: 'int', title: 'Slow EMA', defval: 26 },
  { id: 'channelLength', type: 'int', title: 'BB Length', defval: 20 },
  { id: 'mult', type: 'float', title: 'BB Mult', defval: 2.0 },
  { id: 'emaFilterLen', type: 'int', title: 'Trend EMA Filter', defval: 200 },
  { id: 'atrLength', type: 'int', title: 'ATR DeadZone Len', defval: 14 },
  { id: 'atrMult', type: 'float', title: 'ATR DeadZone Mult', defval: 1.5 },
];

const UP_COL = String(color.new(color.green, 40));
const DOWN_COL = String(color.new(color.red, 40));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Up Trend', color: UP_COL, lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Down Trend', color: DOWN_COL, lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'Explosion Line (BB)', color: color.orange, lineWidth: 2 },
  { id: 'plot3', title: 'DeadZone (ATR)', color: color.blue, lineWidth: 1 },
];

export const metadata = {
  title: 'WAE Sniper Scalp – XAUUSD M1 (Tuned)',
  shortTitle: 'WAE Sniper Scalp – XAUUSD M1 (Tuned)',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<WaeSniperScalpXauusdM1TunedInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const close = Series.fromArray(bars, bars.map((b) => b.close));

  const emaFast = A(ta.ema(close, cfg.fastLength));
  const emaSlow = A(ta.ema(close, cfg.slowLength));
  const basis = A(ta.sma(close, cfg.channelLength));
  const sd = A(ta.stdev(close, cfg.channelLength));
  const rmaTr = A(ta.rma(ta.tr(bars, true), cfg.atrLength));
  const emaFilter = A(ta.ema(close, cfg.emaFilterLen));

  const trendUp: number[] = new Array(n);
  const trendDown: number[] = new Array(n);
  const bbWidth: number[] = new Array(n);
  const deadZone: number[] = new Array(n);
  const markers: MarkerData[] = [];
  let buyLock = false; // var bool buyLock = false
  let sellLock = false;
  let prevMacd = NaN;
  for (let i = 0; i < n; i++) {
    const macd = emaFast[i] - emaSlow[i];
    const t1 = (macd - prevMacd) * cfg.sensitivity;
    prevMacd = macd;
    const dev = cfg.mult * sd[i];
    bbWidth[i] = basis[i] + dev - (basis[i] - dev);
    deadZone[i] = rmaTr[i] * cfg.atrMult;
    trendUp[i] = gt(t1, 0) ? t1 : 0;
    trendDown[i] = gt(0, t1) ? -t1 : 0;

    const c = bars[i].close;
    const buySignal = gt(trendUp[i], deadZone[i]) && gt(trendUp[i], bbWidth[i]) && gt(c, emaFilter[i])
      && i > 0 && gt(trendUp[i], trendUp[i - 1]);
    const sellSignal = gt(trendDown[i], deadZone[i]) && gt(trendDown[i], bbWidth[i]) && gt(emaFilter[i], c)
      && i > 0 && gt(trendDown[i], trendDown[i - 1]);

    // plotshape(buySignal and not buyLock[1], ...): buyLock[1] is the lock before this bar's updates
    const prevBuyLock = buyLock;
    const prevSellLock = sellLock;
    if (buySignal) {
      buyLock = true;
      sellLock = false;
    }
    if (sellSignal) {
      sellLock = true;
      buyLock = false;
    }
    if (buySignal && !prevBuyLock) {
      markers.push({ time: bars[i].time, position: 'bottom', shape: 'triangleUp', color: color.green, size: 'tiny' });
    }
    if (sellSignal && !prevSellLock) {
      markers.push({ time: bars[i].time, position: 'top', shape: 'triangleDown', color: color.red, size: 'tiny' });
    }
  }

  const line = (v: number[], c: string) => bars.map((bar, i) => ({ time: bar.time, value: v[i], color: c }));
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: line(trendUp, UP_COL),
      plot1: line(trendDown, DOWN_COL),
      plot2: line(bbWidth, color.orange),
      plot3: line(deadZone, color.blue),
    },
    markers,
  };
}

export const WaeSniperScalpXauusdM1Tuned = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
