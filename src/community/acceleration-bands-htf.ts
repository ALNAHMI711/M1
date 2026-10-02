/**
 * Acceleration Bands HTF
 *
 * Acceleration Bands (Price Headley): the upper band is the SMA of high * (1 + 4 * (high - low) / (high + low)), the
 * lower band the SMA of low * (1 - 4 * (high - low) / (high + low)) and the middle line the SMA of the close, all over
 * `p` bars. The Pine script runs on the chart timeframe by default (indicator timeframe = ""); the extra Timeframe
 * setting of the original is not ported.
 *
 * Reference: "Acceleration Bands HTF" by ZoharCho
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © zoharcho. Thanks to © capissimo who provided the base code
 */

import { taCore, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface AccelerationBandsHtfInputs {
  /** Lookback window */
  p: number;
}

export const defaultInputs: AccelerationBandsHtfInputs = {
  p: 80,
};

export const inputConfig: InputConfig[] = [
  { id: 'p', type: 'int', title: 'Lookback Window (20,80)', defval: 80, min: 2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper', color: color.gray, lineWidth: 1 },
  { id: 'plot1', title: 'Lower', color: color.gray, lineWidth: 1 },
  { id: 'plot2', title: 'Middle', color: color.orange, lineWidth: 1 },
];

export const metadata = {
  title: 'Acceleration Bands HTF',
  shortTitle: 'Acceleration Bands HTF',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<AccelerationBandsHtfInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const na = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? NaN : v);

  // A plain division: high + low = 0 gives +-infinity (or na), skipped by ta.sma as na
  const upSrc = bars.map((b) => b.high * (1 + (4 * (b.high - b.low)) / (b.high + b.low)));
  const lowSrc = bars.map((b) => b.low * (1 - (4 * (b.high - b.low)) / (b.high + b.low)));
  const upper = taCore.sma(upSrc, cfg.p);
  const ma = taCore.sma(bars.map((b) => b.close), cfg.p);
  const lower = taCore.sma(lowSrc, cfg.p);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: na(upper[i]), color: color.gray })),
      plot1: bars.map((b, i) => ({ time: b.time, value: na(lower[i]), color: color.gray })),
      plot2: bars.map((b, i) => ({ time: b.time, value: na(ma[i]), color: color.orange })),
    },
  };
}

export const AccelerationBandsHtf = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
