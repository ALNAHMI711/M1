/**
 * ERD: Effort-Result Diagnostic
 *
 * Over the last `Lookback Period` bars, the upper band is the high of the bullish bar (close > open) with the highest
 * volume, and the lower band is the low of the bearish bar (close < open) with the highest volume (Flip Logic swaps
 * the two volume sets). When no bar of the window has a larger volume than the current bar's (0 for a bar of the other
 * direction), the current bar is used. The middle line is the average of the two bands; the area between the bands is
 * filled.
 *
 * Reference: "ERD: Effort-Result Diagnostic [Darwinian]" by DarwinDarma
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface ErdEffortResultDiagnosticInputs {
  /** Number of bars searched for the highest volume */
  length: number;
  /** Show the middle line */
  showMiddle: boolean;
  /** Upper band from the bearish volume, lower band from the bullish volume */
  flipLogic: boolean;
  upperColor: string;
  lowerColor: string;
  middleColor: string;
  /** Band line width (the plot width of the port stays at the default 2) */
  bandLineWidth: number;
}

const UPPER_COL = String(color.new(color.green, 0));
const LOWER_COL = String(color.new(color.red, 0));
const MIDDLE_COL = String(color.new(color.black, 40));

export const defaultInputs: ErdEffortResultDiagnosticInputs = {
  length: 30,
  showMiddle: true,
  flipLogic: false,
  upperColor: UPPER_COL,
  lowerColor: LOWER_COL,
  middleColor: MIDDLE_COL,
  bandLineWidth: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Lookback Period', defval: 30, min: 1 },
  { id: 'showMiddle', type: 'bool', title: 'Show Middle Line', defval: true },
  { id: 'flipLogic', type: 'bool', title: 'Flip Logic (High=Red Vol, Low=Green Vol)', defval: false },
  { id: 'upperColor', type: 'color', title: 'Upper Band Color', defval: UPPER_COL },
  { id: 'lowerColor', type: 'color', title: 'Lower Band Color', defval: LOWER_COL },
  { id: 'middleColor', type: 'color', title: 'Middle Line Color', defval: MIDDLE_COL },
  { id: 'bandLineWidth', type: 'int', title: 'Band Line Width', defval: 2, min: 1, max: 5 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Band', color: UPPER_COL, lineWidth: 2, style: 'stepline' },
  { id: 'plot1', title: 'Lower Band', color: LOWER_COL, lineWidth: 2, style: 'stepline' },
  { id: 'plot2', title: 'Middle Line', color: MIDDLE_COL, lineWidth: 1, style: 'circles' },
];

export const metadata = {
  title: 'ERD: Effort-Result Diagnostic [Darwinian]',
  shortTitle: 'ERD',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;

export function calculate(bars: Bar[], inputs: Partial<ErdEffortResultDiagnosticInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // greenVolume = close > open ? volume : 0.0; redVolume = close < open ? volume : 0.0
  const greenVolume = bars.map((b) => (gt(b.close, b.open) ? b.volume ?? NaN : 0));
  const redVolume = bars.map((b) => (gt(b.open, b.close) ? b.volume ?? NaN : 0));
  const upperVol = cfg.flipLogic ? redVolume : greenVolume;
  const lowerVol = cfg.flipLogic ? greenVolume : redVolume;
  const at = (a: number[], j: number) => (j >= 0 ? a[j] : NaN);
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);

  const upperBand: number[] = new Array(n);
  const lowerBand: number[] = new Array(n);
  for (let idx = 0; idx < n; idx++) {
    // for i = 0 to length - 1: if vol > maxVol or i == 0 -> maxVol := vol, band := high[i] / low[i]
    let maxUpper = 0;
    let up = NaN;
    for (let i = 0; i <= cfg.length - 1; i++) {
      const vol = at(upperVol, idx - i);
      if (gt(vol, maxUpper) || i === 0) {
        maxUpper = vol;
        up = at(high, idx - i);
      }
    }
    let maxLower = 0;
    let lo = NaN;
    for (let i = 0; i <= cfg.length - 1; i++) {
      const vol = at(lowerVol, idx - i);
      if (gt(vol, maxLower) || i === 0) {
        maxLower = vol;
        lo = at(low, idx - i);
      }
    }
    upperBand[idx] = up;
    lowerBand[idx] = lo;
  }

  const fillColor = String(color.new(color.blue, 95));
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: upperBand[i], color: cfg.upperColor })),
      plot1: bars.map((b, i) => ({ time: b.time, value: lowerBand[i], color: cfg.lowerColor })),
      // plot(showMiddle ? middleBand : na, 'Middle Line', style = plot.style_circles)
      plot2: bars.map((b, i) => ({
        time: b.time, value: cfg.showMiddle ? (upperBand[i] + lowerBand[i]) / 2 : NaN, color: cfg.middleColor,
      })),
    },
    // fill(p1, p2, color = color.new(color.blue, 95), title = 'Channel Fill')
    fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: fillColor, title: 'Channel Fill' } }],
  };
}

export const ErdEffortResultDiagnostic = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
