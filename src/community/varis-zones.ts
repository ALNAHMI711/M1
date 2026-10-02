/**
 * VARIS Zones
 *
 * A VWAP of the typical price (hlc3) that restarts on the bar that opens at 18:00 New York time (the time zone is
 * fixed: "America/New_York"), with two pairs of bands at a fixed distance in points (half risk interval and full risk
 * interval) and fills between the VWAP and each band.
 *
 * Reference: "VARIS Zones" by IAmTheLiquidity2
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, time, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface VarisZonesInputs {
  showVWAP: boolean;
  showUpper1: boolean;
  showLower1: boolean;
  showUpper2: boolean;
  showLower2: boolean;
  /** Distance of band 1 from the VWAP (points) */
  band1Points: number;
  /** Distance of band 2 from the VWAP (points) */
  band2Points: number;
  vwapColor: string;
  /** VWAP line width (the plot width stays the default 1 in the port) */
  vwapWidth: number;
  upper1Color: string;
  upper1Width: number;
  lower1Color: string;
  lower1Width: number;
  upper2Color: string;
  upper2Width: number;
  lower2Color: string;
  lower2Width: number;
  showFill1: boolean;
  fill1Color: string;
  fill1Trans: number;
  showFill2: boolean;
  fill2Color: string;
  fill2Trans: number;
}

export const defaultInputs: VarisZonesInputs = {
  showVWAP: true,
  showUpper1: true,
  showLower1: true,
  showUpper2: true,
  showLower2: true,
  band1Points: 10.0,
  band2Points: 25.0,
  vwapColor: 'rgba(255, 0, 0, 0.9)',
  vwapWidth: 1,
  upper1Color: 'rgba(0, 0, 0, 0.1)',
  upper1Width: 1,
  lower1Color: 'rgba(0, 0, 0, 0.1)',
  lower1Width: 1,
  upper2Color: 'rgba(0, 0, 0, 0)',
  upper2Width: 1,
  lower2Color: 'rgba(0, 0, 0, 0)',
  lower2Width: 1,
  showFill1: true,
  fill1Color: 'rgb(255, 255, 255)',
  fill1Trans: 75,
  showFill2: true,
  fill2Color: 'rgb(0, 0, 0)',
  fill2Trans: 90,
};

