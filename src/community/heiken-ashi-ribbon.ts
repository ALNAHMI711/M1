/**
 * Heiken Ashi Ribbon
 *
 * Heikin-Ashi values: open = (open + close) / 2 on the first 2 bars, then the average of the previous Heikin-Ashi
 * open and close; close = ohlc4; high / low = the bar high / low extended to the Heikin-Ashi open / close. An EMA
 * (or SMA) of each value gives a ribbon: the high / low lines are drawn, and the band between the open and close
 * lines is filled in the bullish colour when the averaged close is above the averaged open and EMA(13) of the source
 * is above EMA(21), EMA(34) and EMA(55); in the bearish colour in the opposite case; grey otherwise.
 *
 * Reference: "Heiken Ashi Ribbon [UkutaLabs]" by UkutaLabs
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © UkutaLabs
 */

import {
  ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';

export interface HeikenAshiRibbonInputs {
  /** Moving average type of the Heikin-Ashi values */
  HAMAType: 'EMA' | 'SMA';
  /** Moving average period */
  HAMAPeriod: number;
  /** Source of the trend EMAs (13, 21, 34, 55) */
  TMSource: SourceType;
  /** Colour of the high / low lines */
  borderColor: string;
  bullishColor: string;
  bearishColor: string;
}

export const defaultInputs: HeikenAshiRibbonInputs = {
  HAMAType: 'EMA',
  HAMAPeriod: 14,
  TMSource: 'close',
  borderColor: color.gray,
  bullishColor: color.lime,
  bearishColor: color.red,
};

export const inputConfig: InputConfig[] = [
  { id: 'HAMAType', type: 'string', title: 'Moving Average Type', defval: 'EMA', options: ['EMA', 'SMA'], group: 'Configuration' },
  { id: 'HAMAPeriod', type: 'int', title: 'Moving Average Period', defval: 14, group: 'Configuration' },
  { id: 'TMSource', type: 'source', title: 'Moving Average Input', defval: 'close', group: 'Moving Average' },
  { id: 'borderColor', type: 'color', title: 'Ribbon Border Color', defval: color.gray, group: 'Ribbon' },
  { id: 'bullishColor', type: 'color', title: 'Bullish Color', defval: color.lime, group: 'Ribbon' },
  { id: 'bearishColor', type: 'color', title: 'Bearish Color', defval: color.red, group: 'Ribbon' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA Open', color: 'transparent', lineWidth: 1 },
  { id: 'plot1', title: 'EMA Close', color: 'transparent', lineWidth: 1 },
  { id: 'plot2', title: 'EMA High', color: color.gray, lineWidth: 1 },
  { id: 'plot3', title: 'EMA Low', color: color.gray, lineWidth: 1 },
];

export const metadata = {
  title: 'Heiken Ashi Ribbon [UkutaLabs]',
  shortTitle: 'Heiken Ashi Ribbon [UkutaLabs]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(bars: Bar[], inputs: Partial<HeikenAshiRibbonInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const src = getSourceSeries(bars, cfg.TMSource);

  const emaSource = A(ta.ema(src, 13));
  const emaSlow = A(ta.ema(src, 55));
  const emaMed = A(ta.ema(src, 34));
  const emaFast = A(ta.ema(src, 21));

  // var float HAOpen / HAClose / HAHigh / HALow = 0
  const haOpen: number[] = new Array(n);
  const haClose: number[] = new Array(n);
  const haHigh: number[] = new Array(n);
  const haLow: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    haOpen[i] = i < 2 ? (b.open + b.close) / 2 : (haOpen[i - 1] + haClose[i - 1]) / 2;
    haClose[i] = (b.open + b.high + b.low + b.close) / 4;
    const hi = gt(haOpen[i], haClose[i]) ? haOpen[i] : haClose[i];
    haHigh[i] = gt(b.high, hi) ? b.high : hi;
    const lo = lt(haOpen[i], haClose[i]) ? haOpen[i] : haClose[i];
    haLow[i] = lt(b.low, lo) ? b.low : lo;
  }

  // HAMAType == "EMA" ? ta.ema(x, HAMAPeriod) : ta.sma(x, HAMAPeriod): the type is an input (same branch on every bar)
  const ma = (x: number[]) => A(cfg.HAMAType === 'EMA' ? ta.ema(S(x), cfg.HAMAPeriod) : ta.sma(S(x), cfg.HAMAPeriod));
  const maOpen = ma(haOpen);
  const maClose = ma(haClose);
  const maHigh = ma(haHigh);
  const maLow = ma(haLow);

  const bull = String(color.new(cfg.bullishColor, 0));
  const bear = String(color.new(cfg.bearishColor, 0));
  const neutral = String(color.new(color.gray, 60));
  const fillColors = bars.map((_b, i) => {
    const trendGreen = gt(emaSource[i], emaSlow[i]) && gt(emaSource[i], emaMed[i]) && gt(emaSource[i], emaFast[i]);
    const trendRed = lt(emaSource[i], emaSlow[i]) && lt(emaSource[i], emaMed[i]) && lt(emaSource[i], emaFast[i]);
    const haGreen = gt(maClose[i], maOpen[i]);
    const haRed = lt(maClose[i], maOpen[i]);
    return haGreen && trendGreen ? bull : haRed && trendRed ? bear : neutral;
  });

  const line = (v: number[], col?: string) => bars.map((b, i) => (col === undefined
    ? { time: b.time, value: v[i] } : { time: b.time, value: v[i], color: col }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: line(maOpen),
      plot1: line(maClose),
      plot2: line(maHigh, cfg.borderColor),
      plot3: line(maLow, cfg.borderColor),
    },
    // fill(MAO, MAC, ...)
    fills: [{ plot1: 'plot0', plot2: 'plot1', colors: fillColors }],
  };
}

export const HeikenAshiRibbon = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
