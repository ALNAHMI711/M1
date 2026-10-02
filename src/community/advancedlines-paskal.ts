/**
 * AdvancedLines (FiboBands)
 *
 * Bands from the highest high and the lowest low of the last `bandLength` bars, a midline (average of the two
 * bands) and Fibonacci levels between them: level = lower band + (upper band - lower band) * ratio. Five inner
 * levels (0.764, 0.618, 0.5, 0.382, 0.236) are shown by default; six extension levels (1.236, 1.382, 1.618,
 * -0.236, -0.382, -0.618) are hidden by default. The bands and the levels are hidden when "Show High / Low Bands"
 * is off. Fills between the upper band and the 0.764 level and between the lower band and the 0.236 level.
 *
 * Reference: "AdvancedLines (FiboBands) - PaSKaL" by uPaSKaL
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface AdvancedLinesPaskalInputs {
  /** Bands period (highest high / lowest low window) */
  bandLength: number;
  showBands: boolean;
  showMidline: boolean;
  fiboRatio0764: number;
  fiboRatio0618: number;
  fiboRatio0500: number;
  fiboRatio0382: number;
  fiboRatio0236: number;
  showFibo0764: boolean;
  showFibo0618: boolean;
  showFibo0500: boolean;
  showFibo0382: boolean;
  showFibo0236: boolean;
  color0764: string;
  color0618: string;
  color0500: string;
  color0382: string;
  color0236: string;
  /** Fill between the upper band and the 0.764 level */
  fillUpperColor: string;
  /** Fill between the lower band and the 0.236 level */
  fillLowerColor: string;
  fiboRatio1236: number;
  fiboRatio1382: number;
  fiboRatio1618: number;
  fiboRatioM0236: number;
  fiboRatioM0382: number;
  fiboRatioM0618: number;
  showFibo1236: boolean;
  showFibo1382: boolean;
  showFibo1618: boolean;
  showFiboM0236: boolean;
  showFiboM0382: boolean;
  showFiboM0618: boolean;
  color1236: string;
  color1382: string;
  color1618: string;
  colorM0236: string;
  colorM0382: string;
  colorM0618: string;
}

// input.color(color.new(color.green, 90)) / color.new(color.red, 90): stored with alpha 0.1, byte 26
const FILL_UPPER_DEFAULT = '#4CAF501A';
const FILL_LOWER_DEFAULT = '#F236451A';

export const defaultInputs: AdvancedLinesPaskalInputs = {
  bandLength: 300,
  showBands: true,
  showMidline: true,
  fiboRatio0764: 0.764,
  fiboRatio0618: 0.618,
  fiboRatio0500: 0.5,
  fiboRatio0382: 0.382,
  fiboRatio0236: 0.236,
  showFibo0764: true,
  showFibo0618: true,
  showFibo0500: true,
  showFibo0382: true,
  showFibo0236: true,
  color0764: color.yellow,
  color0618: color.orange,
  color0500: color.green,
  color0382: color.red,
  color0236: color.blue,
  fillUpperColor: FILL_UPPER_DEFAULT,
  fillLowerColor: FILL_LOWER_DEFAULT,
  fiboRatio1236: 1.236,
  fiboRatio1382: 1.382,
  fiboRatio1618: 1.618,
  fiboRatioM0236: -0.236,
  fiboRatioM0382: -0.382,
  fiboRatioM0618: -0.618,
  showFibo1236: false,
  showFibo1382: false,
  showFibo1618: false,
  showFiboM0236: false,
  showFiboM0382: false,
  showFiboM0618: false,
  color1236: color.fuchsia,
  color1382: color.purple,
  color1618: color.maroon,
  colorM0236: color.teal,
  colorM0382: color.navy,
  colorM0618: color.olive,
};

const G = 'Advanced Lines Settings';