export const inputConfig: InputConfig[] = [
  { id: 'showVWAP', type: 'bool', title: 'Show VWAP', defval: true },
  { id: 'showUpper1', type: 'bool', title: 'Show Upper Band 1', defval: true },
  { id: 'showLower1', type: 'bool', title: 'Show Lower Band 1', defval: true },
  { id: 'showUpper2', type: 'bool', title: 'Show Upper Band 2', defval: true },
  { id: 'showLower2', type: 'bool', title: 'Show Lower Band 2', defval: true },
  { id: 'band1Points', type: 'float', title: '1/2 Risk Interval (Points)', defval: 10.0, min: 0.001, step: 0.25 },
  { id: 'band2Points', type: 'float', title: '1 Full Risk Interval (Points)', defval: 25.0, min: 0.0, step: 0.25 },
  { id: 'vwapColor', type: 'color', title: 'VWAP Line Color', defval: 'rgba(255, 0, 0, 0.9)' },
  { id: 'vwapWidth', type: 'int', title: 'VWAP Line Width', defval: 1, min: 1, max: 5 },
  { id: 'upper1Color', type: 'color', title: 'Upper Band 1 Color', defval: 'rgba(0, 0, 0, 0.1)' },
  { id: 'upper1Width', type: 'int', title: 'Upper Band 1 Width', defval: 1, min: 1, max: 5 },
  { id: 'lower1Color', type: 'color', title: 'Lower Band 1 Color', defval: 'rgba(0, 0, 0, 0.1)' },
  { id: 'lower1Width', type: 'int', title: 'Lower Band 1 Width', defval: 1, min: 1, max: 5 },
  { id: 'upper2Color', type: 'color', title: 'Upper Band 2 Color', defval: 'rgba(0, 0, 0, 0)' },
  { id: 'upper2Width', type: 'int', title: 'Upper Band 2 Width', defval: 1, min: 1, max: 5 },
  { id: 'lower2Color', type: 'color', title: 'Lower Band 2 Color', defval: 'rgba(0, 0, 0, 0)' },
  { id: 'lower2Width', type: 'int', title: 'Lower Band 2 Width', defval: 1, min: 1, max: 5 },
  { id: 'showFill1', type: 'bool', title: 'Show Fill Band 1', defval: true },
  { id: 'fill1Color', type: 'color', title: 'Band 1 Fill Color', defval: 'rgb(255, 255, 255)' },
  { id: 'fill1Trans', type: 'int', title: 'Band 1 Fill Transparency', defval: 75, min: 0, max: 100 },
  { id: 'showFill2', type: 'bool', title: 'Show Fill Band 2', defval: true },
  { id: 'fill2Color', type: 'color', title: 'Band 2 Fill Color', defval: 'rgb(0, 0, 0)' },
  { id: 'fill2Trans', type: 'int', title: 'Band 2 Fill Transparency', defval: 90, min: 0, max: 100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VWAP', color: 'rgba(255, 0, 0, 0.9)', lineWidth: 1 },
  { id: 'plot1', title: 'Upper Band 1', color: 'rgba(0, 0, 0, 0.1)', lineWidth: 1 },
  { id: 'plot2', title: 'Lower Band 1', color: 'rgba(0, 0, 0, 0.1)', lineWidth: 1 },
  { id: 'plot3', title: 'Upper Band 2', color: 'rgba(0, 0, 0, 0)', lineWidth: 1 },
  { id: 'plot4', title: 'Lower Band 2', color: 'rgba(0, 0, 0, 0)', lineWidth: 1 },
];

export const metadata = {
  title: 'VARIS Zones',
  shortTitle: 'VARIS Zones',
  overlay: true,
};

/** Pine float comparisons: a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;

const TZ = 'America/New_York';

export function calculate(bars: Bar[], inputs: Partial<VarisZonesInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // var float cumTPV / cumVol; reset on the bar that opens at 18:00 New York time
  const vwap: number[] = new Array(n);
  let cumTPV = 0;
  let cumVol = 0;
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const ms = b.time * 1000;
    const isNewSession = time.hour(ms, TZ) === 18 && time.minute(ms, TZ) === 0;
    const tp = (b.high + b.low + b.close) / 3;
    const volume = b.volume ?? NaN;
    if (isNewSession) {
      cumTPV = tp * volume;
      cumVol = volume;
    } else {
      cumTPV += tp * volume;
      cumVol += volume;
    }
    // vwapValue = cumVol != 0 ? cumTPV / cumVol : na
    vwap[i] = ne(cumVol, 0) ? cumTPV / cumVol : NaN;
  }

  const line = (show: boolean, d: number, c: string) =>
    bars.map((b, i) => ({ time: b.time, value: show ? vwap[i] + d : NaN, color: c }));
  const plot0 = line(cfg.showVWAP, 0, cfg.vwapColor);
  const plot1 = line(cfg.showUpper1, cfg.band1Points, cfg.upper1Color);
  const plot2 = line(cfg.showLower1, -cfg.band1Points, cfg.lower1Color);
  const plot3 = line(cfg.showUpper2, cfg.band2Points, cfg.upper2Color);
  const plot4 = line(cfg.showLower2, -cfg.band2Points, cfg.lower2Color);

  // fill(vwapPlot, upper1Plot, color = showFill1 and showUpper1 ? color.new(fill1Color, fill1Trans) : na, ...)
  const fill1 = String(color.new(cfg.fill1Color, cfg.fill1Trans));
  const fill2 = String(color.new(cfg.fill2Color, cfg.fill2Trans));
  const fillColors = (on: boolean, c: string) => new Array<string>(n).fill(on ? c : 'transparent');

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2, plot3, plot4 },
    fills: [
      { plot1: 'plot0', plot2: 'plot1', options: { title: 'Upper Fill 1' }, colors: fillColors(cfg.showFill1 && cfg.showUpper1, fill1) },
      { plot1: 'plot0', plot2: 'plot2', options: { title: 'Lower Fill 1' }, colors: fillColors(cfg.showFill1 && cfg.showLower1, fill1) },
      { plot1: 'plot0', plot2: 'plot3', options: { title: 'Upper Fill 2' }, colors: fillColors(cfg.showFill2 && cfg.showUpper2, fill2) },
      { plot1: 'plot0', plot2: 'plot4', options: { title: 'Lower Fill 2' }, colors: fillColors(cfg.showFill2 && cfg.showLower2, fill2) },
    ],
  };
}

export const VarisZones = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
