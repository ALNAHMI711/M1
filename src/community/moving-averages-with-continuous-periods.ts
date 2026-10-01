/**
 * Moving Averages With Continuous Periods (Float MA's)
 *
 * SMA, WMA and HMA of the close with a fractional (float) length. SMA: the last ceil(length) closes, the oldest one
 * weighted by the fractional part of the length, divided by the length. WMA: a linear kernel max(0, length - x) for
 * x = 0..ceil(length), normalised to a sum of 1. HMA: WMA(2 * WMA(close, p / 2) - WMA(close, p), sqrt(p)), p = length - 1.
 * Bars before the first bar use the first value. The line colour follows the angle of the MA change: the change is
 * divided by a WMA of the absolute change (length max(2, length / 1.5), shorter on the first bars), turned into an
 * angle with atan and scaled to 0..1, then coloured as solid, two-tone or three-tone gradients, or polar.
 *
 * Reference: "Float MA's [fpma]" by The_Peaceful_Lizard
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © The_Peaceful_Lizard
 */

import { color, math, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface MovingAveragesWithContinuousPeriodsInputs {
  /** Source input of the Pine script; the Pine script computes the MA of the close (this input is not used) */
  src: SourceType;
  /** MA length (float) */
  length: number;
  /** MA style */
  style: 'SMA' | 'WMA' | 'HMA';
  /** Colour style of the line */
  gradientType: 'Solid' | 'Two Tone' | 'Three Tone' | 'Polar';
  upColor: string;
  neutralColor: string;
  downColor: string;
  /** Line width (the plot width of the port is fixed at the default 3) */
  lineWidth: number;
}

export const defaultInputs: MovingAveragesWithContinuousPeriodsInputs = {
  src: 'close',
  length: 9,
  style: 'HMA',
  gradientType: 'Three Tone',
  upColor: '#8BFF3D',
  neutralColor: '#9A9A9A',
  downColor: '#FFC01F',
  lineWidth: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'length', type: 'float', title: 'Length', defval: 9, min: 2, step: 0.125 },
  { id: 'style', type: 'string', title: 'MA Style', defval: 'HMA', options: ['SMA', 'WMA', 'HMA'] },
  { id: 'gradientType', type: 'string', title: 'Gradient Style', defval: 'Three Tone', options: ['Solid', 'Two Tone', 'Three Tone', 'Polar'] },
  { id: 'upColor', type: 'color', title: 'Up Color', defval: '#8BFF3D' },
  { id: 'neutralColor', type: 'color', title: 'Neutral/Solid Color', defval: '#9A9A9A' },
  { id: 'downColor', type: 'color', title: 'Down Color', defval: '#FFC01F' },
  { id: 'lineWidth', type: 'int', title: 'Line Width', defval: 3, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Float MA', color: '#9A9A9A', lineWidth: 3 },
];

export const metadata = {
  title: "Float MA's [fpma]",
  shortTitle: "Float MA's [fpma]",
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; a != b only when |a - b| > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;
const nz = (v: number, r = 0) => (Number.isFinite(v) ? v : r);

/** wma_kernel(length): max(0, length - x) for x = 0..ceil(length), times nz(1 / sum, 1) */
function wmaKernel(length: number): number[] {
  const top = Math.ceil(length);
  let nc = 0;
  for (let x = 0; x <= top; x++) nc += Math.max(0, -x + length);
  nc = nz(1.0 / nc, 1);
  const kernel: number[] = [];
  for (let x = 0; x <= top; x++) kernel.push(Math.max(0, -x + length) * nc);
  return kernel;
}

/**
 * wma(source, length) of one Pine call site: `var first_value` (first non-na source) replaces the values before the
 * first bar; the `var` kernel is built on the first bar and again when the length changes (length != length[1]).
 */
function wma(source: number[], length: number[]): number[] {
  const n = source.length;
  const out: number[] = new Array(n);
  let firstValue = NaN;
  let kernel: number[] = [];
  for (let b = 0; b < n; b++) {
    if (isNaN(firstValue) && !isNaN(source[b])) firstValue = source[b];
    const prevLength = b > 0 && !isNaN(length[b - 1]) ? length[b - 1] : length[b]; // nz(length[1], length)
    if (b === 0 || ne(length[b], prevLength)) kernel = wmaKernel(length[b]);
    let sum = 0;
    for (let i = 0; i <= kernel.length - 1; i++) {
      const v = b - i >= 0 ? source[b - i] : NaN;
      sum += (isNaN(v) ? firstValue : v) * kernel[i];
    }
    out[b] = sum;
  }
  return out;
}

/** sma(source, length): the oldest of the ceil(length) values weighted by length % 1, sum / length */
function sma(source: number[], length: number): number[] {
  const n = source.length;
  const out: number[] = new Array(n);
  const realLength = Math.ceil(length);
  const mantissa = length % 1;
  let firstValue = NaN;
  for (let b = 0; b < n; b++) {
    if (isNaN(firstValue) && !isNaN(source[b])) firstValue = source[b];
    let sum = 0;
    for (let i = 0; i <= realLength - 1; i++) {
      let w = 1;
      if (ne(mantissa, 0) && i === realLength - 1) w = mantissa;
      const v = b - i >= 0 ? source[b - i] : NaN;
      sum += (isNaN(v) ? firstValue : v) * w;
    }
    out[b] = sum / length;
  }
  return out;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MovingAveragesWithContinuousPeriodsInputs> = {},
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const close = bars.map((b) => b.close);
  const len = cfg.length;
  const constant = (v: number) => new Array(n).fill(v);

  // ma = ma_select(close, length, style): the Pine script uses close, not the Source input
  let ma: number[];
  if (cfg.style === 'SMA') {
    ma = sma(close, len);
  } else if (cfg.style === 'WMA') {
    ma = wma(close, constant(len));
  } else {
    // hma: period = length - 1; wma(2 * wma(source, period / 2) - wma(source, period), math.sqrt(period))
    const period = len - 1;
    const half = wma(close, constant(period / 2));
    const full = wma(close, constant(period));
    ma = wma(half.map((h, i) => 2 * h - full[i]), constant(Math.sqrt(period)));
  }

  // trend_gradient(ma, math.max(2, length / 1.5), ...): normal_angle(source, atr_length)
  const atrLength = Math.max(2, len / 1.5);
  const delta = ma.map((v, i) => v - nz(i > 0 ? ma[i - 1] : NaN)); // source - nz(source[1])
  // atr(math.abs(delta), atr_length) = wma(source, math.min(bar_index + 1, length))
  const atr = wma(delta.map((d) => Math.abs(d)), bars.map((_b, i) => Math.min(i + 1, atrLength)));

  const plot0 = bars.map((bar, i) => {
    const atrNormalDelta = delta[i] / atr[i];
    const angle = math.todegrees(Math.atan(atrNormalDelta)) as number;
    const v = (angle + 90) / 180;
    let c: string;
    switch (cfg.gradientType) {
      case 'Solid':
        c = cfg.neutralColor;
        break;
      case 'Two Tone':
        c = String(color.from_gradient(v, 0, 1, cfg.downColor, cfg.upColor));
        break;
      case 'Polar':
        c = lt(v, 0.5) ? cfg.downColor : cfg.upColor;
        break;
      default: {
        // three_tone_gradient(value, 0, 1, ...): center 0.5, epsilon 0
        const center = (1 + 0) / 2;
        c = gt(v, center) ? String(color.from_gradient(v, center + 0, 1, cfg.neutralColor, cfg.upColor))
          : lt(v, center) ? String(color.from_gradient(v, 0, center - 0, cfg.downColor, cfg.neutralColor))
            : cfg.neutralColor;
      }
    }
    return { time: bar.time, value: Number.isFinite(ma[i]) ? ma[i] : NaN, color: c };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
  };
}

export const MovingAveragesWithContinuousPeriods = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
