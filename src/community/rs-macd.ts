/**
 * rs_MACD (Moving Average Convergence and Divergence)
 *
 * MACD of the source (default ohlc4): macd = ema(src, fast) - ema(src, slow), signal = sma(macd, signal length),
 * histogram = macd - signal. The histogram is drawn as an area and as circles (dark when it does not rise); the MACD
 * is green when it is above the signal and not falling, else light red; the signal is red when it is above the MACD
 * and not rising, else light green. Horizontal line at 0. The original script draws on the price pane.
 *
 * Reference: "rs_MACD" by RicardoSantos
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © RicardoSantos.
 */

import {
  ta, Series, getSourceSeries, color,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';

export interface RsMacdInputs {
  /** Source of the moving averages */
  source: SourceType;
  /** EMA length of the fast average */
  fastLength: number;
  /** EMA length of the slow average */
  slowLength: number;
  /** SMA length of the signal line */
  signalLength: number;
}

export const defaultInputs: RsMacdInputs = {
  source: 'ohlc4',
  fastLength: 12,
  slowLength: 24,
  signalLength: 6,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source:', defval: 'ohlc4' },
  { id: 'fastLength', type: 'int', title: 'Fast Length:', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length:', defval: 24, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length:', defval: 6, min: 1 },
];

const HIST_AREA = String(color.rgb(99, 124, 150, 80));
const HIST_DOWN = '#455669';
const HIST_UP = '#91a3b5';
const MACD_LIGHT = '#fda8a8';
const SIGNAL_LIGHT = '#a8fdab';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Histogram', color: HIST_AREA, lineWidth: 2, style: 'area' },
  { id: 'plot1', title: 'Histogram Line', color: HIST_UP, lineWidth: 2, style: 'circles' },
  { id: 'plot2', title: 'MACD', color: color.green, lineWidth: 2, style: 'circles' },
  { id: 'plot3', title: 'Signal', color: color.red, lineWidth: 2, style: 'circles' },
];

export const metadata = {
  title: 'Moving Average Convergence and Divergence',
  shortTitle: 'MACD',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => ge(b, a);

export function calculate(bars: Bar[], inputs: Partial<RsMacdInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  const src = getSourceSeries(bars, cfg.source);
  const fastMA = A(ta.ema(src, cfg.fastLength));
  const slowMA = A(ta.ema(src, cfg.slowLength));
  const macd = fastMA.map((f, i) => f - slowMA[i]);
  const signal = A(ta.sma(Series.fromArray(bars, macd), cfg.signalLength));
  const hist = macd.map((m, i) => m - signal[i]);
  const prev = (a: number[], i: number) => (i > 0 ? a[i - 1] : NaN);

  const plot0 = [];
  const plot1 = [];
  const plot2 = [];
  const plot3 = [];
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    // c1 = macd > signal and macd >= macd[1] ? color.green : #fda8a8
    const c1 = gt(macd[i], signal[i]) && ge(macd[i], prev(macd, i)) ? color.green : MACD_LIGHT;
    // c2 = signal > macd and signal <= signal[1] ? color.red : #a8fdab
    const c2 = gt(signal[i], macd[i]) && le(signal[i], prev(signal, i)) ? color.red : SIGNAL_LIGHT;
    // c3 = hist <= hist[1] ? #455669 : #91a3b5
    const c3 = le(hist[i], prev(hist, i)) ? HIST_DOWN : HIST_UP;
    plot0.push({ time: t, value: hist[i], color: HIST_AREA });
    plot1.push({ time: t, value: hist[i], color: c3 });
    plot2.push({ time: t, value: macd[i], color: c1 });
    plot3.push({ time: t, value: signal[i], color: c2 });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2, plot3 },
    // hline(0): Pine defaults (colour #787B86, dashed, width 1)
    hlines: [{ value: 0, options: { title: 'Level', color: '#787B86', linestyle: 'dashed', linewidth: 1 } }],
  };
}

export const RsMacd = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
