/**
 * Uptrick: Multi Moving Averages
 *
 * Up to three chained smoothing steps of the close: each enabled step applies one of 29 moving averages / filters
 * (SMA, EMA, WMA, RMA, LWMA, SMMA, HMA, TMA, DEMA, TEMA, KAMA, VIDYA, LSMA, GMA, ALMA, ZLEMA, FRAMA, VWMA, JMA,
 * EWMA, CFMA, BWMA, FIRMA, ITL, SSMA, MGD, DMA, PRMA, EAMA, in the simplified forms of the script) to the result of
 * the previous step. The final line and the bars are green when the line rises, red otherwise.
 *
 * Reference: "Uptrick: Multi Moving Averages" by Uptrick
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Uptrick
 */

import { ta, Series, color, math, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';

export const MA_TYPES = [
  'SMA', 'EMA', 'WMA', 'RMA', 'LWMA', 'SMMA', 'HMA', 'TMA', 'DEMA', 'TEMA', 'KAMA',
  'VIDYA', 'LSMA', 'GMA', 'ALMA', 'ZLEMA', 'FRAMA', 'VWMA', 'JMA', 'EWMA', 'CFMA',
  'BWMA', 'FIRMA', 'ITL', 'SSMA', 'MGD', 'DMA', 'PRMA', 'EAMA',
] as const;

export type UptrickMaType = (typeof MA_TYPES)[number];

export interface UptrickMultiMaVolumeInputs {
  useS1: boolean;
  maType1: UptrickMaType;
  len1: number;
  useS2: boolean;
  maType2: UptrickMaType;
  len2: number;
  useS3: boolean;
  maType3: UptrickMaType;
  len3: number;
}

export const defaultInputs: UptrickMultiMaVolumeInputs = {
  useS1: true,
  maType1: 'EMA',
  len1: 9,
  useS2: false,
  maType2: 'EMA',
  len2: 9,
  useS3: false,
  maType3: 'EMA',
  len3: 9,
};

const options = [...MA_TYPES];

export const inputConfig: InputConfig[] = [
  { id: 'useS1', type: 'bool', title: 'Enable Smoothing #1', defval: true, group: 'Smoothing #1' },
  { id: 'maType1', type: 'string', title: 'Type #1', defval: 'EMA', options, group: 'Smoothing #1' },
  { id: 'len1', type: 'int', title: 'Length #1', defval: 9, min: 1, group: 'Smoothing #1' },
  { id: 'useS2', type: 'bool', title: 'Enable Smoothing #2', defval: false, group: 'Smoothing #2' },
  { id: 'maType2', type: 'string', title: 'Type #2', defval: 'EMA', options, group: 'Smoothing #2' },
  { id: 'len2', type: 'int', title: 'Length #2', defval: 9, min: 1, group: 'Smoothing #2' },
  { id: 'useS3', type: 'bool', title: 'Enable Smoothing #3', defval: false, group: 'Smoothing #3' },
  { id: 'maType3', type: 'string', title: 'Type #3', defval: 'EMA', options, group: 'Smoothing #3' },
  { id: 'len3', type: 'int', title: 'Length #3', defval: 9, min: 1, group: 'Smoothing #3' },
];

const UP_COLOR = color.rgb(0, 255, 150);
const DOWN_COLOR = color.rgb(255, 0, 0);

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Final MA (3x)', color: UP_COLOR, lineWidth: 4 },
];

