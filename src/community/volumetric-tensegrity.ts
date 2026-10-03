/**
 * Volumetric Tensegrity
 *
 * ZVOL: the z-score of the volume, (volume - sma(volume, maLen)) / stdev(volume, stdLen) (0 when the stdev is 0 or
 * na), times 50,000, drawn as a histogram coloured by zone (red > 2.5, orange > 1, yellow > 0, teal > -1, else blue).
 * OBVX: the spread between the OBV and its rolling volume-weighted average over `fastLen` bars (from cumulative
 * sums), normalised to -1..1 over the highest / lowest spread of `normLen` bars, smoothed by a 5-bar EMA and times
 * 50,000; green when it is at or above its value 2 bars ago, else red.
 *
 * Reference: "Volumetric Tensegrity" by TheLeadingIndicator
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Open Source | Designed by Adrian Dyer for "The Leading Indicator", Engineered by PineForge
 * Laboratory (2025)
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface VolumetricTensegrityInputs {
  /** ZVOL SMA length */
  zvolMaLen: number;
  /** ZVOL standard deviation length */
  zvolStdLen: number;
  /** OBVX rolling VWMA length */
  obvxFastLen: number;
  /** OBVX normalisation length (highest / lowest) */
  obvxNormLen: number;
}

export const defaultInputs: VolumetricTensegrityInputs = {
  zvolMaLen: 55,
  zvolStdLen: 55,
  obvxFastLen: 13,
  obvxNormLen: 55,
};

export const inputConfig: InputConfig[] = [
  { id: 'zvolMaLen', type: 'int', title: 'ZVOL MA', defval: 55, min: 2 },
  { id: 'zvolStdLen', type: 'int', title: 'ZVOL Std Deviation', defval: 55, min: 2 },
  { id: 'obvxFastLen', type: 'int', title: 'OBVX Fast VWMA', defval: 13, min: 1 },
  { id: 'obvxNormLen', type: 'int', title: 'OBVX Normalization', defval: 55, min: 5 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '🫁 ZVOL Respiration Histogram', color: color.teal, lineWidth: 1, style: 'histogram' },
  { id: 'plot1', title: '🖐️ OBVX Spread Line', color: color.green, lineWidth: 1 },
];

export const metadata = {
  title: 'Volumetric Tensegrity',
  shortTitle: 'VTense',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a != b beyond 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const ne = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) > EPS;

export function calculate(bars: Bar[], inputs: Partial<VolumetricTensegrityInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const volume = bars.map((b) => b.volume ?? NaN);

  // ZVOL
  const zvolMa = A(ta.sma(S(volume), cfg.zvolMaLen));
  const zvolStd = A(ta.stdev(S(volume), cfg.zvolStdLen));
  const zvolZScore = volume.map((v, i) => (ne(zvolStd[i], 0) ? (v - zvolMa[i]) / zvolStd[i] : 0.0));

  // OBVX: obv = ta.cum(math.sign(ta.change(close)) * volume)
  const change = A(ta.change(S(bars.map((b) => b.close))));
  const obv = A(ta.cum(S(change.map((c, i) => Math.sign(c) * volume[i]))));
  // vwma(src, len): (ta.cum(src * volume) - ta.cum(src * volume)[len]) / (ta.cum(volume) - ta.cum(volume)[len]),
  // src when the denominator is 0 (or na)
  const len = cfg.obvxFastLen;
  const cumSv = A(ta.cum(S(obv.map((o, i) => o * volume[i]))));
  const cumV = A(ta.cum(S(volume)));
  const obvxSpread = obv.map((o, i) => {
    const num = cumSv[i] - (i >= len ? cumSv[i - len] : NaN);
    const den = cumV[i] - (i >= len ? cumV[i - len] : NaN);
    const fast = ne(den, 0) ? num / den : o;
    return o - fast;
  });

  // Normalise the spread
  const obvxHigh = A(ta.highest(S(obvxSpread), cfg.obvxNormLen));
  const obvxLow = A(ta.lowest(S(obvxSpread), cfg.obvxNormLen));
  const normalized = obvxSpread.map((s, i) => {
    const range = obvxHigh[i] - obvxLow[i];
    return ne(range, 0) ? ((s - obvxLow[i]) / range) * 2 - 1 : 0;
  });
  const smoothed = A(ta.ema(S(normalized), 5));

  const plot0 = [];
  const plot1 = [];
  for (let i = 0; i < n; i++) {
    const z = zvolZScore[i];
    const zc = gt(z, 2.5) ? color.red : gt(z, 1.0) ? color.orange : gt(z, 0.0) ? color.yellow
      : gt(z, -1.0) ? color.teal : color.blue;
    const zr = z * 50000;
    plot0.push({ time: bars[i].time, value: Number.isFinite(zr) ? zr : NaN, color: zc });
    const oc = i >= 2 && ge(smoothed[i], smoothed[i - 2]) ? color.green : color.red;
    const or = smoothed[i] * 50000;
    plot1.push({ time: bars[i].time, value: Number.isFinite(or) ? or : NaN, color: oc });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1 },
  };
}

export const VolumetricTensegrity = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
