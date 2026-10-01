/**
 * TASC 2025.02 Autocorrelation Indicator
 *
 * John F. Ehlers' autocorrelation heatmap. The source is smoothed by the UltimateSmoother (period `length`, from
 * bar_index 4), or replaced by a 30-bar sine wave (test signal). For each lag l = 0..99 the correlation over
 * `length` bars is (length * sxy - sx * sy) / sqrt((length * sxx - sx^2) * (length * syy - sy^2)), with sx / sxx the
 * sums of the series and of its squares, sy / syy these sums l bars ago and sxy the sum of the products of the
 * current window with the window l bars ago. A correlation keeps its last value when a variance term is not
 * positive (0 at the start). Lag l colours the line at level l + 1 of the
 * selected range: yellow to green for c >= 0 (rgb(255 * (1 - c), 255, 0)), yellow to red for c < 0
 * (rgb(255, 255 * (1 + c), 0)). The first line of the 0-32 range (lag 0) is transparent.
 *
 * Reference: "TASC 2025.02 Autocorrelation Indicator" by PineCodersTASC
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export type TascAutocorrelationRange = '0-32' | '33-65' | '66-98';

export interface TascAutocorrelationInputs {
  /** Source series */
  src: SourceType;
  /** Length of each correlation (and UltimateSmoother period) */
  length: number;
  /** Use a 30-bar sine wave as the series */
  useTestSignal: boolean;
  /** Lag range shown */
  lagRange: TascAutocorrelationRange;
}

export const defaultInputs: TascAutocorrelationInputs = {
  src: 'close',
  length: 20,
  useTestSignal: false,
  lagRange: '0-32',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'length', type: 'int', title: 'Length', defval: 20 },
  { id: 'useTestSignal', type: 'bool', title: 'Use test signal', defval: false },
  { id: 'lagRange', type: 'string', title: 'Lag range', defval: '0-32', options: ['0-32', '33-65', '66-98'] },
];

/** 32 lines: plot k is the level k + 1 of the range (Pine title 'S', width 2, display.pane) */
export const plotConfig: PlotConfig[] = Array.from({ length: 32 }, (_v, k) => ({
  id: `plot${k}`, title: 'S', color: '#2962FF', lineWidth: 2, display: 'pane' as const,
}));

export const metadata = {
  title: 'TASC 2025.02 Autocorrelation Indicator',
  shortTitle: 'ACI',
  overlay: false,
};

const EPS = 1e-10;
/** Pine a > b: a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > EPS;
/** Pine a >= b: not (b - a > 1e-10), false with na */
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
/** Pine a < b */
const lt = (a: number, b: number) => b - a > EPS;

/** math.sum(x, len): sum of the last len values, na until len bars */
function rollingSum(x: number[], len: number): number[] {
  return x.map((_v, i) => {
    if (i < len - 1) return NaN;
    let s = 0;
    for (let j = i - len + 1; j <= i; j++) s += x[j];
    return s;
  });
}

export function calculate(bars: Bar[], inputs: Partial<TascAutocorrelationInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const length = cfg.length;
  const src = getSourceSeries(bars, cfg.src).toArray().map((v) => v ?? NaN);

  // Filt: test sine wave or UltimateSmoother(Src, Length); bar_index counts from the first bar of the data
  const filt: number[] = new Array(n);
  if (cfg.useTestSignal) {
    for (let i = 0; i < n; i++) filt[i] = Math.sin((2.0 * Math.PI * i) / 30.0);
  } else {
    const a1 = Math.exp((-1.414 * Math.PI) / length);
    const c2 = 2.0 * a1 * Math.cos((1.414 * Math.PI) / length);
    const c3 = -a1 * a1;
    const c1 = (1.0 + c2 - c3) / 4.0;
    const nz = (x: number) => (isNaN(x) ? 0 : x);
    for (let i = 0; i < n; i++) {
      let us = src[i];
      if (i >= 4) {
        us = (1.0 - c1) * src[i] + (2.0 * c1 - c2) * src[i - 1] - (c1 + c3) * src[i - 2]
          + c2 * nz(filt[i - 1]) + c3 * nz(filt[i - 2]);
      }
      filt[i] = us;
    }
  }

  // correlation(Filt, Length)
  const sx = rollingSum(filt, length);
  const sxx = rollingSum(filt.map((v) => v * v), length);
  const corr: number[] = new Array(101).fill(0.0); // var array<float> corr
  const col: string[] = new Array(101).fill('transparent'); // var array<color> col = #00000000
  const lo = cfg.lagRange === '0-32' ? 0 : cfg.lagRange === '33-65' ? 33 : 66;
  const plots: Record<string, { time: number; value: number; color: string }[]> = {};
  for (let k = 0; k < 32; k++) plots[`plot${k}`] = [];
  // var array<float> data = array.new<float>(length): push / shift keep the last `length` values (na before bar 0)
  const at = (j: number) => (j >= 0 ? filt[j] : NaN);

  for (let i = 0; i < n; i++) {
    for (let l = 0; l <= 99; l++) {
      // lData = data[l]: the array as it was l bars ago (na before the first bar);
      // sxy = mat.mult(lData).first() = sum of data[j] * lData[j] (na with an na element)
      let sxy = NaN;
      if (l <= i) {
        sxy = 0;
        for (let j = 0; j < length; j++) sxy += at(i - length + 1 + j) * at(i - l - length + 1 + j);
      }
      const sy = l <= i ? sx[i - l] : NaN;
      const syy = l <= i ? sxx[i - l] : NaN;
      const ca1 = length * sxx[i] - sx[i] * sx[i];
      const ca2 = length * syy - sy * sy;
      if (gt(ca1, 0.0) && gt(ca2, 0.0)) {
        const ca3 = length * sxy - sx[i] * sy;
        corr[l + 1] = ca3 / Math.sqrt(ca1 * ca2);
      }
    }
    for (let l = 1; l <= 99; l++) {
      const c = corr[l + 1];
      if (ge(c, 0.0)) col[l] = color.rgb(255 * (1.0 - c), 255, 0);
      else if (lt(c, 0.0)) col[l] = color.rgb(255, 255 * (1.0 + c), 0);
    }
    // C.slice(lo, lo + 32); plot(IDX(k + 1), 'S', C.get(k), 2)
    const t = bars[i].time;
    for (let k = 0; k < 32; k++) plots[`plot${k}`].push({ time: t, value: lo + k + 1, color: col[lo + k] });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
  };
}

export const TascAutocorrelation = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