export const metadata = {
  title: 'Uptrick: Multi Moving Averages',
  shortTitle: '3x_MA_Smoothing',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;
/** Pine nz: na and +-infinity give the replacement */
const nz = (v: number, r = 0) => (Number.isFinite(v) ? v : r);

/** One smoothing step (f_getMA) on the values x (NaN = na) */
function getMa(bars: Bar[], x: number[], vol: number[], length: number, type: string): number[] {
  const n = x.length;
  const S = (a: number[]) => Series.fromArray(bars, a);
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  /** x[k] on bar i (na before the first bar) */
  const at = (a: number[], i: number, k: number) => (i - k >= 0 ? a[i - k] : NaN);
  /** var float y := nz(y[1]) + alpha * (x - nz(y[1])) */
  const recursive = (alpha: (i: number) => number) => {
    const y: number[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const p = nz(at(y, i, 1));
      y[i] = p + alpha(i) * (x[i] - p);
    }
    return y;
  };
  /** Efficiency ratio of KAMA / VIDYA */
  const efficiency = (i: number) => {
    let v = 0.0;
    for (let k = 1; k <= length; k++) v += Math.abs(at(x, i, k) - at(x, i, k - 1));
    const dir = Math.abs(x[i] - nz(at(x, i, length)));
    return eq(v, 0) ? 1.0 : dir / v;
  };
  /** 2-pole filter of BWMA / SSMA (bwPrev := nz(bwPrev[1], src)) */
  const twoPole = () => {
    const a = math.exp((-1.414 * 3.14159) / length);
    const prev: number[] = new Array(n);
    const y: number[] = new Array(n);
    for (let i = 0; i < n; i++) {
      prev[i] = nz(at(prev, i, 1), x[i]);
      y[i] = (1 - a) * (1 - a) * x[i] + 2 * a * prev[i] - a * a * nz(at(prev, i, 1));
    }
    return y;
  };

  switch (type) {
    case 'SMA':
      return A(ta.sma(S(x), length));
    case 'EMA':
    case 'EWMA':
      return A(ta.ema(S(x), length));
    case 'WMA':
      return A(ta.wma(S(x), length));
    case 'RMA':
    case 'SMMA':
      return A(ta.rma(S(x), length));
    case 'LWMA':
      return x.map((v, i) => {
        let sum = 0.0;
        let sumWeight = 0.0;
        for (let k = 0; k <= length - 1; k++) {
          const w = k + 1;
          sum += at(x, i, k) * w;
          sumWeight += w;
        }
        return ne(sumWeight, 0) ? sum / sumWeight : v;
      });
    case 'HMA': {
      const halfLen = Math.floor(length / 2);
      const sqrtLen = Math.floor(Math.sqrt(length));
      // Pine runtime error of ta.wma(_src, 0) (length 1)
      if (n > 0 && halfLen <= 0) {
        throw new Error(`Error on bar 0: Invalid value of the 'length' argument (${halfLen.toFixed(1)}) in the 'wma' function. It must be > 0.`);
      }
      const wma1 = A(ta.wma(S(x), halfLen));
      const wma2 = A(ta.wma(S(x), length));
      return A(ta.wma(S(wma1.map((w, i) => 2.0 * w - wma2[i])), sqrtLen));
    }
    case 'TMA':
      return A(ta.sma(ta.sma(S(x), length), length));
    case 'DEMA': {
      const ema1 = A(ta.ema(S(x), length));
      const ema2 = A(ta.ema(S(ema1), length));
      return ema1.map((e, i) => 2.0 * e - ema2[i]);
    }
    case 'TEMA': {
      const ema1 = A(ta.ema(S(x), length));
      const ema2 = A(ta.ema(S(ema1), length));
      const ema3 = A(ta.ema(S(ema2), length));
      return ema1.map((e, i) => 3.0 * (e - ema2[i]) + ema3[i]);
    }
    case 'KAMA':
    case 'VIDYA': {
      const fastSC = 2.0 / (2 + 1);
      const slowSC = 2.0 / (30 + 1);
      return recursive((i) => {
        const base = efficiency(i) * (fastSC - slowSC) + slowSC;
        return type === 'KAMA' ? math.pow(base, 2) : base;
      });
    }
    case 'LSMA':
    case 'PRMA':
      return A(ta.linreg(S(x), length, 0));
    case 'GMA':
      return x.map((_v, i) => {
        let sumLog = 0.0;
        for (let k = 0; k <= length - 1; k++) sumLog += math.log(nz(at(x, i, k)));
        return math.exp(sumLog / length);
      });
    case 'ALMA':
      return A(ta.alma(S(x), length, 0.85, 6));
    case 'ZLEMA': {
      const lag = Math.floor((length - 1) * 0.5);
      const src2 = x.map((v, i) => v + (v - nz(at(x, i, lag), v)));
      return A(ta.ema(S(src2), length));
    }
    case 'FRAMA': {
      const len = Math.max(length, 1);
      const hh = A(ta.highest(S(x), len));
      const ll = A(ta.lowest(S(x), len));
      return recursive((i) => {
        const range1 = hh[i] - ll[i];
        const dim = eq(range1, 0.0) ? 1.0 : math.log10(range1 / len) / math.log10(2);
        return math.exp(-4.6 * (dim - 1));
      });
    }
    case 'VWMA':
      return x.map((v, i) => {
        let sumPV = 0.0;
        let sumVol = 0.0;
        for (let k = 0; k <= length - 1; k++) {
          sumPV += at(x, i, k) * at(vol, i, k);
          sumVol += at(vol, i, k);
        }
        return ne(sumVol, 0) ? sumPV / sumVol : v;
      });
    case 'JMA': {
      const beta = (0.45 * (length - 1)) / (0.45 * (length - 1) + 2.0);
      return recursive(() => beta);
    }
    case 'CFMA': {
      const lr = A(ta.linreg(S(x), length, 0));
      return lr.map((l, i) => l + (x[i] - nz(at(x, i, 1))));
    }
    case 'BWMA':
    case 'SSMA':
      return twoPole();
    case 'FIRMA':
      return x.map((_v, i) => {
        let s = 0.0;
        for (let k = 0; k <= length - 1; k++) s += at(x, i, k);
        return s / length;
      });
    case 'ITL': {
      const y: number[] = new Array(n);
      for (let i = 0; i < n; i++) y[i] = 0.5 * ((x[i] + nz(at(x, i, 1))) / 2) + 0.5 * nz(at(y, i, 1));
      return y;
    }
    case 'MGD': {
      const speed = 0.6;
      const y: number[] = new Array(n);
      for (let i = 0; i < n; i++) {
        const p = nz(at(y, i, 1));
        // src / 0 is +-infinity: the step is 0 (Pine float division)
        y[i] = p + (x[i] - p) / (speed * math.pow(x[i] / p, 4));
      }
      return y;
    }
    case 'DMA': {
      const alpha = (2 * 3.14159) / length;
      const hp: number[] = new Array(n);
      for (let i = 0; i < n; i++) {
        hp[i] = math.pow(1 - alpha / 2, 2) * (x[i] - 2 * nz(at(x, i, 1)) + nz(at(x, i, 2)))
          + 2 * (1 - alpha) * nz(at(hp, i, 1)) - math.pow(1 - alpha, 2) * nz(at(hp, i, 2));
      }
      return x.map((v, i) => v - hp[i]);
    }
    case 'EAMA':
      return recursive(() => 0.07);
    default:
      return x.slice();
  }
}

export function calculate(
  bars: Bar[],
  inputs: Partial<UptrickMultiMaVolumeInputs> = {},
): IndicatorResult & { barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const src = bars.map((b) => b.close);
  const vol = bars.map((b) => b.volume ?? NaN);

  const ma1 = cfg.useS1 ? getMa(bars, src, vol, cfg.len1, cfg.maType1) : src;
  const ma2 = cfg.useS2 ? getMa(bars, ma1, vol, cfg.len2, cfg.maType2) : ma1;
  const finalMa = cfg.useS3 ? getMa(bars, ma2, vol, cfg.len3, cfg.maType3) : ma2;

  const plot0 = [];
  const barColors: BarColorData[] = [];
  for (let i = 0; i < n; i++) {
    // finalMA > finalMA[1] (an infinite value compares, na does not)
    const slopeColor = i > 0 && gt(finalMa[i], finalMa[i - 1]) ? UP_COLOR : DOWN_COLOR;
    const v = finalMa[i];
    plot0.push({ time: bars[i].time, value: Number.isFinite(v) ? v : NaN, color: slopeColor });
    barColors.push({ time: bars[i].time, color: slopeColor });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
    barColors,
  };
}

export const UptrickMultiMaVolume = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
