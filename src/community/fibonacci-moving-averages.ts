/**
 * Fibonacci Moving Averages
 *
 * Seven moving averages of the source with the Fibonacci lengths 5, 8, 13, 21, 34, 55 and 89. The type (SMA, EMA,
 * VWMA, WMA, HMA or RMA) is the same for all. A hidden average keeps its line, drawn fully transparent.
 *
 * Reference: "Fibonacci Moving Averages [UkutaLabs]" by UkutaLabs
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © ukutaindicators
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export type FibonacciMaType = 'SMA' | 'EMA' | 'VWMA' | 'WMA' | 'HMA' | 'RMA';

export interface FibonacciMovingAveragesInputs {
  /** MA source */
  maSource: SourceType;
  /** MA type */
  maType: FibonacciMaType;
  enable5: boolean;
  color5: string;
  lineWidth5: number;
  enable8: boolean;
  color8: string;
  lineWidth8: number;
  enable13: boolean;
  color13: string;
  lineWidth13: number;
  enable21: boolean;
  color21: string;
  lineWidth21: number;
  enable34: boolean;
  color34: string;
  lineWidth34: number;
  enable55: boolean;
  color55: string;
  lineWidth55: number;
  enable89: boolean;
  color89: string;
  lineWidth89: number;
}

const LENGTHS = [5, 8, 13, 21, 34, 55, 89] as const;
const COLORS: Record<number, string> = {
  5: color.orange,
  8: color.blue,
  13: color.green,
  21: 'rgb(255, 0, 255)',
  34: color.purple,
  55: color.red,
  89: color.yellow,
};

export const defaultInputs: FibonacciMovingAveragesInputs = {
  maSource: 'close',
  maType: 'EMA',
  enable5: true,
  color5: COLORS[5],
  lineWidth5: 1,
  enable8: true,
  color8: COLORS[8],
  lineWidth8: 1,
  enable13: true,
  color13: COLORS[13],
  lineWidth13: 1,
  enable21: true,
  color21: COLORS[21],
  lineWidth21: 1,
  enable34: true,
  color34: COLORS[34],
  lineWidth34: 1,
  enable55: true,
  color55: COLORS[55],
  lineWidth55: 1,
  enable89: true,
  color89: COLORS[89],
  lineWidth89: 1,
};

export const inputConfig: InputConfig[] = [
  { id: 'maSource', type: 'source', title: 'MA Source', defval: 'close' },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA', options: ['SMA', 'EMA', 'VWMA', 'WMA', 'HMA', 'RMA'] },
  ...LENGTHS.flatMap((len): InputConfig[] => [
    { id: `enable${len}`, type: 'bool', title: `Show ${len} Period MA`, defval: true },
    { id: `color${len}`, type: 'color', title: `${len} Period MA Color`, defval: COLORS[len] },
    { id: `lineWidth${len}`, type: 'int', title: 'Line Width', defval: 1 },
  ]),
];

export const plotConfig: PlotConfig[] = LENGTHS.map((len, k) => ({
  id: `plot${k}`, title: `${len} Period MA`, color: COLORS[len], lineWidth: 1,
}));

export const metadata = {
  title: 'Fibonacci Moving Averages [UkutaLabs]',
  shortTitle: 'Fibonacci Moving Averages [UkutaLabs]',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<FibonacciMovingAveragesInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const src = getSourceSeries(bars, cfg.maSource);
  const volume = Series.fromArray(bars, bars.map((b) => b.volume ?? NaN));

  // MA(maSource, maType, maPeriod): the type is a constant input, one branch runs on every bar
  const ma = (len: number): number[] => {
    switch (cfg.maType) {
      case 'EMA':
        return A(ta.ema(src, len));
      case 'SMA':
        return A(ta.sma(src, len));
      case 'VWMA':
        return A(ta.vwma(src, len, volume));
      case 'WMA':
        return A(ta.wma(src, len));
      case 'HMA':
        return A(ta.hma(src, len));
      default:
        return A(ta.rma(src, len));
    }
  };

  const hidden = String(color.new('#ffffff', 100));
  const plots: IndicatorResult['plots'] = {};
  LENGTHS.forEach((len, k) => {
    const values = ma(len);
    const c = (cfg as unknown as Record<string, boolean>)[`enable${len}`]
      ? (cfg as unknown as Record<string, string>)[`color${len}`] : hidden;
    plots[`plot${k}`] = bars.map((b, i) => ({ time: b.time, value: values[i], color: c }));
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
  };
}

export const FibonacciMovingAverages = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
