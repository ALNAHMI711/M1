/**
 * Normalized Volume & True Range
 *
 * The bar range in percent (|close - open| / min(open, close) for "Body", high / low for "High/Low", close / previous
 * close for "Close/Close") is normalized to 0..100 % by an outlier maximum: cumulative average + scale * a one-sided
 * standard deviation (only the values above the cumulative average count; the sum of squares is divided by their
 * count - 1). The volume is normalized the same way, with a scale chosen so that the average volume sits at the same
 * height as the average range (the Baseline). Optional averages of both (a sum over `length` bars, the first value
 * fills the bars before it) and a 100 % line.
 *
 * Reference: "Normalized Volume & True Range" by The_Peaceful_Lizard
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © peacefulLizard50262
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export type NormalizedVolumeTrueRangeStyle = 'Body' | 'High/Low' | 'Close/Close';

export interface NormalizedVolumeTrueRangeInputs {
  /** Range used as the true range: Body (open / close), High/Low, Close/Close (previous close / close) */
  trStyle: NormalizedVolumeTrueRangeStyle;
  /** Outlier range: the maximum is the average + this many one-sided deviations */
  mainScale: number;
  /** Show the average of the normalized true range (ATR plot) */
  showAtr: boolean;
  atrLength: number;
  /** Show the average of the normalized volume */
  showAverageVolume: boolean;
  volumeLength: number;
  /** Show the Baseline (normalized average volume) */
  showBaseline: boolean;
}

export const defaultInputs: NormalizedVolumeTrueRangeInputs = {
  trStyle: 'Body',
  mainScale: 5,
  showAtr: false,
  atrLength: 14,
  showAverageVolume: false,
  volumeLength: 14,
  showBaseline: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'trStyle', type: 'string', title: 'True Range Style', defval: 'Body', options: ['Body', 'High/Low', 'Close/Close'] },
  { id: 'mainScale', type: 'float', title: 'Outlier Range', defval: 5, min: 0.5, step: 0.25 },
  { id: 'showAtr', type: 'bool', title: '', defval: false, inline: 'ATR' },
  { id: 'atrLength', type: 'int', title: 'ATR', defval: 14, min: 2, inline: 'ATR' },
  { id: 'showAverageVolume', type: 'bool', title: '', defval: false, inline: 'Volume' },
  { id: 'volumeLength', type: 'int', title: 'Average Volume', defval: 14, min: 2, inline: 'Volume' },
  { id: 'showBaseline', type: 'bool', title: 'Show Baselines', defval: true },
];

const UP_COLOR = '#089981';
const DOWN_COLOR = '#f23645';
const TR_COLOR = '#fafafa';
const BASELINE_COLOR = '#BAD7F2';

// display = show_baseline / show_atr / show_average_volume ? display.all : display.none:
// PlotConfig `visible` = result.visibility entry
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Normalized Volume', color: UP_COLOR, lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Normalized True Range', color: TR_COLOR, lineWidth: 1, style: 'histogram' },
  { id: 'plot2', title: 'Baseline', color: BASELINE_COLOR, lineWidth: 3, style: 'linebr', visible: 'showBaseline' },
  { id: 'plot3', title: 'ATR', color: color.blue, lineWidth: 3, visible: 'showAtr' },
  { id: 'plot4', title: 'Average Volume', color: color.orange, lineWidth: 3, visible: 'showAverageVolume' },
];

export const metadata = {
  title: 'Normalized Volume & True Range',
  shortTitle: 'Normalized Volume & True Range',
  overlay: false,
  format: 'percent',
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
/** Pine na(): na and +-infinity */
const isNa = (x: number) => !Number.isFinite(x);
/** Pine math.min: na when an argument is na (an infinite argument takes part) */
const min = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.min(a, b));
const finite = (x: number) => (Number.isFinite(x) ? x : NaN);

/** p_stdev(source, average): one-sided deviation of the values above the average (var state per call site) */
function pStdev(source: number[], average: number[]): number[] {
  let p = NaN;
  let vari = 0;
  let count = -1;
  return source.map((s, i) => {
    if (gt(s, average[i])) {
      vari += Math.pow(s - average[i], 2);
      count += 1;
    }
    if (count > 0) p = Math.sqrt(vari / count);
    return p;
  });
}

