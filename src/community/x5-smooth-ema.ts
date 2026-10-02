/**
 * x5 Smooth EMA
 *
 * An EMA of the source is smoothed again by five moving averages of the same length (SMA, EMA, RMA, WMA, VWMA). Each
 * smoothed line is coloured bull when it rises from the previous bar, else bear. The base EMA is drawn as a sixth
 * line, coloured as the VWMA line (as the original script does).
 *
 * Reference: "x5-smooth-ema[t90]" by traderninezero
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © traderninezero
 */

import { taCore, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface X5SmoothEmaInputs {
  /** Source of the base EMA */
  src: SourceType;
  /** Length of the base EMA and of the smoothing averages */
  emaLen: number;
  bullColor: string;
  bearColor: string;
}

// input.color(#00e67740) / input.color(#f5020237): Pine keeps the alpha with 2 decimals (0.25 / 0.22)
export const defaultInputs: X5SmoothEmaInputs = {
  src: 'close',
  emaLen: 9,
  bullColor: 'rgba(0, 230, 119, 0.25)',
  bearColor: 'rgba(245, 2, 2, 0.22)',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'emaLen', type: 'int', title: 'Base Length', defval: 9 },
  { id: 'bullColor', type: 'color', title: 'Bull Color', defval: 'rgba(0, 230, 119, 0.25)' },
  { id: 'bearColor', type: 'color', title: 'Bear Color', defval: 'rgba(245, 2, 2, 0.22)' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'fl1', color: 'rgba(0, 230, 119, 0.25)', lineWidth: 1 },
  { id: 'plot1', title: 'fl2', color: 'rgba(0, 230, 119, 0.25)', lineWidth: 1 },
  { id: 'plot2', title: 'fl3', color: 'rgba(0, 230, 119, 0.25)', lineWidth: 1 },
  { id: 'plot3', title: 'fl4', color: 'rgba(0, 230, 119, 0.25)', lineWidth: 1 },
  { id: 'plot4', title: 'fl5', color: 'rgba(0, 230, 119, 0.25)', lineWidth: 1 },
  { id: 'plot5', title: 'fl0', color: 'rgba(0, 230, 119, 0.25)', lineWidth: 1 },
];

export const metadata = {
  title: 'x5-smooth-ema[t90]',
  shortTitle: 'x5ema[t90]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(bars: Bar[], inputs: Partial<X5SmoothEmaInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.emaLen;
  const src = getSourceSeries(bars, cfg.src).toArray().map((v) => v ?? NaN);
  const volume = bars.map((b) => b.volume ?? NaN);

  const mainEMA = taCore.ema(src, len);
  const smoothSMA = taCore.sma(mainEMA, len);
  const smoothEMA = taCore.ema(mainEMA, len);
  const smoothSMMA = taCore.rma(mainEMA, len);
  const smoothWMA = taCore.wma(mainEMA, len);
  const smoothVWMA = taCore.vwma(mainEMA, len, volume);
  const baseEMA = taCore.ema(src, len);

  // x > x[1] ? bullColor : bearColor
  const rising = (x: number[], i: number) => i > 0 && gt(x[i], x[i - 1]);
  const line = (x: number[], colorOf: number[]) => bars.map((b, i) => ({
    time: b.time,
    value: x[i],
    color: rising(colorOf, i) ? cfg.bullColor : cfg.bearColor,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: line(smoothSMA, smoothSMA),
      plot1: line(smoothEMA, smoothEMA),
      plot2: line(smoothSMMA, smoothSMMA),
      plot3: line(smoothWMA, smoothWMA),
      plot4: line(smoothVWMA, smoothVWMA),
      // plot(baseEMA, "fl0", color = smoothVWMAColor)
      plot5: line(baseEMA, smoothVWMA),
    },
  };
}

export const X5SmoothEma = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
