/**
 * EMA/RMA Clouds
 *
 * EMAs and RMAs of the high and the low over `period` bars. Single cloud: the two EMAs with a fill, lime when both
 * EMAs rise, red when both fall, else grey. Double cloud (has priority over the single cloud): the EMA high / RMA high
 * pair and the EMA low / RMA low pair, each with a fill; bullish when both EMAs are above their RMAs, bearish when
 * both are below, else grey.
 *
 * Reference: "EMA/RMA clouds by Alpachino" by Alpachino97
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Alpachino97
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface EmaRmaCloudsInputs {
  /** Length of the EMAs and RMAs */
  period: number;
  /** Show the single cloud (EMA high / EMA low) */
  singleCloud: boolean;
  /** Show the double cloud (EMA / RMA of the high and of the low); has priority over the single cloud */
  doubleCloud: boolean;
}

export const defaultInputs: EmaRmaCloudsInputs = {
  period: 50,
  singleCloud: true,
  doubleCloud: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'period', type: 'int', title: 'Ma length', defval: 50 },
  { id: 'singleCloud', type: 'bool', title: 'Single cloud', defval: true },
  { id: 'doubleCloud', type: 'bool', title: 'Double cloud', defval: false },
];

const NEUTRAL = String(color.new(color.gray, 90));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA High Single', color: NEUTRAL, lineWidth: 1 },
  { id: 'plot1', title: 'EMA Low Single', color: NEUTRAL, lineWidth: 1 },
  { id: 'plot2', title: 'EMA High Double', color: NEUTRAL, lineWidth: 1 },
  { id: 'plot3', title: 'RMA High Double', color: NEUTRAL, lineWidth: 1 },
  { id: 'plot4', title: 'EMA Low Double', color: NEUTRAL, lineWidth: 1 },
  { id: 'plot5', title: 'RMA Low Double', color: NEUTRAL, lineWidth: 1 },
];

export const metadata = {
  title: 'EMA/RMA clouds by Alpachino',
  shortTitle: 'EMA/RMA clouds by Alpachino',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(bars: Bar[], inputs: Partial<EmaRmaCloudsInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const high = Series.fromArray(bars, bars.map((b) => b.high));
  const low = Series.fromArray(bars, bars.map((b) => b.low));

  const emaHigh = A(ta.ema(high, cfg.period));
  const emaLow = A(ta.ema(low, cfg.period));
  const rmaHigh = A(ta.rma(high, cfg.period));
  const rmaLow = A(ta.rma(low, cfg.period));

  const activeDouble = cfg.doubleCloud;
  const activeSingle = cfg.singleCloud && !cfg.doubleCloud;

  const bullishHigh = String(color.new(color.lime, 70));
  const bullishLow = String(color.new(color.green, 70));
  const bearishHigh = String(color.new(color.red, 70));
  const bearishLow = String(color.new(color.maroon, 70));

  const single: string[] = new Array(n);
  const doubleHigh: string[] = new Array(n);
  const doubleLow: string[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const prevHigh = i > 0 ? emaHigh[i - 1] : NaN;
    const prevLow = i > 0 ? emaLow[i - 1] : NaN;
    const bullishSingle = gt(emaHigh[i], prevHigh) && gt(emaLow[i], prevLow);
    const bearishSingle = lt(emaHigh[i], prevHigh) && lt(emaLow[i], prevLow);
    single[i] = bullishSingle ? bullishHigh : bearishSingle ? bearishHigh : NEUTRAL;
    const bullishDouble = gt(emaHigh[i], rmaHigh[i]) && gt(emaLow[i], rmaLow[i]);
    const bearishDouble = lt(emaHigh[i], rmaHigh[i]) && lt(emaLow[i], rmaLow[i]);
    doubleHigh[i] = bullishDouble ? bullishHigh : bearishDouble ? bearishHigh : NEUTRAL;
    doubleLow[i] = bullishDouble ? bullishLow : bearishDouble ? bearishLow : NEUTRAL;
  }

  const line = (on: boolean, values: number[], colors: string[]) =>
    bars.map((b, i) => ({ time: b.time, value: on ? values[i] : NaN, color: colors[i] }));
  const fillColors = (on: boolean, colors: string[]) => colors.map((c) => (on ? c : 'transparent'));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: line(activeSingle, emaHigh, single),
      plot1: line(activeSingle, emaLow, single),
      plot2: line(activeDouble, emaHigh, doubleHigh),
      plot3: line(activeDouble, rmaHigh, doubleHigh),
      plot4: line(activeDouble, emaLow, doubleLow),
      plot5: line(activeDouble, rmaLow, doubleLow),
    },
    fills: [
      { plot1: 'plot0', plot2: 'plot1', options: { title: 'Single Cloud' }, colors: fillColors(activeSingle, single) },
      { plot1: 'plot2', plot2: 'plot3', options: { title: 'Double Cloud High' }, colors: fillColors(activeDouble, doubleHigh) },
      { plot1: 'plot4', plot2: 'plot5', options: { title: 'Double Cloud Low' }, colors: fillColors(activeDouble, doubleLow) },
    ],
  };
}

export const EmaRmaClouds = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
