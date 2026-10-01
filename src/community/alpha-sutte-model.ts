/**
 * Alpha-Sutte Model
 *
 * Alpha-Sutte forecast: with delta, alpha, beta, gamma = close[4], close[3], close[2], close[1], the three relative
 * changes x / ((alpha + delta) / 2), y / ((beta + alpha) / 2), z / ((gamma + beta) / 2) (x = alpha - delta,
 * y = beta - alpha, z = gamma - beta) are weighted by alpha, beta and gamma, averaged and added to close[1].
 * Sutte: SutteL = (close + close[1]) / 2 + close - low, SutteH = (close + close[1]) / 2 + high - close and their
 * mean. The adaptive line is the mean of Alpha-Sutte and Sutte. SMAs of SutteL and SutteH are drawn.
 *
 * Reference: "Alpha-Sutte Model" by SegaRKO
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © SegaRKO
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface AlphaSutteModelInputs {
  /** SMA length of the Sutte low / high lines */
  len: number;
}

export const defaultInputs: AlphaSutteModelInputs = {
  len: 1,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Sutte MA length', defval: 1, min: 1 },
];

/** Pine plot default colour */
const DEFAULT_BLUE = '#2962FF';
const COMBO_COL = String(color.new(color.yellow, 40));
const LOW_COL = String(color.new(color.aqua, 0));
const HIGH_COL = String(color.new(color.red, 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Alpha-Sutte', color: DEFAULT_BLUE, lineWidth: 1 },
  { id: 'plot1', title: 'Adaptive Alpha Sutte', color: COMBO_COL, lineWidth: 1 },
  { id: 'plot2', title: 'Sutte Low MA', color: LOW_COL, lineWidth: 1 },
  { id: 'plot3', title: 'Sutte High MA', color: HIGH_COL, lineWidth: 1 },
];

export const metadata = {
  title: 'Alpha-Sutte Model',
  shortTitle: 'Alpha-Sutte Model',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<AlphaSutteModelInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const close = (i: number) => (i >= 0 ? bars[i].close : NaN);
  /** Plots show na for non-finite values */
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

  const alphaSutte: number[] = new Array(n);
  const sutteL: number[] = new Array(n);
  const sutteH: number[] = new Array(n);
  const combo: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const delta = close(i - 4);
    const alpha = close(i - 3);
    const beta = close(i - 2);
    const gamma = close(i - 1);
    const x = alpha - delta;
    const y = beta - alpha;
    const z = gamma - beta;
    const a = alpha + delta;
    const b = beta + alpha;
    const g = gamma + beta;
    // Plain divisions (x / 0 is +-infinity, 0 / 0 na), as Pine
    const p1b = (x / (a / 2)) * alpha;
    const p2b = (y / (b / 2)) * beta;
    const p3b = (z / (g / 2)) * gamma;
    const aT = (p1b + p2b + p3b) / 3;
    alphaSutte[i] = aT + gamma;

    const c = bars[i].close;
    sutteL[i] = (c + gamma) / 2 + c - bars[i].low;
    sutteH[i] = (c + gamma) / 2 + bars[i].high - c;
    const sutte = (sutteL[i] + sutteH[i]) / 2;
    // math.avg(a_t0, Sutte)
    combo[i] = (alphaSutte[i] + sutte) / 2;
  }
  const sutteLMA = A(ta.sma(S(sutteL), cfg.len));
  const sutteHMA = A(ta.sma(S(sutteH), cfg.len));

  const P = (vals: number[], col: string) => bars.map((bar, i) => ({ time: bar.time, value: fin(vals[i]), color: col }));
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: P(alphaSutte, DEFAULT_BLUE),
      plot1: P(combo, COMBO_COL),
      plot2: P(sutteLMA, LOW_COL),
      plot3: P(sutteHMA, HIGH_COL),
    },
  };
}

export const AlphaSutteModel = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
