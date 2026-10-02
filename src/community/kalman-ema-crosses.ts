/**
 * Kalman Ema Crosses - [JTCAPITAL]
 *
 * A one-state Kalman filter (process noise added to the error, gain = error / (error + measurement noise)) smooths the
 * source; two EMAs of the filtered price are filtered again with Kalman filters. The script has two filter states:
 * the price filter shares its state with the EMA 1 filter (option 1) or with the EMA 2 filter (option 2), and a
 * state that becomes na is started again from the next value. The trend is 1 after a crossover of the EMA 1 line
 * above the EMA 2 line, -1 after a crossover below; both lines and the fill between them take the trend colour.
 *
 * Reference: "Kalman Ema Crosses - [JTCAPITAL]" by JTCapitalNL
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © JTCapitalNL. Credits for the kalman function goes to @Backquant
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface KalmanEmaCrossesInputs {
  src: SourceType;
  ema1len: number;
  ema2len: number;
  /** Process noise */
  proc: number;
  /** Measurement noise */
  measure: number;
  /** Price Kalman filter on the state of EMA 1 (1) or EMA 2 (2); Pine options [1, 2] */
  kalmanusage: number;
}

export const defaultInputs: KalmanEmaCrossesInputs = {
  src: 'close',
  ema1len: 15,
  ema2len: 25,
  proc: 50,
  measure: 10.0,
  kalmanusage: 1,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'ema1len', type: 'int', title: 'EMA 1 Length', defval: 15 },
  { id: 'ema2len', type: 'int', title: 'EMA 2 Length', defval: 25 },
  { id: 'proc', type: 'float', title: 'Process Noise', defval: 50, step: 0.01 },
  { id: 'measure', type: 'float', title: 'Measurement Noise', defval: 10.0 },
  { id: 'kalmanusage', type: 'int', title: 'Price kalman on EMA 1 or 2', defval: 1, min: 1, max: 2 },
];

const BULL = String(color.rgb(49, 133, 228));
const BEAR = String(color.rgb(132, 3, 158));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA 1 Kalman', color: BULL, lineWidth: 2 },
  { id: 'plot1', title: 'EMA 2 Kalman', color: BULL, lineWidth: 2 },
];

export const metadata = {
  title: 'Kalman Ema Crosses - [JTCAPITAL]',
  shortTitle: 'Kalman Ema Crosses - [JTCAPITAL]',
  overlay: true,
};

/** One Kalman filter state (Pine `var float[] state / error` with N = 1) */
interface KalmanState {
  state: number;
  error: number;
}

/** f_init: start the state from the value when it is na (error 1.0) */
function kalmanInit(k: KalmanState, source: number): void {
  if (isNaN(k.state)) {
    k.state = source;
    k.error = 1.0;
  }
}

/** f_kalman: one prediction / update step; returns the new state (na when the state or the source is na) */
function kalmanStep(k: KalmanState, source: number, proc: number, measure: number): number {
  const predstate = k.state;
  const prederror = k.error + proc;
  const kg = prederror / (prederror + measure);
  k.state = predstate + kg * (source - predstate);
  k.error = (1 - kg) * prederror;
  return k.state;
}

/**
 * One `ta.ema(x, len)` call fed bar by bar (the same recursion as oakscriptjs ta.ema: the SMA of the first `len`
 * finite values as seed, then (x - ema) * 2 / (len + 1) + ema; an na value gives na on its bar and the next bar
 * continues from the last value). Needed because the EMA input of the next bar depends on this bar's EMA (shared
 * Kalman state).
 */
function emaStepper(length: number): (x: number) => number {
  const len = Math.floor(length);
  const mult = 2 / (len + 1);
  let count = 0;
  let sum = 0;
  let value = NaN;
  return (x: number) => {
    if (!Number.isFinite(x)) return NaN;
    if (count < len) {
      sum += x;
      count++;
      if (count < len) return NaN;
      value = sum / len;
      return value;
    }
    value = (x - value) * mult + value;
    return value;
  };
}

export function calculate(bars: Bar[], inputs: Partial<KalmanEmaCrossesInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const src = A(getSourceSeries(bars, cfg.src));
  const { proc, measure, kalmanusage } = cfg;

  // var float[] state = array.new_float(1, na), error = array.new_float(1, 100.0) (and state2 / error2)
  const k1: KalmanState = { state: NaN, error: 100.0 };
  const k2: KalmanState = { state: NaN, error: 100.0 };
  const ema1Step = emaStepper(cfg.ema1len);
  const ema2Step = emaStepper(cfg.ema2len);

  const ema1kalman: number[] = new Array(n);
  const ema2kalman: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (kalmanusage === 1) kalmanInit(k1, src[i]);
    if (kalmanusage === 2) kalmanInit(k2, src[i]);
    // pricekalman = kalmanusage == 1 ? f_kalman(src) : kalmanusage == 2 ? f_kalman2(src) : na
    const pricekalman = kalmanusage === 1 ? kalmanStep(k1, src[i], proc, measure)
      : kalmanusage === 2 ? kalmanStep(k2, src[i], proc, measure) : NaN;
    const ema1 = ema1Step(pricekalman);
    const ema2 = ema2Step(pricekalman);
    // f_init(ema1); f_init2(ema2); ema1kalman = f_kalman(ema1); ema2kalman = f_kalman2(ema2)
    kalmanInit(k1, ema1);
    kalmanInit(k2, ema2);
    ema1kalman[i] = kalmanStep(k1, ema1, proc, measure);
    ema2kalman[i] = kalmanStep(k2, ema2, proc, measure);
  }

  // var trend = 0; ta.crossover(ema1kalman, ema2kalman) -> 1; ta.crossover(ema2kalman, ema1kalman) -> -1
  // (exact comparisons with the last bar where both values were not na)
  const S1 = Series.fromArray(bars, ema1kalman);
  const S2 = Series.fromArray(bars, ema2kalman);
  const up = A(ta.crossover(S1, S2));
  const down = A(ta.crossover(S2, S1));
  const trend: number[] = new Array(n);
  let tr = 0;
  for (let i = 0; i < n; i++) {
    if (up[i] === 1) tr = 1;
    if (down[i] === 1) tr = -1;
    trend[i] = tr;
  }

  // color = trend > 0 ? BullColor : trend < 0 ? Bearcolor : color.gray
  const lineColor = (i: number) => (trend[i] > 0 ? BULL : trend[i] < 0 ? BEAR : color.gray);
  // fill color = trend > 0 ? color.rgb(49, 133, 228, 30) : trend < 0 ? color.rgb(132, 3, 158, 30) : color.gray
  const bullFill = String(color.rgb(49, 133, 228, 30));
  const bearFill = String(color.rgb(132, 3, 158, 30));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      // plot1 = plot(ema1kalman, color = ..., linewidth = 2)
      plot0: bars.map((b, i) => ({ time: b.time, value: ema1kalman[i], color: lineColor(i) })),
      // plot2 = plot(ema2kalman, color = ..., linewidth = 2)
      plot1: bars.map((b, i) => ({ time: b.time, value: ema2kalman[i], color: lineColor(i) })),
    },
    fills: [
      { plot1: 'plot0', plot2: 'plot1', options: { title: 'Plots Background' },
        colors: trend.map((t) => (t > 0 ? bullFill : t < 0 ? bearFill : color.gray)) },
    ],
  };
}

export const KalmanEmaCrosses = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
