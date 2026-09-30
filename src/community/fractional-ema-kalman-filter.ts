/**
 * Fractional EMA Kalman Filter (Kalman D7)
 *
 * Two EMAs with fractional lengths (alpha = 2 / (length + 1), above 1 for a length below 1; recursive sum seeded by 0)
 * give the measurement. Two adaptive Kalman filters (base and fast) track it: the residual to the previous state,
 * squared and divided by the squared ATR(14), gives the measurement noise R (RMA over `R` bars, floored by the current
 * residual variance times the gate multiplier) and the process noise Q (RMA over 5 bars, clamped to 0.001..10, times
 * the q multiplier). Each filter state is smoothed by a 3-bar (base) or 5-bar (fast) recursive EMA; the fill between
 * the two lines is aqua when the fast line is above the base line, red otherwise. Optional: the EMA and the EMA
 * shifted one bar to the left, with a lag shading between them.
 *
 * Reference: "Kalman D7" by et20tradeview
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © et20tradeview
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface FractionalEmaKalmanFilterInputs {
  /** Show the EMA and its one-bar-left copy */
  showPul: boolean;
  source: SourceType;
  /** Length of the first EMA (fractional) */
  factor: number;
  /** Length of the second EMA (fractional) */
  factor2: number;
  /** R lookback of the base filter */
  rRatioB: number;
  /** q multiplier of the base filter */
  qRatioB: number;
  /** R gate multiplier of the base filter */
  rGateMultB: number;
  /** R lookback of the fast filter */
  rRatioS: number;
  /** q multiplier of the fast filter */
  qRatioS: number;
  /** R gate multiplier of the fast filter */
  rGateMultS: number;
}

export const defaultInputs: FractionalEmaKalmanFilterInputs = {
  showPul: false,
  source: 'close',
  factor: 0.5,
  factor2: 0.5,
  rRatioB: 50,
  qRatioB: 0.002,
  rGateMultB: 1,
  rRatioS: 50,
  qRatioS: 0.005,
  rGateMultS: 1,
};

export const inputConfig: InputConfig[] = [
  { id: 'showPul', type: 'bool', title: 'Show EMA', defval: false },
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'factor', type: 'float', title: 'factor', defval: 0.5, min: 0.1, step: 0.1 },
  { id: 'factor2', type: 'float', title: 'factor2', defval: 0.5, min: 0.1, step: 0.1 },
  { id: 'rRatioB', type: 'int', title: 'R base', defval: 50, step: 5 },
  { id: 'qRatioB', type: 'float', title: 'q multiplier base', defval: 0.002, step: 0.001 },
  { id: 'rGateMultB', type: 'float', title: 'R Gate Multiplier base', defval: 1, step: 0.1 },
  { id: 'rRatioS', type: 'int', title: 'R fast', defval: 50, step: 5 },
  { id: 'qRatioS', type: 'float', title: 'q multiplier fast', defval: 0.005, step: 0.001 },
  { id: 'rGateMultS', type: 'float', title: 'R Gate Multiplier fast', defval: 1, step: 0.1 },
];

const EMA_COL = String(color.new(color.purple, 70));
const BASE_COL = String(color.rgb(230, 65, 195));
const FAST_COL = String(color.rgb(80, 100, 240));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Pumori', color: EMA_COL, lineWidth: 1 },
  { id: 'plot1', title: 'Pumori (offset -1)', color: EMA_COL, lineWidth: 1 },
  { id: 'plot2', title: 'Kalman Base', color: BASE_COL, lineWidth: 2 },
  { id: 'plot3', title: 'Kalman Fast', color: FAST_COL, lineWidth: 2 },
];

export const metadata = {
  title: 'Kalman D7',
  shortTitle: 'Kalman D7',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;
const nz = (x: number, y = 0) => (isNaN(x) ? y : x);
/** Pine math.max / math.min: na when an argument is na */
const max = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.max(a, b));
const min = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.min(a, b));

/** pine_ema(src, length): sum := alpha * src + (1 - alpha) * nz(sum[1]), alpha = 2 / (length + 1) */
function pineEma(src: number[], length: number): number[] {
  const alpha = 2 / (length + 1);
  const out: number[] = new Array(src.length);
  for (let i = 0; i < src.length; i++) {
    out[i] = alpha * src[i] + (1 - alpha) * nz(i > 0 ? out[i - 1] : NaN);
  }
  return out;
}