export const inputConfig: InputConfig[] = [
  { id: 'bandLength', type: 'int', title: 'Bands Period', defval: 300, group: G },
  { id: 'showBands', type: 'bool', title: 'Show High / Low Bands', defval: true, group: G },
  { id: 'showMidline', type: 'bool', title: 'Show Midline', defval: true, group: G },
  { id: 'fiboRatio0764', type: 'float', title: 'Fibo Level 0.764', defval: 0.764, group: G },
  { id: 'fiboRatio0618', type: 'float', title: 'Fibo Level 0.618', defval: 0.618, group: G },
  { id: 'fiboRatio0500', type: 'float', title: 'Fibo Level 0.5', defval: 0.5, group: G },
  { id: 'fiboRatio0382', type: 'float', title: 'Fibo Level 0.382', defval: 0.382, group: G },
  { id: 'fiboRatio0236', type: 'float', title: 'Fibo Level 0.236', defval: 0.236, group: G },
  { id: 'showFibo0764', type: 'bool', title: 'Show Fibo Level 0.764', defval: true, group: G },
  { id: 'showFibo0618', type: 'bool', title: 'Show Fibo Level 0.618', defval: true, group: G },
  { id: 'showFibo0500', type: 'bool', title: 'Show Fibo Level 0.5', defval: true, group: G },
  { id: 'showFibo0382', type: 'bool', title: 'Show Fibo Level 0.382', defval: true, group: G },
  { id: 'showFibo0236', type: 'bool', title: 'Show Fibo Level 0.236', defval: true, group: G },
  { id: 'color0764', type: 'color', title: 'Fibo 0.764 Color', defval: color.yellow, group: G },
  { id: 'color0618', type: 'color', title: 'Fibo 0.618 Color', defval: color.orange, group: G },
  { id: 'color0500', type: 'color', title: 'Fibo 0.5 Color', defval: color.green, group: G },
  { id: 'color0382', type: 'color', title: 'Fibo 0.382 Color', defval: color.red, group: G },
  { id: 'color0236', type: 'color', title: 'Fibo 0.236 Color', defval: color.blue, group: G },
  { id: 'fillUpperColor', type: 'color', title: 'Fill Upper Band ↔ 0.764', defval: FILL_UPPER_DEFAULT, group: G },
  { id: 'fillLowerColor', type: 'color', title: 'Fill Lower Band ↔ 0.236', defval: FILL_LOWER_DEFAULT, group: G },
  { id: 'fiboRatio1236', type: 'float', title: 'Fibo Level 1.236', defval: 1.236, group: G },
  { id: 'fiboRatio1382', type: 'float', title: 'Fibo Level 1.382', defval: 1.382, group: G },
  { id: 'fiboRatio1618', type: 'float', title: 'Fibo Level 1.618', defval: 1.618, group: G },
  { id: 'fiboRatioM0236', type: 'float', title: 'Fibo Level -0.236', defval: -0.236, group: G },
  { id: 'fiboRatioM0382', type: 'float', title: 'Fibo Level -0.382', defval: -0.382, group: G },
  { id: 'fiboRatioM0618', type: 'float', title: 'Fibo Level -0.618', defval: -0.618, group: G },
  { id: 'showFibo1236', type: 'bool', title: 'Show Fibo Level 1.236', defval: false, group: G },
  { id: 'showFibo1382', type: 'bool', title: 'Show Fibo Level 1.382', defval: false, group: G },
  { id: 'showFibo1618', type: 'bool', title: 'Show Fibo Level 1.618', defval: false, group: G },
  { id: 'showFiboM0236', type: 'bool', title: 'Show Fibo Level -0.236', defval: false, group: G },
  { id: 'showFiboM0382', type: 'bool', title: 'Show Fibo Level -0.382', defval: false, group: G },
  { id: 'showFiboM0618', type: 'bool', title: 'Show Fibo Level -0.618', defval: false, group: G },
  { id: 'color1236', type: 'color', title: 'Fibo 1.236 Color', defval: color.fuchsia, group: G },
  { id: 'color1382', type: 'color', title: 'Fibo 1.382 Color', defval: color.purple, group: G },
  { id: 'color1618', type: 'color', title: 'Fibo 1.618 Color', defval: color.maroon, group: G },
  { id: 'colorM0236', type: 'color', title: 'Fibo -0.236 Color', defval: color.teal, group: G },
  { id: 'colorM0382', type: 'color', title: 'Fibo -0.382 Color', defval: color.navy, group: G },
  { id: 'colorM0618', type: 'color', title: 'Fibo -0.618 Color', defval: color.olive, group: G },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Band', color: color.green, lineWidth: 1 },
  { id: 'plot1', title: 'Lower Band', color: color.red, lineWidth: 1 },
  { id: 'plot2', title: 'Midline', color: color.gray, lineWidth: 2 },
  { id: 'plot3', title: 'Fibo 0.764', color: color.yellow, lineWidth: 2 },
  { id: 'plot4', title: 'Fibo 0.618', color: color.orange, lineWidth: 2 },
  { id: 'plot5', title: 'Fibo 0.5', color: color.green, lineWidth: 2 },
  { id: 'plot6', title: 'Fibo 0.382', color: color.red, lineWidth: 2 },
  { id: 'plot7', title: 'Fibo 0.236', color: color.blue, lineWidth: 2 },
  { id: 'plot8', title: 'Fibo 1.236', color: color.fuchsia, lineWidth: 2 },
  { id: 'plot9', title: 'Fibo 1.382', color: color.purple, lineWidth: 2 },
  { id: 'plot10', title: 'Fibo 1.618', color: color.maroon, lineWidth: 2 },
  { id: 'plot11', title: 'Fibo -0.236', color: color.teal, lineWidth: 2 },
  { id: 'plot12', title: 'Fibo -0.382', color: color.navy, lineWidth: 2 },
  { id: 'plot13', title: 'Fibo -0.618', color: color.olive, lineWidth: 2 },
];