/**
 * sma(source, length): sum of nz(source[i], first_value) for i = 0 .. length - 1, divided by length, once the first
 * non-na source value is seen (0 before it).
 */
function firstFilledSma(source: number[], length: number): number[] {
  let firstValue = NaN;
  let ready = false;
  return source.map((s, bar) => {
    let sum = 0;
    if (!ready && isNa(firstValue) && !isNa(s)) {
      firstValue = s;
      ready = true;
    }
    if (ready) {
      for (let i = 0; i <= length - 1; i++) {
        const v = bar - i >= 0 ? source[bar - i] : NaN;
        sum += isNa(v) ? firstValue : v;
      }
    }
    return sum / length;
  });
}

export function calculate(
  bars: Bar[],
  inputs: Partial<NormalizedVolumeTrueRangeInputs> = {},
): IndicatorResult & { visibility: Record<string, boolean> } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  // true_range_select(tr_style)
  const absPercent = bars.map((b, i) => {
    let start: number;
    let finish: number;
    if (cfg.trStyle === 'High/Low') {
      start = b.low;
      finish = b.high;
    } else if (cfg.trStyle === 'Close/Close') {
      const prev = i > 0 ? bars[i - 1].close : NaN;
      start = isNa(prev) ? b.close : prev;
      finish = b.close;
    } else {
      start = b.open;
      finish = b.close;
    }
    return Math.abs(finish - start) / min(finish, start);
  });
  const volume = bars.map((b) => b.volume ?? NaN);

  // cum_avg(source) = ta.cum(source) / (bar_index + 1)
  const cumAvg = (src: number[]) => A(ta.cum(S(src))).map((c, i) => c / (i + 1));

  const avgAbsPercent = cumAvg(absPercent);
  const pStdevAbsPercent = pStdev(absPercent, avgAbsPercent);
  const avgVolume = cumAvg(volume);
  const pStdevVolume = pStdev(volume, avgVolume);

  const normalizedAbsPercent: number[] = new Array(n);
  const normalizedVolume: number[] = new Array(n);
  const normalizedAvgVolume: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const absPercentMax = avgAbsPercent[i] + pStdevAbsPercent[i] * cfg.mainScale;
    const normalizedAvgPercent = avgAbsPercent[i] / absPercentMax;
    const scaleFactor = (avgVolume[i] * (1 - normalizedAvgPercent)) / (normalizedAvgPercent * pStdevVolume[i]);
    const maxVolume = avgVolume[i] + pStdevVolume[i] * scaleFactor;
    normalizedAbsPercent[i] = min(absPercentMax, absPercent[i]) / absPercentMax;
    normalizedVolume[i] = min(volume[i], maxVolume) / maxVolume;
    normalizedAvgVolume[i] = avgVolume[i] / maxVolume;
  }

  const averageNormalTr = firstFilledSma(normalizedAbsPercent.map((v) => v * 100), cfg.atrLength);
  const averageNormalVolume = firstFilledSma(normalizedVolume.map((v) => v * 100), cfg.volumeLength);

  const t = (i: number) => bars[i].time;
  const plots = {
    plot0: bars.map((b, i) => ({
      time: t(i), value: finite(normalizedVolume[i] * 100), color: lt(b.open, b.close) ? UP_COLOR : DOWN_COLOR,
    })),
    plot1: bars.map((_b, i) => ({ time: t(i), value: finite(normalizedAbsPercent[i] * 100), color: TR_COLOR })),
    plot2: bars.map((_b, i) => ({ time: t(i), value: finite(normalizedAvgVolume[i] * 100), color: BASELINE_COLOR })),
    plot3: bars.map((_b, i) => ({ time: t(i), value: finite(averageNormalTr[i]), color: color.blue })),
    plot4: bars.map((_b, i) => ({ time: t(i), value: finite(averageNormalVolume[i]), color: color.orange })),
  };

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, format: metadata.format },
    plots,
    hlines: [{ value: 100, options: { title: '100% Max Line', color: '#787b866e', linestyle: 'dashed' } }],
    visibility: { showBaseline: cfg.showBaseline, showAtr: cfg.showAtr, showAverageVolume: cfg.showAverageVolume },
  };
}

export const NormalizedVolumeTrueRange = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
