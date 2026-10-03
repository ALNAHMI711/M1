/**
 * Kalman Exponentialy Weighted Moving Average | MisinkoMaster
 *
 * A one-state Kalman filter (process noise Q, measurement noise R, start state = first source value, start
 * covariance 1) smooths the source. A Hull-like line is 2 * WMA(filtered, round(n / 2)) - WMA(filtered, n); a
 * second line blends it three times with its previous value (weight 2 / (n + 1)). A crossover of the first line
 * above the second gives the cyan colour, a crossunder the magenta colour; both lines and the fill between them keep
 * the colour until the next cross (transparent before the first cross).
 *
 * Reference: "Kalman Exponentialy Weighted Moving Average | MisinkoMaster" by MisinkoMaster
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © MisinkoMaster
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface KalmanExponentialyWeightedMovingAverageMisinkomasterInputs {
  /** Length */
  n: number;
  src: SourceType;
  /** Process noise (Q) */
  processNoise: number;
  /** Measurement noise (R) */
  measureNoise: number;
}

export const defaultInputs: KalmanExponentialyWeightedMovingAverageMisinkomasterInputs = {
  n: 45,
  src: 'close',
  processNoise: 0.0005,
  measureNoise: 0.097,
};

export const inputConfig: InputConfig[] = [
  { id: 'n', type: 'int', title: 'Length', defval: 45, min: 2, step: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'processNoise', type: 'float', title: 'Process Noise (Q)', defval: 0.0005, min: 0, step: 0.00001 },
  { id: 'measureNoise', type: 'float', title: 'Measurement Noise (R)', defval: 0.097, min: 0, step: 0.001 },
];

const NONE = String(color.rgb(0, 0, 0, 100));
const LONG = String(color.rgb(40, 215, 255, 10));
const LONG_FILL = String(color.rgb(25, 230, 255, 50));
const SHORT = String(color.rgb(225, 30, 255, 10));
const SHORT_FILL = String(color.rgb(215, 40, 255, 60));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Weighted Moving Average', color: LONG, lineWidth: 3 },
  { id: 'plot1', title: 'Exponentialy Weighted Moving Average', color: LONG, lineWidth: 3 },
];

export const metadata = {
  title: 'Kalman Exponentialy Weighted Moving Average | MisinkoMaster',
  shortTitle: 'KEWMA | MisinkoMaster',
  overlay: true,
};

export function calculate(
  bars: Bar[],
  inputs: Partial<KalmanExponentialyWeightedMovingAverageMisinkomasterInputs> = {},
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const len = cfg.n;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const src = A(getSourceSeries(bars, cfg.src));

  // a = 2 / (n + 1); n1 = math.abs(math.round(n / 2)) (n / 2 is a float in Pine v6, math.round rounds half up)
  const a = 2 / (len + 1);
  const n1 = Math.abs(Math.round(len / 2));
  const Q = cfg.processNoise;
  const R = cfg.measureNoise;

  // var float xhat = src (first bar), var float P = 1.0
  const xhatArr: number[] = new Array(n);
  let xhat = n > 0 ? src[0] : NaN;
  let P = 1.0;
  for (let i = 0; i < n; i++) {
    const xhatPrior = xhat;
    const pPrior = P + Q;
    const K = pPrior / (pPrior + R);
    xhat = xhatPrior + K * (src[i] - xhatPrior);
    P = (1 - K) * pPrior;
    xhatArr[i] = xhat;
  }

  // wma = ta.wma(xhat, n1) * 2 - ta.wma(xhat, n)
  const xs = S(xhatArr);
  const w1 = A(ta.wma(xs, n1));
  const w2 = A(ta.wma(xs, len));
  const wma = w1.map((v, i) => v * 2 - w2[i]);
  // ewma = wma * a + wma[1] * (1 - a), then ewma := ewma * a + wma[1] * (1 - a) twice
  const ewma = wma.map((w, i) => {
    const prev = i > 0 ? wma[i - 1] : NaN;
    let e = w * a + prev * (1 - a);
    e = e * a + prev * (1 - a);
    e = e * a + prev * (1 - a);
    return e;
  });

  // L = ta.crossover(wma, ewma); S = ta.crossunder(wma, ewma) (exact comparisons with the last bar where both
  // values were not na)
  const L = A(ta.crossover(S(wma), S(ewma)));
  const Sh = A(ta.crossunder(S(wma), S(ewma)));
  const col: string[] = new Array(n);
  const colT: string[] = new Array(n);
  let c = NONE;
  let cT = NONE;
  for (let i = 0; i < n; i++) {
    const long = L[i] === 1;
    const short = Sh[i] === 1;
    if (long && !short) {
      c = LONG;
      cT = LONG_FILL;
    }
    if (short) {
      c = SHORT;
      cT = SHORT_FILL;
    }
    col[i] = c;
    colT[i] = cT;
  }

  const t = (i: number) => bars[i].time;
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((_b, i) => ({ time: t(i), value: wma[i], color: col[i] })),
      plot1: bars.map((_b, i) => ({ time: t(i), value: ewma[i], color: col[i] })),
    },
    // fill(w, ew, colT)
    fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'Plots Background' }, colors: colT }],
  };
}

export const KalmanExponentialyWeightedMovingAverageMisinkomaster = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
