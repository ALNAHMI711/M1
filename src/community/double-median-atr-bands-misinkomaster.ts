/**
 * Double Median ATR Bands
 *
 * The median of the source over `medianLength` bars, and two bands: the median of (median +- ATR * multiplier) over
 * round(sqrt(medianLength)) bars. The source crossing over the upper band starts an up trend (blue), crossing under
 * the lower band starts a down trend (purple); before the first signal the lines are white. The area between the
 * bands has the trend colour.
 *
 * Reference: "Double Median ATR Bands | MisinkoMaster" by MisinkoMaster
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © MisinkoMaster
 */

import { ta, taCore, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface DoubleMedianAtrBandsInputs {
  /** Length of the median */
  medianLength: number;
  /** Source of the median */
  src: SourceType;
  /** Length of the Average True Range */
  atrLength: number;
  /** ATR multiplier */
  multiplier: number;
}

export const defaultInputs: DoubleMedianAtrBandsInputs = {
  medianLength: 23,
  src: 'close',
  atrLength: 17,
  multiplier: 1.05,
};

export const inputConfig: InputConfig[] = [
  { id: 'medianLength', type: 'int', title: 'Median Length', defval: 23, min: 2, step: 1, group: 'Median' },
  { id: 'src', type: 'source', title: 'src', defval: 'close', group: 'Median' },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 17, min: 2, step: 1, group: 'ATR' },
  { id: 'multiplier', type: 'float', title: 'ATR Multiplier', defval: 1.05, min: 0.05, step: 0.02, group: 'ATR' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Band', color: color.white, lineWidth: 2 },
  { id: 'plot1', title: 'Lower Band', color: color.white, lineWidth: 2 },
  { id: 'plot2', title: 'Median', color: color.white, lineWidth: 1 },
];

export const metadata = {
  title: 'Double Median ATR Bands | MisinkoMaster',
  shortTitle: 'Double Median ATR Bands',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<DoubleMedianAtrBandsInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const srcSeries = getSourceSeries(bars, cfg.src);
  const src = A(srcSeries);

  const median = taCore.median(src, cfg.medianLength);
  const atr = A(ta.atr(bars, cfg.atrLength));
  // sqrtlen = math.abs(math.round(math.sqrt(medianlen)))
  const sqrtLength = Math.abs(Math.round(Math.sqrt(cfg.medianLength)));
  const upper = taCore.median(median.map((m, i) => m + atr[i] * cfg.multiplier), sqrtLength);
  const lower = taCore.median(median.map((m, i) => m - atr[i] * cfg.multiplier), sqrtLength);

  // L = ta.crossover(src, Upper); S = ta.crossunder(src, Lower) (exact comparisons)
  const L = A(ta.crossover(srcSeries, Series.fromArray(bars, upper)));
  const S = A(ta.crossunder(srcSeries, Series.fromArray(bars, lower)));

  const upLine = String(color.rgb(0, 175, 255, 10));
  const upFill = String(color.rgb(0, 175, 255, 70));
  const downLine = String(color.rgb(175, 0, 255, 10));
  const downFill = String(color.rgb(175, 0, 255, 70));
  const lineColors: string[] = new Array(n);
  const fillColors: string[] = new Array(n);
  // var col = color.white; var colT = color.white
  let col: string = color.white;
  let colT: string = color.white;
  for (let i = 0; i < n; i++) {
    const l = L[i] === 1;
    const s = S[i] === 1;
    if (l && !s) {
      col = upLine;
      colT = upFill;
    }
    if (s) {
      col = downLine;
      colT = downFill;
    }
    lineColors[i] = col;
    fillColors[i] = colT;
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: upper[i], color: lineColors[i] })),
      plot1: bars.map((b, i) => ({ time: b.time, value: lower[i], color: lineColors[i] })),
      plot2: bars.map((b, i) => ({ time: b.time, value: median[i], color: lineColors[i] })),
    },
    fills: [{ plot1: 'plot0', plot2: 'plot1', colors: fillColors }],
  };
}

export const DoubleMedianAtrBands = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
