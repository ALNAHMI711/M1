/**
 * Trading Activity Index
 *
 * Trading activity = log of the average dollar volume (close * volume) over the formation window. The line colour
 * goes from light blue to orange-red with the position of the value between its lowest and highest value over the
 * history window. Four quintile bands (20th, 40th, 60th and 80th percentiles of the activity over the history
 * window, linear interpolation) are drawn in shades from light blue to deep blue.
 *
 * Reference: "Trading Activity Index (Zeiierman)" by Zeiierman
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, math, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface TradingActivityIndexInputs {
  /** Formation window (bars) for averaging dollar volume before taking the log */
  lenForm: number;
  /** History window (bars) used to compute rolling percentiles and bands */
  lenHist: number;
}

export const defaultInputs: TradingActivityIndexInputs = {
  lenForm: 20,
  lenHist: 252,
};

export const inputConfig: InputConfig[] = [
  { id: 'lenForm', type: 'int', title: 'Formation Window (bars)', defval: 20, min: 2, step: 1 },
  { id: 'lenHist', type: 'int', title: 'History Window (bars)', defval: 252, min: 50, step: 5 },
];

/** gradientColor / blueGradient of the script: linear blend of two RGB colours, channels rounded */
function blend(v: number, from: [number, number, number], to: [number, number, number]): string {
  const [r1, g1, b1] = from;
  const [r2, g2, b2] = to;
  const r = r1 + (r2 - r1) * v;
  const g = g1 + (g2 - g1) * v;
  const b = b1 + (b2 - b1) * v;
  return String(color.rgb(math.round(r), math.round(g), math.round(b)));
}
const LIGHT_BLUE: [number, number, number] = [173, 216, 230];
const ORANGE_RED: [number, number, number] = [255, 69, 0];
const DEEP_BLUE: [number, number, number] = [0, 0, 255];
const gradientColor = (v: number) => blend(v, LIGHT_BLUE, ORANGE_RED);
const blueGradient = (v: number) => blend(v, LIGHT_BLUE, DEEP_BLUE);

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trading Activity', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'P20', color: blueGradient(0.2), lineWidth: 1 },
  { id: 'plot2', title: 'P40', color: blueGradient(0.4), lineWidth: 1 },
  { id: 'plot3', title: 'P60', color: blueGradient(0.6), lineWidth: 1 },
  { id: 'plot4', title: 'P80', color: blueGradient(0.8), lineWidth: 1 },
];

export const metadata = {
  title: 'Trading Activity Index (Zeiierman)',
  shortTitle: 'Trading Activity Index',
  overlay: false,
};

/** Pine float equality: |a - b| <= 1e-10 (na compares false) */
const eq = (a: number, b: number) => Math.abs(a - b) <= 1e-10;

export function calculate(
  bars: Bar[],
  inputs: Partial<TradingActivityIndexInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const { lenForm, lenHist } = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  // dlrVol = close * volume; dlrVolAvg = ta.sma(dlrVol, len_form); vscale = math.log(math.max(dlrVolAvg, 1e-10))
  const dlrVol = bars.map((b) => b.close * (b.volume ?? NaN));
  const dlrVolAvg = A(ta.sma(S(dlrVol), lenForm));
  const vscale = dlrVolAvg.map((v) => (isNaN(v) ? NaN : Math.log(Math.max(v, 1e-10))));

  // Rolling percentiles of vscale over len_hist
  const vs = S(vscale);
  const p20 = A(ta.percentile_linear_interpolation(vs, lenHist, 20));
  const p40 = A(ta.percentile_linear_interpolation(vs, lenHist, 40));
  const p60 = A(ta.percentile_linear_interpolation(vs, lenHist, 60));
  const p80 = A(ta.percentile_linear_interpolation(vs, lenHist, 80));

  // rank01 = vMax == vMin ? 0.5 : math.max(0.0, math.min(1.0, (vscale - vMin) / (vMax - vMin))) (na when a value is na)
  const vMin = A(ta.lowest(vs, lenHist));
  const vMax = A(ta.highest(vs, lenHist));
  const rank01 = vscale.map((v, i) => {
    if (eq(vMax[i], vMin[i])) return 0.5;
    const r = (v - vMin[i]) / (vMax[i] - vMin[i]);
    return isNaN(r) ? NaN : Math.max(0, Math.min(1, r));
  });

  const line = (vals: number[], c: string) => bars.map((b, i) => ({ time: b.time, value: vals[i], color: c }));
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      // plot(vscale, "Trading Activity", color = gradientColor(rank01), linewidth = 2)
      plot0: bars.map((b, i) => ({ time: b.time, value: vscale[i], color: gradientColor(rank01[i]) })),
      // plot(pXX, color = blueGradient(0.2 / 0.4 / 0.6 / 0.8))
      plot1: line(p20, blueGradient(0.2)),
      plot2: line(p40, blueGradient(0.4)),
      plot3: line(p60, blueGradient(0.6)),
      plot4: line(p80, blueGradient(0.8)),
    },
    markers: [],
  };
}

export const TradingActivityIndex = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
