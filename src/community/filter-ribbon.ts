/**
 * Filter Ribbon
 *
 * A ribbon around the linear regression of the source (length 90). The trend score counts, over the last
 * `lookback` regression values, the ordered pairs (i < j bars ago) where the newer value is above (+1) or below
 * (-1) the older one. The state is bull when the score is above `tolerance` % of the pair count, bear otherwise
 * (a neutral score is drawn with the bear colour). The ribbon is the regression +/- 0.1 * ATR(14); its colour is
 * more opaque when the absolute score is closer to the pair count.
 *
 * Reference: "Filter Ribbon" by c9indicator
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface FilterRibbonInputs {
  /** Number of regression values compared pairwise */
  lookback: number;
  /** Range tolerance (%) of the pair count for a bull / bear state */
  tolerance: number;
  /** Regression source */
  src: SourceType;
  /** Linear regression length */
  lrLength: number;
  bullColor: string;
  bearColor: string;
}

export const defaultInputs: FilterRibbonInputs = {
  lookback: 12,
  tolerance: 90,
  src: 'close',
  lrLength: 90,
  bullColor: '#00ffbb',
  bearColor: '#ff1100',
};

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'Lookback Period', defval: 12, min: 2 },
  { id: 'tolerance', type: 'int', title: 'Range Tolerance (%)', defval: 90, min: 0, max: 100 },
  { id: 'src', type: 'source', title: 'Regression Source', defval: 'close' },
  { id: 'lrLength', type: 'int', title: 'Linear Regression Length', defval: 90, min: 1 },
  { id: 'bullColor', type: 'color', title: 'Bull Ribbon Color', defval: '#00ffbb' },
  { id: 'bearColor', type: 'color', title: 'Bear Ribbon Color', defval: '#ff1100' },
];

const LR_COLOR = String(color.new(color.white, 60));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Ribbon Top', color: '#ff1100', lineWidth: 3 },
  { id: 'plot1', title: 'Ribbon Bottom', color: '#ff1100', lineWidth: 3 },
  // fill(plot(ribbon_top), plot(ribbon_bottom), ...): plots without a colour, drawn with the Pine default colour
  { id: 'plot2', title: 'Ribbon Top (fill)', color: '#2962FF', lineWidth: 1 },
  { id: 'plot3', title: 'Ribbon Bottom (fill)', color: '#2962FF', lineWidth: 1 },
  { id: 'plot4', title: 'Linear Regression', color: LR_COLOR, lineWidth: 1 },
];

export const metadata = {
  title: 'Filter Ribbon',
  shortTitle: 'Filter Ribbon',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(bars: Bar[], inputs: Partial<FilterRibbonInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: { toArray(): (number | null | undefined)[] }) => s.toArray().map((v) => v ?? NaN);
  const k = cfg.lookback;

  const lr = A(ta.linreg(getSourceSeries(bars, cfg.src), cfg.lrLength, 0));
  const atr = A(ta.atr(bars, 14));
  const lrAgo = (i: number, back: number) => (i - back >= 0 ? lr[i - back] : NaN);

  // total_pairs = n * (n - 1) / 2; threshold = total_pairs * (p / 100)
  const totalPairs = (k * (k - 1)) / 2;
  const threshold = totalPairs * (cfg.tolerance / 100);

  const top: number[] = new Array(n);
  const bottom: number[] = new Array(n);
  const cols: string[] = new Array(n);
  for (let t = 0; t < n; t++) {
    let trend = 0;
    for (let i = 0; i <= k - 2; i++) {
      for (let j = i + 1; j <= k - 1; j++) {
        const a = lrAgo(t, i);
        const b = lrAgo(t, j);
        trend += gt(a, b) ? 1 : gt(b, a) ? -1 : 0;
      }
    }
    const state = trend > threshold ? 1 : trend < -threshold ? -1 : 0;
    const intensity = Math.abs(trend) / totalPairs;
    // alpha = 90 - int(intensity * 70)
    const alpha = 90 - Math.trunc(intensity * 70);
    cols[t] = String(color.new(state === 1 ? cfg.bullColor : cfg.bearColor, alpha));
    const offset = atr[t] * 0.1;
    top[t] = lr[t] + offset;
    bottom[t] = lr[t] - offset;
  }

  const time = (i: number) => bars[i].time;
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      // plot(ribbon_top, color = ribbon_col, linewidth = 3); plot(ribbon_bottom, ...)
      plot0: bars.map((_b, i) => ({ time: time(i), value: top[i], color: cols[i] })),
      plot1: bars.map((_b, i) => ({ time: time(i), value: bottom[i], color: cols[i] })),
      plot2: bars.map((_b, i) => ({ time: time(i), value: top[i] })),
      plot3: bars.map((_b, i) => ({ time: time(i), value: bottom[i] })),
      // plot(lr, color = color.new(color.white, 60), linewidth = 1)
      plot4: bars.map((_b, i) => ({ time: time(i), value: lr[i], color: LR_COLOR })),
    },
    // fill(plot(ribbon_top), plot(ribbon_bottom), color = ribbon_col)
    fills: [{ plot1: 'plot2', plot2: 'plot3', colors: cols }],
  };
}

export const FilterRibbon = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
