/**
 * Gaussian Acceleration Array
 *
 * For a WMA of the high, of the low and of hl2 over the sample period: velocity = change of the signed logarithm
 * (sign(x) * log(|x| + 1)) of the EMA (smoothing length) of the WMA; acceleration = change of the signed logarithm
 * of the ALMA (sample period, offset 0.85, sigma 6) of the velocity. This is done for five periods (period,
 * period -+ variance, period -+ 2 * variance; the last two are drawn only with "Display Exponential Array"). The hl2
 * line is green when its velocity is positive, red otherwise; the zone between the high and the low accelerations is
 * filled green when the hl2 acceleration rises, red otherwise. The indicator can be inverted.
 *
 * Reference: "Gaussian Acceleration Array" by NantzOS
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © NantzOS
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface GaussianAccelerationArrayInputs {
  /** Sample period (WMA and ALMA length) */
  period: number;
  /** EMA length of the velocity source */
  smoothing: number;
  /** Period step of the squeezed / stretched arrays */
  aVar: number;
  /** Draw the double squeezed / double stretched arrays */
  displayExpArray: boolean;
  /** Invert the accelerations */
  invertIndicator: boolean;
  colorBear: string;
  colorBull: string;
  colorBearBG: string;
  colorBullBG: string;
}

export const defaultInputs: GaussianAccelerationArrayInputs = {
  period: 26,
  smoothing: 9,
  aVar: 3,
  displayExpArray: false,
  invertIndicator: false,
  colorBear: 'rgb(238, 30, 7)',
  colorBull: 'rgb(98, 255, 41)',
  colorBearBG: 'rgba(238, 30, 7, 0.2)',
  colorBullBG: 'rgba(98, 255, 41, 0.2)',
};

export const inputConfig: InputConfig[] = [
  { id: 'period', type: 'int', title: 'Sample Period', defval: 26 },
  { id: 'smoothing', type: 'int', title: 'Smoothing Function', defval: 9 },
  { id: 'aVar', type: 'int', title: 'Array Variance', defval: 3 },
  { id: 'displayExpArray', type: 'bool', title: 'Display Exponential Array', defval: false },
  { id: 'invertIndicator', type: 'bool', title: 'Invert Indicator', defval: false },
  { id: 'colorBear', type: 'color', title: 'Negative Velocity', defval: 'rgb(238, 30, 7)' },
  { id: 'colorBull', type: 'color', title: 'Positive Velocity', defval: 'rgb(98, 255, 41)' },
  { id: 'colorBearBG', type: 'color', title: 'Decreasing Acceleration', defval: 'rgba(238, 30, 7, 0.2)' },
  { id: 'colorBullBG', type: 'color', title: 'Increasing Acceleration', defval: 'rgba(98, 255, 41, 0.2)' },
];

// One group per period: the hl2 line, then the high and the low lines of the fill (display.none in Pine).
// The double squeezed / stretched line and fill have display = displayExpArray ? display.all : display.none:
// PlotConfig `visible` = the input id, fill colours transparent when the input is off.
const GROUPS = ['Primary', 'Squeezed', 'Stretched', 'Double Squeezed', 'Double Stretched'];
const LINE_TITLES = ['Prime Acceleration', 'Squeezed Acceleration', 'Stretched Acceleration',
  'Double Squeezed Acceleration', 'Double Stretched Acceleration'];

export const plotConfig: PlotConfig[] = GROUPS.flatMap((g, k) => [
  {
    id: `plot${3 * k}`, title: LINE_TITLES[k], color: 'rgb(98, 255, 41)', lineWidth: 1,
    ...(k >= 3 ? { visible: 'displayExpArray' } : {}),
  },
  { id: `plot${3 * k + 1}`, title: `${g} High Acceleration`, color: 'rgb(98, 255, 41)', lineWidth: 1, display: 'none' as const },
  { id: `plot${3 * k + 2}`, title: `${g} Low Acceleration`, color: 'rgb(98, 255, 41)', lineWidth: 1, display: 'none' as const },
]);

export const metadata = {
  title: 'Gaussian Acceleration Array',
  shortTitle: 'ACC-L ',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number; color?: string };

export function calculate(bars: Bar[], inputs: Partial<GaussianAccelerationArrayInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const high = S(bars.map((b) => b.high));
  const low = S(bars.map((b) => b.low));
  const hl2 = S(bars.map((b) => (b.high + b.low) / 2));

  // logarithmic(src) = math.sign(src) * math.log(math.abs(src) + 1)
  const logarithmic = (x: number) => (isNaN(x) ? NaN : Math.sign(x) * Math.log(Math.abs(x) + 1));
  // calc_acceleration(src, period, smoothing): [acc, vel]
  const accel = (src: number[], len: number) => {
    const velSource = A(ta.ema(S(src), cfg.smoothing));
    const vel = velSource.map((v, i) => (i > 0 ? logarithmic(v) - logarithmic(velSource[i - 1]) : NaN));
    const accSource = A(ta.alma(S(vel), len, 0.85, 6));
    const acc = accSource.map((v, i) => (i > 0 ? logarithmic(v) - logarithmic(accSource[i - 1]) : NaN));
    return { acc, vel };
  };
  const sign = cfg.invertIndicator ? -1 : 1;
  const bullBg = cfg.colorBullBG;
  const bearBg = cfg.colorBearBG;

  const periods = [cfg.period, cfg.period - cfg.aVar, cfg.period + cfg.aVar,
    cfg.period - 2 * cfg.aVar, cfg.period + 2 * cfg.aVar];
  const plots: Record<string, Point[]> = {};
  const fills: { plot1: string; plot2: string; colors: string[] }[] = [];
  periods.forEach((len, k) => {
    const h = accel(A(ta.wma(high, len)), len);
    const l = accel(A(ta.wma(low, len)), len);
    const m = accel(A(ta.wma(hl2, len)), len);
    // Inversion: x := invertIndicator ? -x : x
    const hAcc = h.acc.map((v) => sign * v);
    const lAcc = l.acc.map((v) => sign * v);
    const mAcc = m.acc.map((v) => sign * v);
    // get_colors(vel, acc, acc[1], ...): acc_color = vel > 0 ? bull : bear; acc_bg = acc > acc[1] ? bullBG : bearBG
    const lineColor = m.vel.map((v) => (gt(v, 0) ? cfg.colorBull : cfg.colorBear));
    const shown = k < 3 || cfg.displayExpArray;
    const bg = mAcc.map((v, i) => (!shown ? 'transparent' : i > 0 && gt(v, mAcc[i - 1]) ? bullBg : bearBg));
    const line = (vals: number[]) => bars.map((b, i) => ({
      time: b.time, value: Number.isFinite(vals[i]) ? vals[i] : NaN, color: lineColor[i],
    }));
    plots[`plot${3 * k}`] = line(mAcc);
    plots[`plot${3 * k + 1}`] = line(hAcc);
    plots[`plot${3 * k + 2}`] = line(lAcc);
    fills.push({ plot1: `plot${3 * k + 1}`, plot2: `plot${3 * k + 2}`, colors: bg });
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills,
    hlines: [
      { value: 0, options: { title: 'Centroid', color: String(color.new(color.white, 80)), linestyle: 'dashed' } },
    ],
  };
}

export const GaussianAccelerationArray = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
