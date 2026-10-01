/**
 * MA Zones
 *
 * Three zones, each made of an EMA and an SMA of the close with the same period (50, 100 and 200 by default).
 * The space between the EMA and the SMA of a zone is filled.
 *
 * Reference: "MA Zones" by ZenAndTheArtOfTrading
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © ZenAndTheArtOfTrading | PineScriptMastery
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface MAZonesInputs {
  showZone1: boolean;
  showZone2: boolean;
  showZone3: boolean;
  /** Period of the EMA and SMA of zone 1 */
  zone1: number;
  /** Period of the EMA and SMA of zone 2 */
  zone2: number;
  /** Period of the EMA and SMA of zone 3 */
  zone3: number;
}

export const defaultInputs: MAZonesInputs = {
  showZone1: true,
  showZone2: true,
  showZone3: true,
  zone1: 50,
  zone2: 100,
  zone3: 200,
};

export const inputConfig: InputConfig[] = [
  { id: 'showZone1', type: 'bool', title: 'Show Zone 1?', defval: true },
  { id: 'showZone2', type: 'bool', title: 'Show Zone 2?', defval: true },
  { id: 'showZone3', type: 'bool', title: 'Show Zone 3?', defval: true },
  { id: 'zone1', type: 'int', title: 'Zone 1 Period', defval: 50, min: 1 },
  { id: 'zone2', type: 'int', title: 'Zone 2 Period', defval: 100, min: 1 },
  { id: 'zone3', type: 'int', title: 'Zone 3 Period', defval: 200, min: 1 },
];

const lime = String(color.new(color.lime, 50));
const orange = String(color.new(color.orange, 50));
const red = String(color.new(color.red, 50));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA 1', color: lime, lineWidth: 1 },
  { id: 'plot1', title: 'SMA 1', color: lime, lineWidth: 1 },
  { id: 'plot2', title: 'EMA 2', color: orange, lineWidth: 1 },
  { id: 'plot3', title: 'SMA 2', color: orange, lineWidth: 1 },
  { id: 'plot4', title: 'EMA 3', color: red, lineWidth: 1 },
  { id: 'plot5', title: 'SMA 3', color: red, lineWidth: 1 },
];

export const metadata = {
  title: 'MA Zones',
  shortTitle: 'MAZ',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<MAZonesInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const close = Series.fromArray(bars, bars.map((b) => b.close));

  const ema1 = A(ta.ema(close, cfg.zone1));
  const ema2 = A(ta.ema(close, cfg.zone2));
  const ema3 = A(ta.ema(close, cfg.zone3));
  const ma1 = A(ta.sma(close, cfg.zone1));
  const ma2 = A(ta.sma(close, cfg.zone2));
  const ma3 = A(ta.sma(close, cfg.zone3));

  // plot(showZoneN ? x : na, ...)
  const line = (show: boolean, v: number[], c: string) =>
    bars.map((b, i) => ({ time: b.time, value: show ? v[i] : NaN, color: c }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: line(cfg.showZone1, ema1, lime),
      plot1: line(cfg.showZone1, ma1, lime),
      plot2: line(cfg.showZone2, ema2, orange),
      plot3: line(cfg.showZone2, ma2, orange),
      plot4: line(cfg.showZone3, ema3, red),
      plot5: line(cfg.showZone3, ma3, red),
    },
    fills: [
      { plot1: 'plot0', plot2: 'plot1', options: { title: 'Zone of Value 1', color: String(color.new(color.lime, 75)) } },
      { plot1: 'plot2', plot2: 'plot3', options: { title: 'Zone of Value 2', color: String(color.new(color.orange, 75)) } },
      { plot1: 'plot4', plot2: 'plot5', options: { title: 'Zone of Value 3', color: String(color.new(color.red, 75)) } },
    ],
  };
}

export const MAZones = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
