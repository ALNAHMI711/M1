/**
 * Evil MACD Trading System
 *
 * MACD of the close: DIF = EMA(fast) - EMA(slow), DEA = EMA(DIF, signal), MACD bar = DIF - DEA (green columns above
 * 0, red otherwise). Trend filter: uptrend when the close is above the EMA of the trend period, downtrend when it is
 * below (green / red background). Buy when DIF crosses over DEA in an uptrend, sell when DIF crosses under DEA in a
 * downtrend; with the volume filter on, the volume must also be above 1.2 times its 20-bar SMA. Buy triangles are
 * drawn 1 bar back and the "买" labels 5 bars back; sell triangles 1 bar ahead and the "卖" labels 5 bars ahead.
 *
 * Reference: "Evil MACD Trading System (Pine Script v6)" by daves723
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import { barInterval, barTime } from '../bar-time';

export interface EvilMacdTradingSystemInputs {
  /** Fast EMA length (快线周期) */
  fastLength: number;
  /** Slow EMA length (慢线周期) */
  slowLength: number;
  /** Signal EMA length (信号线周期) */
  signalLength: number;
  /** EMA length of the trend filter (趋势过滤均线周期) */
  trendFilterPeriod: number;
  /** Volume filter (启用成交量过滤) */
  volFilter: boolean;
  /** Signal offset (信号偏移量); not used by the script */
  signalOffset: number;
}

export const defaultInputs: EvilMacdTradingSystemInputs = {
  fastLength: 14,
  slowLength: 28,
  signalLength: 8,
  trendFilterPeriod: 60,
  volFilter: true,
  signalOffset: 0.001,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: '快线周期', defval: 14, min: 1, max: 50 },
  { id: 'slowLength', type: 'int', title: '慢线周期', defval: 28, min: 1, max: 100 },
  { id: 'signalLength', type: 'int', title: '信号线周期', defval: 8, min: 1, max: 50 },
  { id: 'trendFilterPeriod', type: 'int', title: '趋势过滤均线周期', defval: 60, min: 10, max: 200 },
  { id: 'volFilter', type: 'bool', title: '启用成交量过滤', defval: true },
  { id: 'signalOffset', type: 'float', title: '信号偏移量', defval: 0.001, min: 0.0001, max: 0.01, step: 0.0001 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'DIF', color: color.blue, lineWidth: 2 },
  { id: 'plot1', title: 'DEA', color: color.red, lineWidth: 2 },
  { id: 'plot2', title: 'MACD Bar', color: color.green, lineWidth: 1, style: 'columns' },
];

/** hline(0, "0轴", color = color.gray, linestyle = hline.style_dashed) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, title: '0轴', color: color.gray, linestyle: 'dashed' },
];

export const metadata = {
  title: '邪修MACD交易系统',
  shortTitle: 'XX_MACD',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<EvilMacdTradingSystemInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const closeArr = bars.map((b) => b.close);
  const close = S(closeArr);

  const emaFast = A(ta.ema(close, cfg.fastLength));
  const emaSlow = A(ta.ema(close, cfg.slowLength));
  const dif = emaFast.map((v, i) => v - emaSlow[i]);
  const difS = S(dif);
  const deaS = ta.ema(difS, cfg.signalLength);
  const dea = A(deaS);
  const macdBar = dif.map((v, i) => v - dea[i]);

  const trendMA = A(ta.ema(close, cfg.trendFilterPeriod));
  const volume = bars.map((b) => b.volume ?? NaN);
  const volSma = A(ta.sma(S(volume), 20));

  // ta.crossover / ta.crossunder compare exactly
  const crossUp = A(ta.crossover(difS, deaS));
  const crossDn = A(ta.crossunder(difS, deaS));

  const green = String(color.new(color.green, 0));
  const red = String(color.new(color.red, 0));
  const bgUp = String(color.new(color.green, 90));
  const bgDn = String(color.new(color.red, 90));
  const interval = barInterval(bars);

  const plot0: { time: number; value: number; color: string }[] = [];
  const plot1: { time: number; value: number; color: string }[] = [];
  const plot2: { time: number; value: number; color: string }[] = [];
  const markers: MarkerData[] = [];
  const bgColors: BgColorData[] = [];
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

  for (let i = 0; i < n; i++) {
    const t = bars[i].time as number;
    const uptrend = gt(closeArr[i], trendMA[i]);
    const downtrend = lt(closeArr[i], trendMA[i]);
    // volRatio = volume / ta.sma(volume, 20); volCondition = volRatio > 1.2 (x / 0 is +-infinity, 0 / 0 na)
    const volCondition = gt(volume[i] / volSma[i], 1.2);
    let buySignal = !!crossUp[i] && uptrend;
    if (cfg.volFilter) buySignal = buySignal && volCondition;
    let sellSignal = !!crossDn[i] && downtrend;
    if (cfg.volFilter) sellSignal = sellSignal && volCondition;

    plot0.push({ time: t, value: fin(dif[i]), color: color.blue });
    plot1.push({ time: t, value: fin(dea[i]), color: color.red });
    // color = macdBar > 0 ? color.green : color.red
    plot2.push({ time: t, value: fin(macdBar[i]), color: gt(macdBar[i], 0) ? color.green : color.red });

    // plotshape(buySignal, "买入", location.belowbar, offset = -1, shape.triangleup, size.small)
    if (buySignal && i - 1 >= 0) {
      markers.push({ time: barTime(bars, i - 1, interval), position: 'belowBar', shape: 'triangleUp', color: green, size: 'small' });
    }
    // plotshape(buySignal, "买入文字", location.belowbar, offset = -5, shape.labelup, text "买", size.tiny)
    if (buySignal && i - 5 >= 0) {
      markers.push({ time: barTime(bars, i - 5, interval), position: 'belowBar', shape: 'labelUp', color: green,
        text: '买', textColor: color.white, size: 'tiny' });
    }
    // plotshape(sellSignal, "卖出", location.abovebar, offset = 1, shape.triangledown, size.small)
    if (sellSignal) {
      markers.push({ time: barTime(bars, i + 1, interval), position: 'aboveBar', shape: 'triangleDown', color: red, size: 'small' });
    }
    // plotshape(sellSignal, "卖出文字", location.abovebar, offset = 5, shape.labeldown, text "卖", size.tiny)
    if (sellSignal) {
      markers.push({ time: barTime(bars, i + 5, interval), position: 'aboveBar', shape: 'labelDown', color: red,
        text: '卖', textColor: color.white, size: 'tiny' });
    }

    // bgcolor(uptrend ? color.new(color.green, 90) : downtrend ? color.new(color.red, 90) : na)
    if (uptrend) bgColors.push({ time: t, color: bgUp });
    else if (downtrend) bgColors.push({ time: t, color: bgDn });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2 },
    hlines: [{ value: 0, options: { title: '0轴', color: color.gray, linestyle: 'dashed' } }],
    markers,
    bgColors,
  };
}

export const EvilMacdTradingSystem = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
