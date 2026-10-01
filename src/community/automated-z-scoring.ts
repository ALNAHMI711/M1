/**
 * Automated Z-scoring
 *
 * Z-score of the source over `length` bars: (src - sma(src, length)) / stdev(src, length). The line is blue above
 * zero and purple otherwise; a gradient fill from the line (line colour) to zero (transparent) follows it.
 *
 * Reference: "Automated Z-scoring - [JTCAPITAL]" by JTCapitalNL
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © JTCapitalNL
 */

import { ta, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType, type Series } from 'oakscriptjs';

export interface AutomatedZScoringInputs {
  /** Length of the mean and standard deviation */
  length: number;
  /** Source */
  src: SourceType;
}

export const defaultInputs: AutomatedZScoringInputs = {
  length: 3000,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 3000 },
  { id: 'src', type: 'source', title: 'src', defval: 'close' },
];

const BULL = color.rgb(49, 132, 228);
const BEAR = color.rgb(132, 3, 158);

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Z-Score', color: BULL, lineWidth: 3 },
  { id: 'plot1', title: 'Zero', color: BULL, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Automated Z-scoring - [JTCAPITAL]',
  shortTitle: 'Automated Z-scoring - [JTCAPITAL]',
  overlay: false,
};

/** Pine a > b: a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;

export function calculate(bars: Bar[], inputs: Partial<AutomatedZScoringInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const srcS = getSourceSeries(bars, cfg.src);
  const src = A(srcS);

  const stdev = A(ta.stdev(srcS, cfg.length));
  const mean = A(ta.sma(srcS, cfg.length));
  // zscore = (src - mean) / stdev: a plain division (x / 0 is +-infinity, used by the comparison)
  const zscore = src.map((v, i) => (v - mean[i]) / stdev[i]);
  const lineColor = zscore.map((z) => (gt(z, 0) ? BULL : BEAR));
  const value = (z: number) => (Number.isFinite(z) ? z : NaN);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      // plot1 = plot(zscore, color = lineColor, linewidth = 3)
      plot0: bars.map((b, i) => ({ time: b.time, value: value(zscore[i]), color: lineColor[i] })),
      // plot12 = plot(0, color = lineColor, display = display.none)
      plot1: bars.map((b, i) => ({ time: b.time, value: 0, color: lineColor[i] })),
    },
    fills: [
      // fill(plot1, plot12, top_value = zscore, bottom_value = 0, top_color = lineColor,
      //      bottom_color = color.new(color.black, 100))
      { plot1: 'plot0', plot2: 'plot1', options: { title: 'Z-Score Fill' },
        gradient: {
          topValue: zscore.map(value),
          bottomValue: new Array<number>(n).fill(0),
          topColor: lineColor.slice(),
          bottomColor: new Array<string | null>(n).fill(String(color.new(color.black, 100))),
        } },
    ],
  };
}

export const AutomatedZScoring = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
