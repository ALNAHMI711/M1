/**
 * Polyphase MACD (PMACD)
 *
 * `phases` MACD engines run side by side; on each bar only the engine of phase bar_index % phases is updated, so
 * each engine sees every `phases`-th bar (as a `phases` times higher timeframe). An engine keeps the last
 * max(fast, slow) source values and the last `signal` MACD values (filled with the first source value and with 0);
 * fast / slow are an EMA (alpha = 2 / (length + 1), seeded with the source) or the average of the last `length`
 * values; the signal is the same filter of the MACD; hist = MACD - signal. The outputs of the updated engine are
 * smoothed by an SMA of a WMA over `phases` bars (no smoothing with 1 phase). The histogram colour depends on the
 * sign and on the change from the previous bar.
 *
 * Reference: "Polyphase MACD (PMACD)" by The_Peaceful_Lizard
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © The_Peaceful_Lizard
 */

import { array, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

type FilterStyle = 'SMA' | 'EMA';

export interface PolyphaseMacdInputs {
  source: SourceType;
  /** Number of phases (a timeframe multiplier) */
  phases: number;
  fastLength: number;
  slowLength: number;
  signalLength: number;
  oscillatorStyle: FilterStyle;
  signalStyle: FilterStyle;
  macdColor: string;
  signalColor: string;
  /** Histogram >= 0 and rising */
  risingUp: string;
  /** Histogram >= 0 and falling */
  risingDown: string;
  /** Histogram < 0 and falling */
  fallingDown: string;
  /** Histogram < 0 and rising */
  fallingUp: string;
  zeroLine: string;
}

// #787b8680 as Pine stores an input colour default (alpha with 2 decimals: 0.5)
const DEF_ZERO = 'rgba(120, 123, 134, 0.5)';

export const defaultInputs: PolyphaseMacdInputs = {
  source: 'close',
  phases: 1,
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  oscillatorStyle: 'EMA',
  signalStyle: 'EMA',
  macdColor: '#2962FF',
  signalColor: '#FF6D00',
  risingUp: '#26A69A',
  risingDown: '#B2DFDB',
  fallingDown: '#FF5252',
  fallingUp: '#FFCDD2',
  zeroLine: DEF_ZERO,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close', group: 'Global' },
  { id: 'phases', type: 'int', title: 'Phases', defval: 1, min: 1, group: 'Global' },
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12, min: 1, group: 'Polyphase MACD' },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26, min: 2, group: 'Polyphase MACD' },
  { id: 'signalLength', type: 'int', title: 'Signal Smoothing', defval: 9, min: 1, group: 'Polyphase MACD' },
  { id: 'oscillatorStyle', type: 'string', title: 'Oscillator MA Type', defval: 'EMA', options: ['SMA', 'EMA'], group: 'Polyphase MACD' },
  { id: 'signalStyle', type: 'string', title: 'Signal MA Type', defval: 'EMA', options: ['SMA', 'EMA'], group: 'Polyphase MACD' },
  { id: 'macdColor', type: 'color', title: 'MACD', defval: '#2962FF', group: 'Visuals' },
  { id: 'signalColor', type: 'color', title: 'Signal', defval: '#FF6D00', group: 'Visuals' },
  { id: 'risingUp', type: 'color', title: 'Histogram', defval: '#26A69A', group: 'Visuals' },
  { id: 'risingDown', type: 'color', title: 'Histogram (>= 0, falling)', defval: '#B2DFDB', group: 'Visuals' },
  { id: 'fallingDown', type: 'color', title: 'Histogram (< 0, falling)', defval: '#FF5252', group: 'Visuals' },
  { id: 'fallingUp', type: 'color', title: 'Histogram (< 0, rising)', defval: '#FFCDD2', group: 'Visuals' },
  { id: 'zeroLine', type: 'color', title: 'Zero Line', defval: DEF_ZERO, group: 'Visuals' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Histogram', color: '#26A69A', lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot2', title: 'MACD', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Polyphase MACD (PMACD)',
  shortTitle: 'Polyphase MACD (PMACD)',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const nz = (x: number, y: number) => (isNaN(x) ? y : x);

/** One MACD engine (Pine type MACD) */
interface Macd {
  source: number[];
  fast: number;
  slow: number;
  macd: number[];
  signal: number;
  hist: number;
}

/** method unshift_pop(float[] self, float value): pop the last value, insert the new one at the front */
const unshiftPop = (self: number[], value: number) => {
  self.pop();
  self.unshift(value);
};

/** method ema(float self, float source, int period): one EMA step seeded with the source */
const emaStep = (self: number, source: number, period: number) => {
  const alpha = 2.0 / (period + 1);
  const iAlpha = 1 - alpha;
  return source * alpha + nz(self, source) * iAlpha;
};

/** method sma(float[] self, int period): average of the first `period` values (all values when fewer) */
const arraySma = (self: number[], period: number) =>
  period < self.length ? array.avg(array.slice(self, 0, period)) : array.avg(self);

/** filter(source, input_array, input_variable, period, style) */
const filter = (source: number, inputArray: number[], inputVariable: number, period: number, style: FilterStyle) =>
  style === 'SMA' ? arraySma(inputArray, period) : emaStep(inputVariable, source, period);

/**
 * Pine user functions sma(source, length) / wma(source, length): an SMA / WMA over min(bar_index + 1, length) bars,
 * na history values replaced by the first non-na source; the value is kept on a bar with an na source. Each call
 * site has its own state and history.
 */
const weightedSite = (weighted: boolean) => {
  const hist: number[] = [];
  let value = NaN;
  let firstSource = NaN;
  return (barIndex: number, source: number, length: number): number => {
    hist.push(source);
    const maxLength = Math.min(barIndex, length - 1);
    if (!isNaN(source)) {
      if (isNaN(firstSource)) firstSource = source;
      const at = (k: number) => {
        const j = hist.length - 1 - k;
        return nz(j >= 0 ? hist[j] : NaN, firstSource);
      };
      let sum = 0;
      if (weighted) {
        let weight = 0;
        for (let k = 0; k <= maxLength; k++) {
          const w = maxLength + 1 - k;
          weight += w;
          sum += at(k) * w;
        }
        value = sum / weight;
      } else {
        const w = 1.0 / (maxLength + 1);
        for (let k = 0; k <= maxLength; k++) sum += at(k) * w;
        value = sum;
      }
    }
    return value;
  };
};

/** output_filter(source, config) = sma(wma(source, phases), phases): one wma and one sma site per call */
const outputFilterSite = () => {
  const wma = weightedSite(true);
  const sma = weightedSite(false);
  return (barIndex: number, source: number, phases: number) => sma(barIndex, wma(barIndex, source, phases), phases);
};

export function calculate(bars: Bar[], inputs: Partial<PolyphaseMacdInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const src = getSourceSeries(bars, cfg.source).toArray().map((v) => v ?? NaN);
  const { phases, fastLength, slowLength, signalLength, oscillatorStyle, signalStyle } = cfg;

  const macdPhases: Macd[] = [];
  let ready = false;
  const macdFilter = outputFilterSite();
  const signalFilter = outputFilterSite();
  const histFilter = outputFilterSite();
  let prevHist = NaN; // self[1] of histogram_color
  let histColor = '';

  const macdOut: number[] = new Array(n);
  const signalOut: number[] = new Array(n);
  const histOut: number[] = new Array(n);
  const colorOut: string[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const source = src[i];
    // bar_index counts from the first bar of the data
    const phase = i % phases;
    if (!ready) {
      // init_macd(source, config)
      macdPhases.push({
        source: array.new_float(Math.max(fastLength, slowLength), source),
        fast: NaN,
        slow: NaN,
        macd: array.new_float(signalLength, 0),
        signal: NaN,
        hist: NaN,
      });
      ready = macdPhases.length === phases;
    }
    // method update(MACD self, float source, settings config)
    const m = macdPhases[phase];
    unshiftPop(m.source, source);
    m.fast = filter(source, m.source, m.fast, fastLength, oscillatorStyle);
    m.slow = filter(source, m.source, m.slow, slowLength, oscillatorStyle);
    const newMacd = m.fast - m.slow;
    unshiftPop(m.macd, newMacd);
    const newSignal = filter(newMacd, m.macd, m.signal, signalLength, signalStyle);
    m.signal = newSignal;
    m.hist = newMacd - newSignal;

    const macd = macdFilter(i, m.macd[0], phases);
    const signal = signalFilter(i, m.signal, phases);
    const hist = histFilter(i, m.hist, phases);

    // method histogram_color(float self, settings config)
    const ref = nz(prevHist, hist);
    if (ge(hist, 0)) {
      histColor = ge(hist, ref) ? cfg.risingUp : cfg.risingDown;
    } else {
      histColor = le(hist, ref) ? cfg.fallingDown : cfg.fallingUp;
    }
    prevHist = hist;

    macdOut[i] = macd;
    signalOut[i] = signal;
    histOut[i] = hist;
    colorOut[i] = histColor;
  }

  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: fin(histOut[i]), color: colorOut[i] })),
      plot1: bars.map((b, i) => ({ time: b.time, value: fin(signalOut[i]), color: cfg.signalColor })),
      plot2: bars.map((b, i) => ({ time: b.time, value: fin(macdOut[i]), color: cfg.macdColor })),
    },
    hlines: [{ value: 0, options: { title: 'Zero Line', color: cfg.zeroLine, linestyle: 'dashed' } }],
  };
}

export const PolyphaseMacd = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
