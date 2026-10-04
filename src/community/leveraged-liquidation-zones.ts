/**
 * Leveraged Liquidation Zones
 *
 * Estimated liquidation bands around the previous close for 25x, 50x, 75x and 100x leverage:
 * upper = close[1] + close[1] / leverage, lower = close[1] - close[1] / leverage. Each band pair is filled with
 * the colour of its leverage level.
 *
 * Reference: "Leveraged Liquidation Zones" by Fussion_Trader
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © mrfussion
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type FillConfig, type Bar } from 'oakscriptjs';

export interface LeveragedLiquidationZonesInputs {
  show100x: boolean;
  show75x: boolean;
  show50x: boolean;
  show25x: boolean;
  color100x: string;
  color75x: string;
  color50x: string;
  color25x: string;
}

const C100 = String(color.new(color.red, 80));
const C75 = String(color.new(color.orange, 80));
const C50 = String(color.new(color.yellow, 80));
const C25 = String(color.new(color.green, 80));

export const defaultInputs: LeveragedLiquidationZonesInputs = {
  show100x: true,
  show75x: true,
  show50x: true,
  show25x: true,
  color100x: C100,
  color75x: C75,
  color50x: C50,
  color25x: C25,
};

export const inputConfig: InputConfig[] = [
  { id: 'show100x', type: 'bool', title: 'Show 100x', defval: true },
  { id: 'show75x', type: 'bool', title: 'Show 75x', defval: true },
  { id: 'show50x', type: 'bool', title: 'Show 50x', defval: true },
  { id: 'show25x', type: 'bool', title: 'Show 25x', defval: true },
  { id: 'color100x', type: 'color', title: 'Color 100x', defval: C100 },
  { id: 'color75x', type: 'color', title: 'Color 75x', defval: C75 },
  { id: 'color50x', type: 'color', title: 'Color 50x', defval: C50 },
  { id: 'color25x', type: 'color', title: 'Color 25x', defval: C25 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '25x Sup', color: C25, lineWidth: 1 },
  { id: 'plot1', title: '25x Inf', color: C25, lineWidth: 1 },
  { id: 'plot2', title: '50x Sup', color: C50, lineWidth: 1 },
  { id: 'plot3', title: '50x Inf', color: C50, lineWidth: 1 },
  { id: 'plot4', title: '75x Sup', color: C75, lineWidth: 1 },
  { id: 'plot5', title: '75x Inf', color: C75, lineWidth: 1 },
  { id: 'plot6', title: '100x Sup', color: C100, lineWidth: 1 },
  { id: 'plot7', title: '100x Inf', color: C100, lineWidth: 1 },
];

/** fill(plot_hi_X, plot_lo_X, color = color_X) for each leverage level */
export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot0', plot2: 'plot1', color: C25 },
  { id: 'fill1', plot1: 'plot2', plot2: 'plot3', color: C50 },
  { id: 'fill2', plot1: 'plot4', plot2: 'plot5', color: C75 },
  { id: 'fill3', plot1: 'plot6', plot2: 'plot7', color: C100 },
];

export const metadata = {
  title: 'Leveraged Liquidation Zones',
  shortTitle: 'Leveraged Liquidation Zones',
  overlay: true,
};

type Point = { time: number; value: number; color: string };

export function calculate(bars: Bar[], inputs: Partial<LeveragedLiquidationZonesInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };

  // ref_price = close[1]; liq_band(price, lev) => [price + price / lev, price - price / lev]
  const band = (show: boolean, lev: number, upper: boolean, col: string): Point[] => bars.map((b, i) => {
    const price = i > 0 ? bars[i - 1].close : NaN;
    const delta = price / lev;
    return { time: b.time, value: show ? (upper ? price + delta : price - delta) : NaN, color: col };
  });

  // fill colours, one per bar
  const fill = (col: string) => new Array<string>(bars.length).fill(col);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: band(cfg.show25x, 25, true, cfg.color25x),
      plot1: band(cfg.show25x, 25, false, cfg.color25x),
      plot2: band(cfg.show50x, 50, true, cfg.color50x),
      plot3: band(cfg.show50x, 50, false, cfg.color50x),
      plot4: band(cfg.show75x, 75, true, cfg.color75x),
      plot5: band(cfg.show75x, 75, false, cfg.color75x),
      plot6: band(cfg.show100x, 100, true, cfg.color100x),
      plot7: band(cfg.show100x, 100, false, cfg.color100x),
    },
    fills: [
      { plot1: 'plot0', plot2: 'plot1', options: { color: cfg.color25x }, colors: fill(cfg.color25x) },
      { plot1: 'plot2', plot2: 'plot3', options: { color: cfg.color50x }, colors: fill(cfg.color50x) },
      { plot1: 'plot4', plot2: 'plot5', options: { color: cfg.color75x }, colors: fill(cfg.color75x) },
      { plot1: 'plot6', plot2: 'plot7', options: { color: cfg.color100x }, colors: fill(cfg.color100x) },
    ],
  };
}

export const LeveragedLiquidationZones = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
};
