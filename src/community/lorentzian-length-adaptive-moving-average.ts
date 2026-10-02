/**
 * Lorentzian Length Adaptive Moving Average (LLAMA)
 *
 * A feature is the average of up to three normalised series: a hand-written ADX (18) / 100, a kernel MACD histogram
 * (rational quadratic kernels 11 and 26 over 21 bars, EMA 9 signal, divided by ATR 14, rounded to 0.25) and the
 * volume / SMA(volume, 20) / 5. Two nearest-neighbour searches compare the current feature with the feature of
 * the last 500 bars (every 2nd bar for the long line, every 4th bar for the short line) with the Lorentzian distance
 * log(1 + |a - b|) and keep the 6 nearest bars. Their labels (the sign of close - close[4], inverted for the short
 * line) set the length of an EMA-like average between Min Length and Max Length. A guardian takes the lowest or the
 * highest of that length over 6 bars, depending on the position of the average and the candle colour; the final
 * average uses that length and is smoothed with a rational quadratic kernel (4 bars). Each line is coloured with a
 * gradient from its 3-bar low to its 3-bar high.
 *
 * Reference: "Lorentzian Length Adaptive Moving Average[LLAMA]" by Starcruiser
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Starcruiser
 */

import { ta, Series, math, color, callsite, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface LorentzianLengthAdaptiveMovingAverageInputs {
  /** Min length of the adaptive average (2 - 1000) */
  llamaMinLen: number;
  /** Max length of the adaptive average (2 - 1000) */
  llamaMaxLen: number;
  showLong: boolean;
  showShort: boolean;
  useFeatureADX: boolean;
  useFeatureKernel: boolean;
  useFeatureVolume: boolean;
  useKernelSmoothing: boolean;
}

export const defaultInputs: LorentzianLengthAdaptiveMovingAverageInputs = {
  llamaMinLen: 9,
  llamaMaxLen: 600,
  showLong: true,
  showShort: true,
  useFeatureADX: true,
  useFeatureKernel: true,
  useFeatureVolume: true,
  useKernelSmoothing: true,
};

const GROUP = '━━━━━━━━━━━━━━━━━━ ＬＬＡＭＡ ━━━━━━━━━━━━━━━━━━';

export const inputConfig: InputConfig[] = [
  { id: 'llamaMinLen', type: 'int', title: 'Min Length', defval: 9, min: 2, max: 1000, step: 1, group: GROUP, tooltip: '2 - 1000' },
  { id: 'llamaMaxLen', type: 'int', title: 'Max Length', defval: 600, min: 2, max: 1000, step: 1, group: GROUP, tooltip: '2 - 1000' },
  { id: 'showLong', type: 'bool', title: 'Show Long Line ?', defval: true, group: GROUP },
  { id: 'showShort', type: 'bool', title: 'Show Short Line ?', defval: true, group: GROUP },
  { id: 'useFeatureADX', type: 'bool', title: 'Use Feature ADX ? ', defval: true, group: GROUP },
  { id: 'useFeatureKernel', type: 'bool', title: 'Use Feature Kernel ? ', defval: true, group: GROUP },
  { id: 'useFeatureVolume', type: 'bool', title: 'Use Feature Volume ? ', defval: true, group: GROUP },
  { id: 'useKernelSmoothing', type: 'bool', title: 'Use Kernel Smoothing ? ', defval: true, group: GROUP },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Long Adaptive Average', color: '#7FA532', lineWidth: 2 },
  { id: 'plot1', title: 'Short Adaptive Average', color: '#C98504', lineWidth: 2 },
];

export const metadata = {
  title: 'Lorentzian Length Adaptive Moving Average[LLAMA]',
  shortTitle: 'LLAMA',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
/** Pine nz(): na and +-infinity give 0 */
const nz = (x: number) => (Number.isFinite(x) ? x : 0);

/**
 * f_rationalQuadratic(_src, _lookback, _relativeWeight, startAtBar) on every bar: the loop runs for
 * i = 0 .. array.size(array.from(_src)) + startAtBar = 1 + startAtBar; a bar without history gives na.
 */
function rationalQuadratic(src: number[], lookback: number, relativeWeight: number, startAtBar: number): number[] {
  const last = 1 + startAtBar;
  const weights: number[] = [];
  for (let i = 0; i <= last; i++) {
    weights.push(math.pow(1 + math.pow(i, 2) / (math.pow(lookback, 2) * 2 * relativeWeight), -relativeWeight));
  }
  return src.map((_v, b) => {
    let currentWeight = 0;
    let cumulativeWeight = 0;
    for (let i = 0; i <= last; i++) {
      const y = b - i >= 0 ? src[b - i] : NaN;
      currentWeight += y * weights[i];
      cumulativeWeight += weights[i];
    }
    return currentWeight / cumulativeWeight;
  });
}

/** rescale(src, oldMin, oldMax, newMin, newMax) */
const rescale = (src: number, oldMin: number, oldMax: number, newMin: number, newMax: number) =>
  newMin + ((newMax - newMin) * (src - oldMin)) / Math.max(oldMax - oldMin, 10e-10);

/** f_dynamicMA(src, len): one call site (its own `var float ma`), called once per bar */
function dynamicMA() {
  let ma = NaN;
  return (src: number, len: number): number => {
    const alpha = 2.0 / (len + 1.0);
    ma = isNaN(ma) ? src : ma + alpha * (src - ma);
    return ma;
  };
}

/**
 * f_LongGuardian / f_ShortGuardian: `ma <op> src ? ta.lowest(nl, len) : (cond1 or cond3 ? ta.highest(nl, len) :
 * ta.lowest(nl, len))`. Each of the three ta calls runs only on the bars where its branch is taken: one call site
 * each, with the history kept by bar (oakscriptjs callsite.lowestByBar / callsite.highestByBar).
 */
function guardian(isLong: boolean) {
  const low1 = callsite.lowestByBar();
  const high = callsite.highestByBar();
  const low2 = callsite.lowestByBar();
  return (bar: number, ma: number, src: number, isGreen: boolean, isRed: boolean, nl: number, len: number): number => {
    // long: cond1 = ma > src and isGreen; cond3 = ma > src and isRed (short: ma < src)
    const away = isLong ? gt(ma, src) : lt(ma, src);
    const cond1 = away && isGreen;
    const cond3 = away && isRed;
    if (isLong ? lt(ma, src) : gt(ma, src)) return low1(bar, nl, len);
    return cond1 || cond3 ? high(bar, nl, len) : low2(bar, nl, len);
  };
}

type Point = { time: number; value: number; color?: string };

export function calculate(bars: Bar[], inputs: Partial<LorentzianLengthAdaptiveMovingAverageInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const close = bars.map((b) => b.close);
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  const volume = bars.map((b) => b.volume ?? NaN);

  // featureVolume = rescale(volume / ta.sma(volume, 20), 0, 5, 0, 1)
  const volSma = A(ta.sma(S(volume), 20));
  const featureVolume = volume.map((v, i) => rescale(v / volSma[i], 0, 5, 0, 1));

  // featureADX = n_adx(high, low, close, 18)
  const adxLen = 18;
  const dx: number[] = new Array(n);
  let trSmooth = 0;
  let smoothPlus = 0;
  let smoothMinus = 0;
  for (let i = 0; i < n; i++) {
    const pc = i > 0 ? nz(close[i - 1]) : 0;
    const ph = i > 0 ? nz(high[i - 1]) : 0;
    const pl = i > 0 ? nz(low[i - 1]) : 0;
    const tr = Math.max(Math.max(high[i] - low[i], Math.abs(high[i] - pc)), Math.abs(low[i] - pc));
    const plus = gt(high[i] - ph, pl - low[i]) ? Math.max(high[i] - ph, 0) : 0;
    const minus = gt(pl - low[i], high[i] - ph) ? Math.max(pl - low[i], 0) : 0;
    trSmooth = nz(trSmooth) - nz(trSmooth) / adxLen + tr;
    smoothPlus = nz(smoothPlus) - nz(smoothPlus) / adxLen + plus;
    smoothMinus = nz(smoothMinus) - nz(smoothMinus) / adxLen + minus;
    const diPositive = (smoothPlus / trSmooth) * 100;
    const diNegative = (smoothMinus / trSmooth) * 100;
    dx[i] = (Math.abs(diPositive - diNegative) / (diPositive + diNegative)) * 100;
  }
  const featureADX = A(ta.rma(S(dx), adxLen)).map((x) => rescale(x, 0, 100, 0, 1));

  // featureKernel = mround(n_kernelCD(close, 11, 26, 19, 9, 14), 0.25)
  const fast = rationalQuadratic(close, 11, 4, 19);
  const slow = rationalQuadratic(close, 26, 4, 19);
  const cd = fast.map((f, i) => f - slow[i]);
  const signal = A(ta.ema(S(cd), 9));
  const atr = A(ta.atr(bars, 14));
  const featureKernel = cd.map((c, i) => {
    const kcd = nz((c - signal[i]) / atr[i]);
    return math.round(kcd / 0.25) * 0.25;
  });

  const enabledCount = (cfg.useFeatureADX ? 1 : 0) + (cfg.useFeatureKernel ? 1 : 0) + (cfg.useFeatureVolume ? 1 : 0);
  const feature = bars.map((_b, i) => {
    const featureSum = (cfg.useFeatureADX ? featureADX[i] : 0) + (cfg.useFeatureKernel ? featureKernel[i] : 0)
      + (cfg.useFeatureVolume ? featureVolume[i] : 0);
    return enabledCount > 0 ? featureSum / enabledCount : 0;
  });

  // yTrainSeriesLong: close[4] < close -> -1, close[4] > close -> 1, else 0 (inverted for the short line)
  const yLong = close.map((c, i) => {
    const c4 = i >= 4 ? close[i - 4] : NaN;
    return lt(c4, c) ? -1 : gt(c4, c) ? 1 : 0;
  });
  const yShort = close.map((c, i) => {
    const c4 = i >= 4 ? close[i - 4] : NaN;
    return gt(c4, c) ? -1 : lt(c4, c) ? 1 : 0;
  });

  // Nearest neighbours: the 6 smallest Lorentzian distances among bars i = 0, step, 2 * step ... <= min(499, bar_index)
  const neighbourLength = (b: number, step: number, labels: number[]): number => {
    const loopSize = Math.min(500 - 1, b);
    const dist = [1e10, 1e10, 1e10, 1e10, 1e10, 1e10];
    const lbls = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i <= loopSize; i += step) {
      const d = math.log(1 + Math.abs(feature[b] - feature[b - i]));
      const lbl = labels[b - i];
      let worstIndex = 0;
      let worstVal = dist[0];
      for (let k = 1; k <= 5; k++) {
        if (gt(dist[k], worstVal)) {
          worstVal = dist[k];
          worstIndex = k;
        }
      }
      if (lt(d, worstVal)) {
        dist[worstIndex] = d;
        lbls[worstIndex] = lbl;
      }
    }
    let prediction = 0.0;
    for (let j = 0; j < 6; j++) prediction += lbls[j];
    const nPrediction = prediction / 6;
    const w = (nPrediction + 1) / 2;
    return math.round(cfg.llamaMinLen * (1 - w) + cfg.llamaMaxLen * w);
  };

  const dmaLongA = dynamicMA();
  const dmaLongB = dynamicMA();
  const dmaShortA = dynamicMA();
  const dmaShortB = dynamicMA();
  const longGuardian = guardian(true);
  const shortGuardian = guardian(false);
  const longMa: number[] = new Array(n);
  const shortMa: number[] = new Array(n);
  for (let b = 0; b < n; b++) {
    const nLongLen = neighbourLength(b, 2, yLong);
    const nShortLen = neighbourLength(b, 4, yShort);
    const isGreen = gt(close[b], bars[b].open);
    const isRed = lt(close[b], bars[b].open);
    // dmaLong = f_dynamicMA(close, nLongLen); nLongLock = f_LongGuardian(dmaLong, close, nLongLen, 6);
    // dmaLong := f_dynamicMA(close, nLongLock)
    const longLock = longGuardian(b, dmaLongA(close[b], nLongLen), close[b], isGreen, isRed, nLongLen, 6);
    longMa[b] = dmaLongB(close[b], longLock);
    // dmaShort: same with f_ShortGuardian; the second f_dynamicMA(close, nShortLock) call is overwritten by the third,
    // which gets the same values on every bar
    const shortLock = shortGuardian(b, dmaShortA(close[b], nShortLen), close[b], isGreen, isRed, nShortLen, 6);
    shortMa[b] = dmaShortB(close[b], shortLock);
  }
  // dmaLong := useKernelSmoothing ? f_rationalQuadratic(dmaLong, 2, 14, 2) : dmaLong
  const dmaLong = cfg.useKernelSmoothing ? rationalQuadratic(longMa, 2, 14, 2) : longMa;
  const dmaShort = cfg.useKernelSmoothing ? rationalQuadratic(shortMa, 2, 14, 2) : shortMa;

  const line = (dma: number[], show: boolean, lowColors: [string, string], highColors: [string, string]): Point[] => {
    const lo = A(ta.lowest(S(dma), 3));
    const hi = A(ta.highest(S(dma), 3));
    return bars.map((bar, i) => {
      const mid = (lo[i] + hi[i]) / 2;
      const grad = lt(dma[i], mid)
        ? color.from_gradient(dma[i], lo[i], mid, lowColors[0], lowColors[1])
        : color.from_gradient(dma[i], mid, hi[i], highColors[0], highColors[1]);
      return { time: bar.time, value: show ? dma[i] : NaN, color: String(color.new(grad, 0)) };
    });
  };

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: line(dmaLong, cfg.showLong, ['#FF1100', '#C98504'], ['#7FA532', '#2DFF85']),
      plot1: line(dmaShort, cfg.showShort, ['#2DFF85', '#7FA532'], ['#C98504', '#FF1100']),
    },
  };
}

export const LorentzianLengthAdaptiveMovingAverage = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