export function calculate(bars: Bar[], inputs: Partial<FractionalEmaKalmanFilterInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const qlen = 5;

  const src = A(getSourceSeries(bars, cfg.source));
  const ema1 = pineEma(src, cfg.factor);
  const ema2 = pineEma(ema1, cfg.factor2);
  const atr = A(ta.atr(bars, 14));

  /** One adaptive Kalman filter: the state on every bar */
  const kalman = (rRatio: number, qRatio: number, gateMult: number): number[] => {
    // The residual depends on the previous state: first the residual variance needs the states, so the RMAs of
    // the residual variance are computed bar by bar (same recursion as ta.rma: SMA seed on the first `length`
    // values, then alpha = 1 / length).
    const state: number[] = new Array(n);
    const resVar: number[] = new Array(n);
    let pState = NaN; // var float kf_state = na
    let pCov = 1.0; // var float p_cov = 1.0
    const rmaR = rmaStepper(rRatio);
    const rmaQ = rmaStepper(qlen);
    for (let i = 0; i < n; i++) {
      // residual = ema2 - nz(kf_state[1], ema2)
      const residual = ema2[i] - nz(i > 0 ? state[i - 1] : NaN, ema2[i]);
      const volBase = max(atr[i], 1e-6);
      resVar[i] = Math.pow(residual, 2) / Math.pow(volBase, 2);
      const rRaw = nz(rmaR(resVar[i]), 1.0);
      const qRaw = nz(rmaQ(resVar[i]), 0.1);
      // calc_kalman
      const qProcess = min(max(nz(qRaw, 0.1), 0.001), 10.0) * qRatio;
      const rDynamicFloor = resVar[i] * gateMult;
      const rAdaptive = max(nz(rRaw, 1.0), rDynamicFloor);
      const currentPCov = pCov + qProcess;
      const kGain = currentPCov / (currentPCov + rAdaptive + 1e-10);
      let nextState = nz(pState, ema2[i]);
      let nextCov = currentPCov;
      if (!isNaN(kGain)) {
        nextState = nextState + kGain * (ema2[i] - nextState);
        nextCov = (1 - kGain) * currentPCov;
      }
      pState = nextState;
      pCov = nextCov;
      state[i] = nextState;
    }
    return state;
  };
  const smoothb = pineEma(kalman(cfg.rRatioB, cfg.qRatioB, cfg.rGateMultB), 3);
  const smooths = pineEma(kalman(cfg.rRatioS, cfg.qRatioS, cfg.rGateMultS), 5);

  const t = (i: number) => bars[i].time;
  const emaPlot = (i: number) => (cfg.showPul ? ema2[i] : NaN);
  const plot0 = bars.map((_b, i) => ({ time: t(i), value: emaPlot(i), color: EMA_COL }));
  // plot(..., offset = -1): the value of bar i is drawn on bar i - 1
  const plot1 = bars.slice(1).map((_b, j) => ({ time: t(j), value: emaPlot(j + 1), color: EMA_COL }));
  const plot2 = bars.map((_b, i) => ({ time: t(i), value: smoothb[i], color: BASE_COL }));
  const plot3 = bars.map((_b, i) => ({ time: t(i), value: smooths[i], color: FAST_COL }));

  const up = String(color.new(color.aqua, 80));
  const down = String(color.new(color.red, 80));
  const fills = [
    { plot1: 'plot0', plot2: 'plot1', options: { title: 'Lag Shading', color: String(color.new('#69359C', 70)) } },
    {
      plot1: 'plot2', plot2: 'plot3', options: { title: 'Kalman fill' },
      colors: bars.map((_b, i) => (gt(smooths[i], smoothb[i]) ? up : down)),
    },
  ];

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2, plot3 },
    fills,
  };
}

/**
 * Bar-by-bar ta.rma(src, length): na until `length` non-na values, seeded by their mean (the SMA of the first full
 * window), then rma = alpha * src + (1 - alpha) * rma[1] (na on a bar with an na source).
 */
function rmaStepper(length: number): (x: number) => number {
  const alpha = 1 / length;
  const seed: number[] = [];
  let value = NaN;
  let started = false;
  return (x: number) => {
    if (!started) {
      if (!isNaN(x)) seed.push(x);
      if (seed.length === length) {
        started = true;
        value = seed.reduce((a, b) => a + b, 0) / length;
        return value;
      }
      return NaN;
    }
    if (isNaN(x)) return NaN;
    value = alpha * x + (1 - alpha) * value;
    return value;
  };
}

export const FractionalEmaKalmanFilter = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
