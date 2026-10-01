/**
 * Volume + RSI & MA Differential
 *
 * RSI(14) of the close, SMA(20) of the volume and two SMAs of the close (fast, slow). The volume SMA is drawn as
 * columns, light orange when the RSI is below the buy level with a volume above its SMA, pink when the RSI is above
 * the sell level with the close above the fast SMA, dark grey otherwise; the bars get the same signal colours (teal
 * when neutral). A line at 1 shows the MA differential diffMA = (fast SMA - slow SMA) * volume SMA / 2: dark when
 * diffMA rises, pink when it is above volume SMA / 2, light orange otherwise.
 *
 * Reference: "Volume + RSI & MA Differential" by ozzy_livin
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Copyright All rights reserved @ozzy_livin
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface VolumeRsiMaDifferentialInputs {
  /** RSI buy level (Pine input `low`) */
  rsiBuy: number;
  /** RSI sell level (Pine input `high`) */
  rsiSell: number;
  /** Fast SMA length */
  fastLength: number;
  /** Slow SMA length */
  slowLength: number;
}

export const defaultInputs: VolumeRsiMaDifferentialInputs = {
  rsiBuy: 35,
  rsiSell: 75,
  fastLength: 50,
  slowLength: 100,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiBuy', type: 'int', title: 'RSI Buy Signal', defval: 35 },
  { id: 'rsiSell', type: 'int', title: 'RSI Sell Signal', defval: 75 },
  { id: 'fastLength', type: 'int', title: 'Fast MA', defval: 50 },
  { id: 'slowLength', type: 'int', title: 'Slow MA', defval: 100 },
];

const BAR_BUY = String(color.new('#ffcc80', 0));
const BAR_SELL = String(color.new('#e91e63', 0));
const BAR_NEUTRAL = String(color.new('#0097a7', 0));
const COL_BUY = String(color.new('#ffcc80', 30));
const COL_SELL = String(color.new('#e91e63', 30));
const COL_NEUTRAL = String(color.new('#111111', 30));
const DIFF_UP = String(color.new('#111111', 0));
const DIFF_HIGH = String(color.new('#e91e63', 0));
const DIFF_LOW = String(color.new('#ffcc80', 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume MA Columns', color: COL_NEUTRAL, lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Volume MA', color: '#FFCD50', lineWidth: 1 },
  { id: 'plot2', title: 'MA Differential', color: DIFF_LOW, lineWidth: 4 },
];

export const metadata = {
  title: 'Volume + RSI & MA Differential',
  shortTitle: 'VRMA Differential',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<VolumeRsiMaDifferentialInputs> = {},
): IndicatorResult & { barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const close = bars.map((b) => b.close);
  const volume = bars.map((b) => b.volume ?? NaN);

  const rs = A(ta.rsi(S(close), 14));
  const volumeMA = A(ta.sma(S(volume), 20));
  const fastMA = A(ta.sma(S(close), cfg.fastLength));
  const slowMA = A(ta.sma(S(close), cfg.slowLength));
  // diffMA = (fastMA - slowMA) * (volumeMA / 2)
  const diffMA = bars.map((_b, i) => (fastMA[i] - slowMA[i]) * (volumeMA[i] / 2));

  const barColors: BarColorData[] = [];
  const plot0: { time: number; value: number; color: string }[] = [];
  const plot1: { time: number; value: number; color: string }[] = [];
  const plot2: { time: number; value: number; color: string }[] = [];
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    const buy = lt(rs[i], cfg.rsiBuy) && gt(volume[i], volumeMA[i]);
    const sell = gt(rs[i], cfg.rsiSell) && lt(fastMA[i], close[i]);
    // barcolor(rs < low and volume > volumeMA ? #ffcc80 : rs > high and fastMA < close ? #e91e63 : #0097a7)
    barColors.push({ time: t, color: buy ? BAR_BUY : sell ? BAR_SELL : BAR_NEUTRAL });
    // plot(volumeMA, color = ..., style = plot.style_columns)
    plot0.push({ time: t, value: volumeMA[i], color: buy ? COL_BUY : sell ? COL_SELL : COL_NEUTRAL });
    // plot(volumeMA, color = #FFCD50)
    plot1.push({ time: t, value: volumeMA[i], color: '#FFCD50' });
    // plot(1, color = diffMA > diffMA[1] ? #111111 : diffMA > volumeMA / 2 ? #e91e63 : #ffcc80, linewidth = 4)
    const prev = i > 0 ? diffMA[i - 1] : NaN;
    const c = gt(diffMA[i], prev) ? DIFF_UP : gt(diffMA[i], volumeMA[i] / 2) ? DIFF_HIGH : DIFF_LOW;
    plot2.push({ time: t, value: 1, color: c });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2 },
    barColors,
  };
}

export const VolumeRsiMaDifferential = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
