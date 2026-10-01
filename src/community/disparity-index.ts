/**
 * Disparity Index
 *
 * Percent distance of the close from three EMAs (200, 50 and 20 bars by default):
 * DIX = 100 * (close - ema(close, len)) / ema(close, len). Each line can be hidden. A dotted line at 0.
 *
 * Reference: "Disparity Index" by HPotter
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Copyright by HPotter v1.0 12/09/2014. The related article is copyrighted material from Stocks &
 * Commodities Dec 2009.
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface DisparityIndexInputs {
  /** EMA length of the first line */
  lengthFirst: number;
  /** EMA length of the second line */
  lengthSecond: number;
  /** EMA length of the third line */
  lengthThird: number;
  showFirst: boolean;
  showSecond: boolean;
  showThird: boolean;
}

export const defaultInputs: DisparityIndexInputs = {
  lengthFirst: 200,
  lengthSecond: 50,
  lengthThird: 20,
  showFirst: true,
  showSecond: true,
  showThird: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'lengthFirst', type: 'int', title: 'LengthFirst', defval: 200, min: 1 },
  { id: 'lengthSecond', type: 'int', title: 'LengthSecond', defval: 50, min: 1 },
  { id: 'lengthThird', type: 'int', title: 'LengthThird', defval: 20, min: 1 },
  { id: 'showFirst', type: 'bool', title: 'ShowFirst', defval: true },
  { id: 'showSecond', type: 'bool', title: 'ShowSecond', defval: true },
  { id: 'showThird', type: 'bool', title: 'ShowThird', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'DIX 1', color: color.red, lineWidth: 1 },
  { id: 'plot1', title: 'DIX 2', color: color.blue, lineWidth: 1 },
  { id: 'plot2', title: 'DIX 3', color: color.green, lineWidth: 1 },
];

export const metadata = {
  title: 'CMOaDisparity Index',
  shortTitle: 'CMOaDisparity Index',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<DisparityIndexInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const close = Series.fromArray(bars, bars.map((b) => b.close));

  // xRes = 100 * (close - ema) / ema: a plain division (x / 0 is +-infinity, shown as na)
  const line = (len: number, show: boolean, col: string) => {
    const ema = A(ta.ema(close, len));
    return bars.map((b, i) => {
      const v = (100 * (b.close - ema[i])) / ema[i];
      return { time: b.time, value: show && Number.isFinite(v) ? v : NaN, color: col };
    });
  };

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: line(cfg.lengthFirst, cfg.showFirst, color.red),
      plot1: line(cfg.lengthSecond, cfg.showSecond, color.blue),
      plot2: line(cfg.lengthThird, cfg.showThird, color.green),
    },
    hlines: [{ value: 0, options: { title: '0', color: String(color.new(color.yellow, 0)), linestyle: 'dotted' } }],
  };
}

export const DisparityIndex = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
