/**
 * Ross Cameron-Inspired Day Trading Strategy
 *
 * Buy / sell labels from three rules: a gap of at least `gapPercentage` % between the previous close and the open
 * (gap up: buy, gap down: sell); a momentum rule (RSI crossing over the oversold level with the close above the EMA:
 * buy; RSI crossing under the overbought level or the close below the EMA: sell); a mean reversion rule (RSI crossing
 * under the overbought level with the close below the SMA: buy; RSI crossing over the oversold level with the close
 * above the SMA: sell). The momentum and mean reversion signals are confirmed when the close is beyond the close of
 * the signal `confirmationPeriod` occurrences before. The EMA and the SMA are plotted, with horizontal lines at the
 * overbought / oversold levels (on the price scale, as the original script).
 *
 * Reference: "Ross Cameron-Inspired Day Trading Strategy" by manaziir
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface RossCameronInspiredDayTradingStrategyInputs {
  /** Gap percentage (%) */
  gapPercentage: number;
  rsiLength: number;
  overBought: number;
  overSold: number;
  emaLength: number;
  smaLength: number;
  /** Occurrence of the earlier signal used for the confirmation (ta.valuewhen occurrence) */
  confirmationPeriod: number;
}

export const defaultInputs: RossCameronInspiredDayTradingStrategyInputs = {
  gapPercentage: 4.0,
  rsiLength: 14,
  overBought: 70,
  overSold: 30,
  emaLength: 20,
  smaLength: 50,
  confirmationPeriod: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'gapPercentage', type: 'float', title: 'Gap Percentage', defval: 4.0 },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14 },
  { id: 'overBought', type: 'int', title: 'Over Bought', defval: 70 },
  { id: 'overSold', type: 'int', title: 'Over Sold', defval: 30 },
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 20 },
  { id: 'smaLength', type: 'int', title: 'SMA Length', defval: 50 },
  { id: 'confirmationPeriod', type: 'int', title: 'Confirmation Period', defval: 3 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'SMA', color: color.orange, lineWidth: 1 },
];

export const metadata = {
  title: 'Ross Cameron-Inspired Day Trading Strategy',
  shortTitle: 'RC_Day_Trader',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

export function calculate(
  bars: Bar[],
  inputs: Partial<RossCameronInspiredDayTradingStrategyInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const gapPercentage = cfg.gapPercentage / 100;
  const occ = cfg.confirmationPeriod;

  const closeS = Series.fromArray(bars, bars.map((b) => b.close));
  const rsi = ta.rsi(closeS, cfg.rsiLength);
  const ema = A(ta.ema(closeS, cfg.emaLength));
  const sma = A(ta.sma(closeS, cfg.smaLength));
  // ta.crossover / ta.crossunder (exact comparisons, last bar where both values were not na)
  const rsiOverOversold = A(ta.crossover(rsi, cfg.overSold));
  const rsiUnderOverbought = A(ta.crossunder(rsi, cfg.overBought));

  // ta.valuewhen(cond, close, 0) > / < ta.valuewhen(cond, close, confirmationPeriod): the calls run on the bars where
  // cond is true (right side of a lazy `and`); the closes of those bars, latest last
  const confirmed = (closes: number[], close: number, up: boolean) => {
    closes.push(close);
    const k = closes.length - 1 - occ;
    const earlier = k >= 0 && k < closes.length ? closes[k] : NaN;
    return up ? gt(close, earlier) : lt(close, earlier);
  };
  const momBuyCloses: number[] = [];
  const momSellCloses: number[] = [];
  const mrBuyCloses: number[] = [];
  const mrSellCloses: number[] = [];

  const markers: MarkerData[] = [];
  const plot0: { time: number; value: number }[] = [];
  const plot1: { time: number; value: number }[] = [];
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const t = b.time;
    const prevClose = i > 0 ? bars[i - 1].close : NaN;
    const gap = (b.open - prevClose) / prevClose;
    const gapUp = ge(gap, gapPercentage);
    const gapDown = le(gap, -gapPercentage);

    const momentumBuy = rsiOverOversold[i] === 1 && gt(b.close, ema[i]);
    const momentumBuyConfirmed = momentumBuy && confirmed(momBuyCloses, b.close, true);
    const momentumSell = rsiUnderOverbought[i] === 1 || lt(b.close, ema[i]);
    const momentumSellConfirmed = momentumSell && confirmed(momSellCloses, b.close, false);
    const meanReversionBuy = rsiUnderOverbought[i] === 1 && lt(b.close, sma[i]);
    const meanReversionBuyConfirmed = meanReversionBuy && confirmed(mrBuyCloses, b.close, false);
    const meanReversionSell = rsiOverOversold[i] === 1 && gt(b.close, sma[i]);
    const meanReversionSellConfirmed = meanReversionSell && confirmed(mrSellCloses, b.close, true);

    const longCondition = gapUp || momentumBuyConfirmed || meanReversionBuyConfirmed;
    const shortCondition = gapDown || momentumSellConfirmed || meanReversionSellConfirmed;
    // plotshape(..., location.belowbar / abovebar, shape.labelup / labeldown, text, size.small); default text colour
    if (longCondition) {
      markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'BUY', textColor: color.blue, size: 'small' });
    }
    if (shortCondition) {
      markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL', textColor: color.blue, size: 'small' });
    }
    plot0.push({ time: t, value: ema[i] });
    plot1.push({ time: t, value: sma[i] });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1 },
    hlines: [
      { value: cfg.overBought, options: { title: 'Over Bought', color: color.red, linestyle: 'dashed' } },
      { value: cfg.overSold, options: { title: 'Over Sold', color: color.green, linestyle: 'dashed' } },
    ],
    markers,
  };
}

export const RossCameronInspiredDayTradingStrategy = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
