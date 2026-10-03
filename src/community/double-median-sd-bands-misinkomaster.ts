/**
 * Double Median SD Bands
 *
 * Bands of the source +- standard deviation (over `length` bars, biased or not) * multiplier, smoothed twice by a
 * median: first over round(length / 2) bars, then over round(sqrt(length)) bars. The source crossing over the upper
 * band starts an up trend (purple), crossing under the lower band starts a down trend (amber); before the first
 * signal the lines are white. The area between the bands has the trend colour.
 *
 * Reference: "Double Median SD Bands | MisinkoMaster" by MisinkoMaster
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © MisinkoMaster
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface DoubleMedianSdBandsInputs {
  /** Length of the standard deviation */
  len: number;
  /** Band multiplier */
  mul: number;
  /** Source */
  src: SourceType;
  /** Biased (population) standard deviation; false: sample */
  bias: boolean;
}

export const defaultInputs: DoubleMedianSdBandsInputs = {
  len: 27,
  mul: 1.4,
  src: 'ohlc4',
  bias: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Length', defval: 27, min: 2, step: 1, group: 'DMSDB | MisinkoMaster' },
  { id: 'mul', type: 'float', title: 'Band Multiplier', defval: 1.4, min: 0, step: 0.01, group: 'DMSDB | MisinkoMaster' },
  { id: 'src', type: 'source', title: 'src', defval: 'ohlc4', group: 'DMSDB | MisinkoMaster' },
  { id: 'bias', type: 'bool', title: 'Use Biased SD?', defval: true, group: 'DMSDB | MisinkoMaster' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Band', color: color.white, lineWidth: 2 },
  { id: 'plot1', title: 'Lower Band', color: color.white, lineWidth: 2 },
];

export const metadata = {
  title: 'Double Median SD Bands | MisinkoMaster',
  shortTitle: 'DMSDB | MisinkoMaster',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<DoubleMedianSdBandsInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const srcSeries = getSourceSeries(bars, cfg.src);
  const src = A(srcSeries);

  // hlen = math.abs(math.round(len / 2)); sqrtlen = math.abs(math.round(math.sqrt(len)))
  const hlen = Math.abs(Math.round(cfg.len / 2));
  const sqrtlen = Math.abs(Math.round(Math.sqrt(cfg.len)));

  const sd = A(ta.stdev(srcSeries, cfg.len, cfg.bias));
  const sdbu = src.map((v, i) => v + sd[i] * cfg.mul);
  const sdbl = src.map((v, i) => v - sd[i] * cfg.mul);
  const msdbu = A(ta.median(S(sdbu), hlen));
  const msdbl = A(ta.median(S(sdbl), hlen));
  const dmsdbu = A(ta.median(S(msdbu), sqrtlen));
  const dmsdbl = A(ta.median(S(msdbl), sqrtlen));

  // L = ta.crossover(src, dmsdbu); S = ta.crossunder(src, dmsdbl) (exact comparisons)
  const L = A(ta.crossover(srcSeries, S(dmsdbu)));
  const Sh = A(ta.crossunder(srcSeries, S(dmsdbl)));

  const upLine = String(color.rgb(143, 0, 209));
  const upFill = String(color.rgb(143, 0, 209, 60));
  const downLine = String(color.rgb(255, 191, 0));
  const downFill = String(color.rgb(255, 191, 0, 60));
  const lineColors: string[] = new Array(n);
  const fillColors: string[] = new Array(n);
  // var col = color.white; var colT = color.white
  let col: string = color.white;
  let colT: string = color.white;
  for (let i = 0; i < n; i++) {
    const l = L[i] === 1;
    const s = Sh[i] === 1;
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
      plot0: bars.map((b, i) => ({ time: b.time, value: dmsdbu[i], color: lineColors[i] })),
      plot1: bars.map((b, i) => ({ time: b.time, value: dmsdbl[i], color: lineColors[i] })),
    },
    fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'Plots Background' }, colors: fillColors }],
  };
}

export const DoubleMedianSdBands = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
