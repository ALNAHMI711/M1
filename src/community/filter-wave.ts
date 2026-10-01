/**
 * Filter Wave
 *
 * Trend score of a linear regression line: over the last `n` regression values, every pair (newer, older) adds +1
 * when the newer value is higher, -1 when it is lower. The state is bullish when the score is above the tolerance
 * (Range Tolerance % of the pair count), bearish below its negative. The intensity |score| / pair count, smoothed by
 * three SMA(3), shifts a wave above the close by intensity * ATR(14) * 0.5 and a floor by intensity * ATR(14) * 0.1;
 * both lines and the fill between them take the bull / bear colour (less transparent with a higher intensity), grey
 * in the neutral state.
 *
 * Reference: "Filter Wave" by c9indicator
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface FilterWaveInputs {
  /** Number of regression values compared pair by pair */
  n: number;
  /** Range tolerance (%) of the pair count */
  p: number;
  /** Regression source */
  src: SourceType;
  /** Linear regression length */
  lrLen: number;
  colBull: string;
  colBear: string;
}

export const defaultInputs: FilterWaveInputs = {
  n: 12,
  p: 90,
  src: 'close',
  lrLen: 90,
  colBull: '#00ffbb',
  colBear: '#ff1100',
};

export const inputConfig: InputConfig[] = [
  { id: 'n', type: 'int', title: 'Lookback Period', defval: 12 },
  { id: 'p', type: 'int', title: 'Range Tolerance (%)', defval: 90, min: 0, max: 100 },
  { id: 'src', type: 'source', title: 'Regression Source', defval: 'close' },
  { id: 'lrLen', type: 'int', title: 'Linear Regression Length', defval: 90 },
  { id: 'colBull', type: 'color', title: 'Bull Color', defval: '#00ffbb' },
  { id: 'colBear', type: 'color', title: 'Bear Color', defval: '#ff1100' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Wave', color: '#00ffbb', lineWidth: 3 },
  { id: 'plot1', title: 'Wave Floor', color: '#00ffbb', lineWidth: 1 },
];

export const metadata = {
  title: 'Filter Wave',
  shortTitle: 'Filter Wave',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** Pine `for i = a to b`: counts up, or down when a > b */
function pineRange(a: number, b: number): number[] {
  const out: number[] = [];
  if (a <= b) for (let i = a; i <= b; i++) out.push(i);
  else for (let i = a; i >= b; i--) out.push(i);
  return out;
}

export function calculate(bars: Bar[], inputs: Partial<FilterWaveInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const { n, p } = cfg;
  const len = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  const lr = A(ta.linreg(getSourceSeries(bars, cfg.src), cfg.lrLen, 0));
  const lrAt = (bar: number, k: number) => {
    if (k < 0) throw new Error(`Invalid number of bars back: ${k}`);
    return bar - k >= 0 ? lr[bar - k] : NaN;
  };

  // total_pairs = (n * (n - 1)) / 2 and p / 100 are fractional divisions in Pine v6
  const totalPairs = (n * (n - 1)) / 2;
  const threshold = totalPairs * (p / 100);
  const iRange = pineRange(0, n - 2);
  const state: number[] = new Array(len);
  const intensity: number[] = new Array(len);
  for (let b = 0; b < len; b++) {
    let trend = 0;
    for (const i of iRange) {
      for (const j of pineRange(i + 1, n - 1)) {
        const a = lrAt(b, i);
        const c = lrAt(b, j);
        trend += gt(a, c) ? 1 : lt(a, c) ? -1 : 0;
      }
    }
    state[b] = gt(trend, threshold) ? 1 : lt(trend, -threshold) ? -1 : 0;
    intensity[b] = Math.abs(trend) / totalPairs;
  }

  const smooth1 = A(ta.sma(S(intensity), 3));
  const smooth2 = A(ta.sma(S(smooth1), 3));
  const smooth3 = A(ta.sma(S(smooth2), 3));
  const atr = A(ta.atr(bars, 14));

  const waveColor = (i: number) => {
    // alpha = 90 - int(intensity * 70)
    const alpha = 90 - Math.trunc(intensity[i] * 70);
    return state[i] === 1 ? color.new(cfg.colBull, alpha)
      : state[i] === -1 ? color.new(cfg.colBear, alpha)
        : color.new(color.gray, 80);
  };
  const finite = (v: number) => (Number.isFinite(v) ? v : NaN);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      // wave = close + smooth3 * ta.atr(14) * 0.5
      plot0: bars.map((b, i) => ({
        time: b.time, value: finite(b.close + smooth3[i] * atr[i] * 0.5), color: String(waveColor(i)),
      })),
      // wave_floor = close + smooth3 * ta.atr(14) * 0.1, colour color.new(wave_color, 90)
      plot1: bars.map((b, i) => ({
        time: b.time, value: finite(b.close + smooth3[i] * atr[i] * 0.1), color: String(color.new(waveColor(i), 90)),
      })),
    },
    // fill(p1, p2, color.new(wave_color, 85))
    fills: [{ plot1: 'plot0', plot2: 'plot1', colors: bars.map((_b, i) => String(color.new(waveColor(i), 85))) }],
  };
}

export const FilterWave = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
