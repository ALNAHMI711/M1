/**
 * RSI Confirm Trend with Williams (W%R)
 *
 * RSI(14) of the close with an SMA / EMA of it. The background shows the trend: green when the RSI is at or above
 * the upper threshold and Williams %R(14) is at or above -20, light cyan when only the RSI is at or above the upper
 * threshold, red when the RSI is at or below the lower threshold and Williams %R is at or below -80, pink when only
 * the RSI is at or below the lower threshold. Dotted lines at both thresholds with a fill between them.
 *
 * Reference: "RSI Confirm Trend with Williams (W%R)" by javageek
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © javageek
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';

export interface RsiConfirmTrendWithWilliamsInputs {
  /** RSI upper threshold */
  obr: number;
  /** RSI lower threshold */
  osr: number;
  /** Type of the RSI moving average */
  maType: 'SMA' | 'EMA';
  /** Length of the RSI moving average */
  maLength: number;
}

export const defaultInputs: RsiConfirmTrendWithWilliamsInputs = {
  obr: 55,
  osr: 45,
  maType: 'SMA',
  maLength: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'obr', type: 'int', title: 'RSI Upper Threshold', defval: 55 },
  { id: 'osr', type: 'int', title: 'RSI Lower Threshold', defval: 45 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'SMA', options: ['SMA', 'EMA'], display: 'data_window' },
  { id: 'maLength', type: 'int', title: 'MA Length', defval: 14, display: 'data_window' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'RSI MA', color: color.orange, lineWidth: 1 },
];

const THRESHOLD_FILL = String(color.new('#9598a1', 70));

/** hline(obr / osr, color.gray, hline.style_dotted) with the default values (the result `hlines` carry the inputs) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: 55, title: 'RSI Upper Threshold', color: color.gray, linestyle: 'dotted' },
  { id: 'hline_lower', price: 45, title: 'RSI Lower Threshold', color: color.gray, linestyle: 'dotted' },
];

/** fill(h3, h4, color.new(#9598a1, 70)) */
export const fillConfig: FillConfig[] = [
  { id: 'fill_threshold', plot1: 'hline_upper', plot2: 'hline_lower', color: THRESHOLD_FILL, title: 'RSI Threshold Background' },
];

export const metadata = {
  title: 'RSI Confirm Trend with Williams (W%R)',
  shortTitle: 'RSI W%R Trend',
  overlay: false,
};

/** Pine float comparisons: a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

export function calculate(
  bars: Bar[],
  inputs: Partial<RsiConfirmTrendWithWilliamsInputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  const percentR = A(ta.wpr(bars, 14));
  const rsiSeries = ta.rsi(Series.fromArray(bars, bars.map((b) => b.close)), 14);
  const rsi = A(rsiSeries);
  // ma(source, length, type): switch type "SMA" => ta.sma, "EMA" => ta.ema (no default: na)
  const rsiMA = cfg.maType === 'SMA' ? A(ta.sma(rsiSeries, cfg.maLength))
    : cfg.maType === 'EMA' ? A(ta.ema(rsiSeries, cfg.maLength)) : new Array<number>(n).fill(NaN);

  const green = String(color.new(color.green, 70));
  const cyan = String(color.new('#89ede5', 70));
  const red = String(color.new(color.red, 70));
  const pink = String(color.new('#f28ec3', 70));
  const bgColors: BgColorData[] = [];
  for (let i = 0; i < n; i++) {
    const up = ge(rsi[i], cfg.obr);
    const down = le(rsi[i], cfg.osr);
    const c = up && ge(percentR[i], -20) ? green : up ? cyan
      : down && le(percentR[i], -80) ? red : down ? pink : null;
    if (c) bgColors.push({ time: bars[i].time, color: c });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: 2 },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: rsi[i], color: color.blue })),
      plot1: bars.map((b, i) => ({ time: b.time, value: rsiMA[i], color: color.orange })),
    },
    hlines: [
      { value: cfg.obr, options: { title: 'RSI Upper Threshold', color: color.gray, linestyle: 'dotted' } },
      { value: cfg.osr, options: { title: 'RSI Lower Threshold', color: color.gray, linestyle: 'dotted' } },
    ],
    fills: [
      { plot1: 'hline_upper', plot2: 'hline_lower', options: { title: 'RSI Threshold Background' },
        colors: new Array<string>(n).fill(THRESHOLD_FILL) },
    ],
    bgColors,
  };
}

export const RsiConfirmTrendWithWilliams = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
