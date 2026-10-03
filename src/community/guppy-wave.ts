/**
 * Guppy Wave
 *
 * Twelve moving averages of the source (type EMA, SMA, WMA, VWMA, HMA or RMA): six short ones (3, 5, 8, 10, 12, 15)
 * and six long ones (30, 35, 40, 45, 50, 60). With "Fill EMA" on, the lines are hidden (transparent) and the space
 * between each pair of neighbour lines is filled: bullish colour when the 15 average is above the 30 average,
 * bearish colour otherwise, with a transparency that changes from band to band. With "Fill EMA" off, the lines are
 * drawn and the fills are transparent.
 *
 * Reference: "Guppy Wave [UkutaLabs]" by UkutaLabs
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © UKUTA
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export type GuppyWaveMaType = 'EMA' | 'SMA' | 'WMA' | 'VWMA' | 'HMA' | 'RMA';

export interface GuppyWaveInputs {
  /** Moving average type */
  maType: GuppyWaveMaType;
  /** Moving average source */
  maSource: SourceType;
  /** Fill the space between the averages (lines hidden) */
  fillEMASpace: boolean;
  /** Bullish colour */
  longColor: string;
  /** Bearish colour */
  shortColor: string;
}

export const defaultInputs: GuppyWaveInputs = {
  maType: 'EMA',
  maSource: 'close',
  fillEMASpace: true,
  longColor: color.green,
  shortColor: color.red,
};

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'Moving Average Type', defval: 'EMA', options: ['EMA', 'SMA', 'WMA', 'VWMA', 'HMA', 'RMA'] },
  { id: 'maSource', type: 'source', title: 'Moving Average Source', defval: 'close' },
  { id: 'fillEMASpace', type: 'bool', title: 'Fill EMA', defval: true },
  { id: 'longColor', type: 'color', title: 'Bullish Color', defval: color.green },
  { id: 'shortColor', type: 'color', title: 'Bearish Color', defval: color.red },
];

const PERIODS = [3, 5, 8, 10, 12, 15, 30, 35, 40, 45, 50, 60];
const LINE_COLORS = ['#90bff9', '#5b9cf6', '#3179f5', '#2962ff', '#1848cc', '#0c3299',
  '#ffcc80', '#ffb74d', '#ffa726', '#ff9800', '#f57c00', '#e65100'];
/** Fill transparencies (bullish, bearish) of the 11 bands, from the fastest pair */
const FILL_TRANSP: [number, number][] = [
  [93, 63], [90, 66], [87, 69], [84, 72], [81, 75], [78, 78], [75, 81], [72, 84], [69, 87], [66, 90], [63, 93],
];

export const plotConfig: PlotConfig[] = PERIODS.map((p, k) => ({
  id: `plot${k}`,
  title: `${k < 6 ? 'Short' : 'Long'} MA ${p}`,
  color: String(color.new(LINE_COLORS[k], 100)),
  lineWidth: 1,
}));

export const metadata = {
  title: 'Guppy Wave [UkutaLabs]',
  shortTitle: 'Guppy Wave [UkutaLabs]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(bars: Bar[], inputs: Partial<GuppyWaveInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const src = getSourceSeries(bars, cfg.maSource);
  const volume = Series.fromArray(bars, bars.map((b) => b.volume ?? NaN));

  // MovingAverage(type, source, period): the type is an input, so the same ta.* call runs on every bar
  const movingAverage = (period: number): number[] => {
    switch (cfg.maType) {
      case 'EMA': return A(ta.ema(src, period));
      case 'SMA': return A(ta.sma(src, period));
      case 'WMA': return A(ta.wma(src, period));
      case 'VWMA': return A(ta.vwma(src, period, volume));
      case 'HMA': return A(ta.hma(src, period));
      case 'RMA': return A(ta.rma(src, period));
      default: return new Array<number>(n).fill(NaN);
    }
  };
  const mas = PERIODS.map(movingAverage);

  const plots: Record<string, { time: number; value: number; color: string }[]> = {};
  mas.forEach((ma, k) => {
    const c = String(color.new(LINE_COLORS[k], cfg.fillEMASpace ? 100 : 0));
    plots[`plot${k}`] = bars.map((b, i) => ({ time: b.time, value: ma[i], color: c }));
  });

  // fill color = fillEMASpace ? spema6 > lpema1 ? color.new(long_color, tl) : color.new(short_color, ts) : color.new(#ffffff, 100)
  const bull = mas[5].map((v, i) => gt(v, mas[6][i]));
  const off = String(color.new('#ffffff', 100));
  const fills = FILL_TRANSP.map(([tl, ts], k) => {
    const cl = String(color.new(cfg.longColor, tl));
    const cs = String(color.new(cfg.shortColor, ts));
    return {
      plot1: `plot${k}`,
      plot2: `plot${k + 1}`,
      options: { color: cfg.fillEMASpace ? cl : off },
      colors: bull.map((up) => (cfg.fillEMASpace ? (up ? cl : cs) : off)),
    };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills,
  };
}

export const GuppyWave = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