export const metadata = {
  title: 'AdvancedLines (FiboBands) - PaSKaL',
  shortTitle: 'AdvancedLines',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<AdvancedLinesPaskalInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  // bandHigh = ta.highest(high, bandLength); bandLow = ta.lowest(low, bandLength)
  const bandHigh = A(ta.highest(new Series(bars, (b) => b.high), cfg.bandLength));
  const bandLow = A(ta.lowest(new Series(bars, (b) => b.low), cfg.bandLength));

  const t = (i: number) => bars[i].time;
  const line = (f: (i: number) => number, c: string) => {
    const out: { time: number; value: number; color: string }[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const v = f(i);
      out[i] = { time: t(i), value: Number.isFinite(v) ? v : NaN, color: c };
    }
    return out;
  };
  // fibo = bandLow + bandRange * ratio, shown when its switch and showBands are on
  const level = (ratio: number, show: boolean, c: string) =>
    line((i) => (show && cfg.showBands ? bandLow[i] + (bandHigh[i] - bandLow[i]) * ratio : NaN), c);

  const plots = {
    plot0: line((i) => (cfg.showBands ? bandHigh[i] : NaN), color.green),
    plot1: line((i) => (cfg.showBands ? bandLow[i] : NaN), color.red),
    // bandMid = math.avg(bandHigh, bandLow), shown when showMidline is on
    plot2: line((i) => (cfg.showMidline ? (bandHigh[i] + bandLow[i]) / 2 : NaN), color.gray),
    plot3: level(cfg.fiboRatio0764, cfg.showFibo0764, cfg.color0764),
    plot4: level(cfg.fiboRatio0618, cfg.showFibo0618, cfg.color0618),
    plot5: level(cfg.fiboRatio0500, cfg.showFibo0500, cfg.color0500),
    plot6: level(cfg.fiboRatio0382, cfg.showFibo0382, cfg.color0382),
    plot7: level(cfg.fiboRatio0236, cfg.showFibo0236, cfg.color0236),
    plot8: level(cfg.fiboRatio1236, cfg.showFibo1236, cfg.color1236),
    plot9: level(cfg.fiboRatio1382, cfg.showFibo1382, cfg.color1382),
    plot10: level(cfg.fiboRatio1618, cfg.showFibo1618, cfg.color1618),
    plot11: level(cfg.fiboRatioM0236, cfg.showFiboM0236, cfg.colorM0236),
    plot12: level(cfg.fiboRatioM0382, cfg.showFiboM0382, cfg.colorM0382),
    plot13: level(cfg.fiboRatioM0618, cfg.showFiboM0618, cfg.colorM0618),
  };

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills: [
      // fill(plotUpperBand, plotFibo_0764, color = fillUpperColor)
      { plot1: 'plot0', plot2: 'plot3', options: { title: 'Plots Background' }, colors: new Array(n).fill(cfg.fillUpperColor) },
      // fill(plotLowerBand, plotFibo_0236, color = fillLowerColor)
      { plot1: 'plot1', plot2: 'plot7', options: { title: 'Plots Background' }, colors: new Array(n).fill(cfg.fillLowerColor) },
    ],
  };
}

export const AdvancedLinesPaskal = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
