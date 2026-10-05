/**
 * RSI & BB Oversold Scalper with MACD Confirmation
 *
 * Setup (each filter can be turned off): the lowest Bollinger %b of the last `lookbackBB` bars is below 0, the
 * lowest RSI of the last `lookbackRSI` bars is below 30, and the Double Smoothed Stochastic (Bressert DSS) crosses
 * over its EMA signal below 20. A setup stays active for `validWindow` bars; a MACD line crossing over its signal
 * line while the setup is active gives a buy signal (a label below the bar) and ends the setup.
 *
 * Reference: "RSI & BB Oversold Scalper with MACD Confirmation" by DotGain
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © DotGain
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface RsiBbOversoldScalperWithMacdConfirmationInputs {
  useBB: boolean;
  useRSI: boolean;
  useDSS: boolean;
  lookbackBB: number;
  lookbackRSI: number;
  validWindow: number;
  rsiLen: number;
  bbLen: number;
  bbMult: number;
  dssLen: number;
  dssSmooth: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
}

export const defaultInputs: RsiBbOversoldScalperWithMacdConfirmationInputs = {
  useBB: true,
  useRSI: true,
  useDSS: true,
  lookbackBB: 20,
  lookbackRSI: 10,
  validWindow: 15,
  rsiLen: 14,
  bbLen: 20,
  bbMult: 2.0,
  dssLen: 10,
  dssSmooth: 5,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'useBB', type: 'bool', title: '1. BB%b Filter active?', defval: true, group: 'Filter' },
  { id: 'useRSI', type: 'bool', title: '2. RSI Filter active?', defval: true, group: 'Filter' },
  { id: 'useDSS', type: 'bool', title: '3. DSS Crossover filter active?', defval: true, group: 'Filter' },
  { id: 'lookbackBB', type: 'int', title: 'BB%b Lookback (candles)', defval: 20, group: 'Lookback Periods' },
  { id: 'lookbackRSI', type: 'int', title: 'RSI Lookback (candles)', defval: 10, group: 'Lookback Periods' },
  { id: 'validWindow', type: 'int', title: 'MACD Lookback(candles)', defval: 15, group: 'Lookback Periods' },
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, group: 'Relative Strength Index' },
  { id: 'bbLen', type: 'int', title: 'BB Length', defval: 20, group: 'Bollinger Bands' },
  { id: 'bbMult', type: 'float', title: 'BB StdDev', defval: 2.0, group: 'Bollinger Bands' },
  { id: 'dssLen', type: 'int', title: 'DSS P-Period', defval: 10, group: 'Double Smoothed Stochastic' },
  { id: 'dssSmooth', type: 'int', title: 'DSS EMA-Smoothing', defval: 5, group: 'Double Smoothed Stochastic' },
  { id: 'macdFast', type: 'int', title: 'MACD Fast', defval: 12, group: 'Moving Average Convergence Divergence' },
  { id: 'macdSlow', type: 'int', title: 'MACD Slow', defval: 26, group: 'Moving Average Convergence Divergence' },
  { id: 'macdSignal', type: 'int', title: 'MACD Signal', defval: 9, group: 'Moving Average Convergence Divergence' },
];

// Only markers (plotshape): no line plots
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'RSI & BB Oversold Scalper with MACD Confirmation',
  shortTitle: 'Oversold Scalper',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<RsiBbOversoldScalperWithMacdConfirmationInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (arr: number[]) => Series.fromArray(bars, arr);
  const closeArr = bars.map((b) => b.close);
  const close = S(closeArr);

  // [_, upper_b, lower_b] = ta.bb(close, bbLen, bbMult): [basis, upper, lower]
  // (the first ta.bb call of the Pine script gives the same values and its result is not used)
  const [, bbUpper, bbLower] = ta.bb(close, cfg.bbLen, cfg.bbMult);
  const upperB = A(bbUpper);
  const lowerB = A(bbLower);
  // bbPercentB = (close - lower_b) / (upper_b - lower_b): plain division (x / 0 is +-infinity, 0 / 0 is na)
  const bbPercentB = closeArr.map((c, i) => (c - lowerB[i]) / (upperB[i] - lowerB[i]));

  const rsiVal = A(ta.rsi(close, cfg.rsiLen));

  // calc_dss(dssLen, dssSmooth): called on every bar
  const high_ = A(ta.highest(S(bars.map((b) => b.high)), cfg.dssLen));
  const low_ = A(ta.lowest(S(bars.map((b) => b.low)), cfg.dssLen));
  const frac = closeArr.map((c, i) => {
    const delta = high_[i] - low_[i];
    return gt(delta, 0) ? ((c - low_[i]) / delta) * 100 : 0;
  });
  const ema1S = ta.ema(S(frac), cfg.dssSmooth);
  const ema1 = A(ema1S);
  const high_2 = A(ta.highest(ema1S, cfg.dssLen));
  const low_2 = A(ta.lowest(ema1S, cfg.dssLen));
  const frac2 = ema1.map((e, i) => {
    const delta2 = high_2[i] - low_2[i];
    return gt(delta2, 0) ? ((e - low_2[i]) / delta2) * 100 : 0;
  });
  const dssLineS = ta.ema(S(frac2), cfg.dssSmooth);
  const dssLine = A(dssLineS);
  const dssSigS = ta.ema(dssLineS, cfg.dssSmooth);

  const [macdLineS, signalLineS] = ta.macd(close, cfg.macdFast, cfg.macdSlow, cfg.macdSignal);

  const lowestBB = A(ta.lowest(S(bbPercentB), cfg.lookbackBB));
  const lowestRSI = A(ta.lowest(S(rsiVal), cfg.lookbackRSI));
  const dssCross = A(ta.crossover(dssLineS, dssSigS));
  const macdBullishCross = A(ta.crossover(macdLineS, signalLineS));

  const markers: MarkerData[] = [];
  let setupIsActive = false;
  let barsSinceSetup = 0;
  for (let i = 0; i < n; i++) {
    const condBB = lt(lowestBB[i], 0);
    const condRSI = lt(lowestRSI[i], 30);
    const condDSS = dssCross[i] === 1 && lt(dssLine[i], 20);
    const setupTrigger = (cfg.useBB ? condBB : true) && (cfg.useRSI ? condRSI : true) && (cfg.useDSS ? condDSS : true);

    if (setupTrigger) {
      setupIsActive = true;
      barsSinceSetup = 0;
    }
    if (setupIsActive) barsSinceSetup = barsSinceSetup + 1;
    if (barsSinceSetup > cfg.validWindow) setupIsActive = false;

    const buySignal = setupIsActive && macdBullishCross[i] === 1;
    if (buySignal) {
      setupIsActive = false;
      barsSinceSetup = 0;
      // plotshape(buySignal, 'Buy Signal', shape.labelup, location.belowbar, color.new(color.lime, 60), size.small)
      markers.push({
        time: bars[i].time,
        position: 'belowBar',
        shape: 'labelUp',
        color: String(color.new(color.lime, 60)),
        size: 'small',
      });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
  };
}

export const RsiBbOversoldScalperWithMacdConfirmation = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
