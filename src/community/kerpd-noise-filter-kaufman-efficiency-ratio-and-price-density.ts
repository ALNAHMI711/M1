/**
 * KERPD Noise Filter
 *
 * Merges two noise measures over `length` bars, both scaled by 100: the Kaufman efficiency ratio
 * |close - close[length]| / sum(|close - close[1]|), and the inverted price density
 * (highest high - lowest low) / sum(high - low). The merge is their average. It is drawn aqua when it is at or
 * above the noise threshold (quiet) and blue when it is at or below it (loud), with a tape below zero (0 to -3)
 * filled in the same colours. Two area plots show a background noise baseline (efficiency * baseline) and a
 * buoyancy level ((100 - efficiency) * calibration).
 *
 * Reference: "KERPD Noise Filter - Kaufman Efficiency Ratio and Price Density" by SensitiveSuit
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface KERPDNoiseFilterInputs {
  /** Length of the efficiency ratio and of the price density */
  length: number;
  /** Noise threshold (%) */
  threshold: number;
  /** Background noise baseline (decimal %) */
  baseline: number;
  /** Background noise buoyancy calibration (decimal %) */
  calibration: number;
}

export const defaultInputs: KERPDNoiseFilterInputs = {
  length: 20,
  threshold: 35,
  baseline: 0.35,
  calibration: 0.35,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20 },
  { id: 'threshold', type: 'int', title: 'Noise Threshold %', defval: 35 },
  { id: 'baseline', type: 'float', title: 'Background Noise Baseline Decimal %', defval: 0.35, step: 0.025 },
  { id: 'calibration', type: 'float', title: 'Background Noise Bouyancy Calibration Decimal %', defval: 0.35 },
];

const AQUA = String(color.new(color.aqua, 0));
const AQUA_NONE = String(color.new(color.aqua, 100));
const BLUE = String(color.new(color.blue, 0));
const BLUE_NONE = String(color.new(color.blue, 100));
const BASELINE_COL = String(color.new(color.white, 50));
const BUOYANCY_COL = String(color.new(color.teal, 90));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'KERPD Noise Filter Quiet', color: AQUA, lineWidth: 2 },
  { id: 'plot1', title: 'KERPD Noise Filter Loud', color: BLUE, lineWidth: 1 },
  { id: 'plot2', title: 'KERPD Background Noise Baseline %', color: BASELINE_COL, lineWidth: 1, style: 'area' },
  { id: 'plot3', title: 'KERPD Background Noise Bouyancy %', color: BUOYANCY_COL, lineWidth: 1, style: 'area' },
  { id: 'plot4', title: 'KERPD Tape Top Line', color: color.blue, lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'KERPD Bottom Line', color: color.blue, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'KERPD Noise Filter',
  shortTitle: 'KERPD Noise Filter',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(bars: Bar[], inputs: Partial<KERPDNoiseFilterInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, threshold, baseline, calibration } = cfg;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const close = (i: number) => (i >= 0 ? bars[i].close : NaN);
  const high = (i: number) => (i >= 0 ? bars[i].high : NaN);
  const low = (i: number) => (i >= 0 ? bars[i].low : NaN);

  // denoPD = ta.highest(high, length) - ta.lowest(low, length)
  const hh = A(ta.highest(S(bars.map((b) => b.high)), length));
  const ll = A(ta.lowest(S(bars.map((b) => b.low)), length));

  const kerNorm: number[] = new Array(n);
  const merge: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    // KER(close, length, false): er = math.abs(close - close[length]) / sum(math.abs(close[k] - close[k + 1]))
    const a = Math.abs(close(i) - close(i - length));
    let b = 0.0;
    for (let k = 0; k <= length - 1; k++) b = b + Math.abs(close(i - k) - close(i - k - 1));
    const er = a / b;
    // normresultkauf = (resultkauf - 0) / (100 - 0) * 100 * 100
    const normKer = ((er - 0) / (100 - 0)) * 100 * 100;
    // numerPD := numerPD + high[k] - low[k]
    let numerPD = 0.0;
    for (let k = 0; k <= length - 1; k++) numerPD = numerPD + high(i - k) - low(i - k);
    const densoPD = hh[i] - ll[i];
    const resultPD = numerPD / densoPD;
    const invertedPD = 1 / resultPD;
    const normPD = ((invertedPD - 0) / (100 - 0)) * 100 * 100;
    kerNorm[i] = normKer;
    merge[i] = (normKer + normPD) / 2;
  }

  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const t = (i: number) => bars[i].time;

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      // plot(KERPDmerge, color = KERPDthreshold <= KERPDmerge ? color.new(color.aqua, 0) : color.new(color.aqua, 100))
      plot0: bars.map((_b, i) => ({ time: t(i), value: fin(merge[i]), color: le(threshold, merge[i]) ? AQUA : AQUA_NONE })),
      // plot(KERPDmerge, color = KERPDthreshold >= KERPDmerge ? color.new(color.blue, 0) : color.new(color.blue, 100))
      plot1: bars.map((_b, i) => ({ time: t(i), value: fin(merge[i]), color: ge(threshold, merge[i]) ? BLUE : BLUE_NONE })),
      // horzline = normresultkauf * KERPDdybaseline (style_area)
      plot2: bars.map((_b, i) => ({ time: t(i), value: fin(kerNorm[i] * baseline), color: BASELINE_COL })),
      // horzlinea = (100 - normresultkauf) * KERPDdycal (style_area)
      plot3: bars.map((_b, i) => ({ time: t(i), value: fin((100 - kerNorm[i]) * calibration), color: BUOYANCY_COL })),
      // KERPDtop = plot(0, display = display.none), KERPDbtm = plot(-3, display = display.none)
      plot4: bars.map((_b, i) => ({ time: t(i), value: 0 })),
      plot5: bars.map((_b, i) => ({ time: t(i), value: -3 })),
    },
    // fill(KERPDtop, KERPDbtm, title = 'KERPD Tape', color = KERPDmerge >= KERPDthreshold ? aqua
    //   : KERPDmerge < KERPDthreshold ? blue : na)
    fills: [
      {
        plot1: 'plot4',
        plot2: 'plot5',
        colors: merge.map((m) => (ge(m, threshold) ? AQUA : lt(m, threshold) ? BLUE : 'transparent')),
      },
    ],
  };
}

export const KERPDNoiseFilter = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
