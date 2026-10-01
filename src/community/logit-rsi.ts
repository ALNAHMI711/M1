/**
 * Logit RSI [AdaptiveRSI]
 *
 * The RSI of the close is clamped to [1e-6, 100 - 1e-6] and mapped with the logit: ln(rsi / (100 - rsi)). The
 * standardized logit divides it by the RSI-length scale 2 / sqrt(length - 1), so different lengths are comparable.
 * The plotted line is the standardized logit, the logit or the plain RSI (input). With the standardized logit,
 * reference levels are drawn at 0, +-Body, +-Tail and optionally +-Breakout, +-Overextension. Optional Bollinger
 * Bands (SMA +- stdev * multiplier) of the plotted line, with a fill between the bands.
 *
 * Reference: "Logit RSI [AdaptiveRSI]" by AdaptiveRSI
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © AdaptiveRSI
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type FillConfig, type Bar } from 'oakscriptjs';

export type LogitRsiPlotType = 'standardized logit' | 'logit RSI' | 'regular RSI';

export interface LogitRsiInputs {
  /** RSI length */
  length: number;
  /** Plotted line: standardized logit, logit RSI or regular RSI */
  rsiType: LogitRsiPlotType;
  /** Show the Body and Tail levels (standardized logit only) */
  showLevels: boolean;
  bodyLevel: number;
  tailLevel: number;
  /** Show the Breakout and Overextension levels (standardized logit only) */
  showSecondaryLevels: boolean;
  breakoutLevel: number;
  overextLevel: number;
  /** Plot Bollinger Bands of the plotted line */
  showBB: boolean;
  /** Bollinger Bands length */
  maLength: number;
  /** Bollinger Bands standard deviation multiplier */
  bbMult: number;
}

export const defaultInputs: LogitRsiInputs = {
  length: 2,
  rsiType: 'standardized logit',
  showLevels: true,
  bodyLevel: 0.66,
  tailLevel: 2.14,
  showSecondaryLevels: false,
  breakoutLevel: 1.0,
  overextLevel: 1.73,
  showBB: false,
  maLength: 50,
  bbMult: 2.0,
};

const RSI_GROUP = 'RSI Settings';
const LEVEL_GROUP = 'STANDARDIZED LOGIT LEVELS';
const BB_GROUP = 'Bollinger Bands Settings';

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 2, min: 2, group: RSI_GROUP },
  { id: 'rsiType', type: 'string', title: 'RSI Plot:', defval: 'standardized logit', options: ['standardized logit', 'logit RSI', 'regular RSI'], group: RSI_GROUP },
  { id: 'showLevels', type: 'bool', title: 'Show primary z-score reference levels', defval: true, group: LEVEL_GROUP,
    tooltip: 'Shows Body and Tail reference levels. Visible only when RSI Plot is set to standardized logit. Level values are adjusted in Inputs. Colors and visibility can be adjusted in the Style tab.' },
  { id: 'bodyLevel', type: 'float', title: 'Body', defval: 0.66, min: 0, step: 0.01, group: LEVEL_GROUP },
  { id: 'tailLevel', type: 'float', title: 'Tail', defval: 2.14, min: 0, step: 0.01, group: LEVEL_GROUP },
  { id: 'showSecondaryLevels', type: 'bool', title: 'Show secondary z-score reference levels', defval: false, group: LEVEL_GROUP,
    tooltip: 'Shows Breakout and Overextension reference levels. Visible only when RSI Plot is set to standardized logit. Level values are adjusted in Inputs. Colors and visibility can be adjusted in the Style tab.' },
  { id: 'breakoutLevel', type: 'float', title: 'Breakout', defval: 1.0, min: 0, step: 0.01, group: LEVEL_GROUP },
  { id: 'overextLevel', type: 'float', title: 'Overextension', defval: 1.73, min: 0, step: 0.01, group: LEVEL_GROUP },
  { id: 'showBB', type: 'bool', title: 'Plot Bollinger Bands', defval: false, group: BB_GROUP,
    tooltip: 'Plots Bollinger Bands on the currently selected RSI Plot. On regular RSI, this exposes the classic problem of applying bands directly to a bounded 0–100 scale.' },
  { id: 'maLength', type: 'int', title: 'Length', defval: 50, group: BB_GROUP, display: 'data_window' },
  { id: 'bbMult', type: 'float', title: 'BB StdDev', defval: 2.0, min: 0, max: 5, step: 0.1, group: BB_GROUP, display: 'data_window' },
];

const RSI_COLOR = String(color.new(color.gray, 25));
const ZERO_COLOR = String(color.new(color.gray, 70));
const LEVEL_SOFT = String(color.new('#F2BD1D', 65));
const LEVEL_MID = String(color.new('#F2BD1D', 50));
const LEVEL_HARD = String(color.new('#F2BD1D', 35));
const BB_FILL = String(color.new('#33A645', 90));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI Plot', color: RSI_COLOR, lineWidth: 2 },
  { id: 'plot1', title: 'Zero', color: ZERO_COLOR, lineWidth: 1 },
  { id: 'plot2', title: 'Body +', color: LEVEL_MID, lineWidth: 2 },
  { id: 'plot3', title: 'Body -', color: LEVEL_MID, lineWidth: 2 },
  { id: 'plot4', title: 'Tail +', color: LEVEL_HARD, lineWidth: 2 },
  { id: 'plot5', title: 'Tail -', color: LEVEL_HARD, lineWidth: 2 },
  { id: 'plot6', title: 'Breakout +', color: LEVEL_SOFT, lineWidth: 1 },
  { id: 'plot7', title: 'Breakout -', color: LEVEL_SOFT, lineWidth: 1 },
  { id: 'plot8', title: 'Overextension +', color: LEVEL_SOFT, lineWidth: 1 },
  { id: 'plot9', title: 'Overextension -', color: LEVEL_SOFT, lineWidth: 1 },
  // display = show_BB ? display.all : display.none
  { id: 'plot10', title: 'RSI-based MA', color: '#F2BD1D', lineWidth: 1, visible: 'showBB' },
  { id: 'plot11', title: 'Upper Bollinger Band', color: '#33E643', lineWidth: 1, visible: 'showBB' },
  { id: 'plot12', title: 'Lower Bollinger Band', color: '#33E643', lineWidth: 1, visible: 'showBB' },
];

/** fill(bbUpperBand, bbLowerBand, color.new(#33A645, 90)) shown with show_BB */
export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot11', plot2: 'plot12', color: BB_FILL, title: 'Bollinger Bands Background Fill', visible: 'showBB' },
];

export const metadata = {
  title: 'Logit RSI [AdaptiveRSI]',
  shortTitle: 'AdaptiveRSI · Logit RSI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<LogitRsiInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const eps = 0.000001;

  const rsiRaw = A(ta.rsi(Series.fromArray(bars, bars.map((b) => b.close)), cfg.length));
  // logit_transform: xc = math.min(math.max(x, eps), 100 - eps); math.log(xc / (100 - xc)) (na stays na)
  const logit = rsiRaw.map((x) => {
    const xc = Math.min(Math.max(x, eps), 100 - eps);
    return Math.log(xc / (100 - xc));
  });
  const logitScale = 2.0 / Math.sqrt(cfg.length - 1);
  const plotRsi = cfg.rsiType === 'standardized logit' ? logit.map((v) => v / logitScale)
    : cfg.rsiType === 'logit RSI' ? logit : rsiRaw;

  const isStd = cfg.rsiType === 'standardized logit';
  const showStdLevels = cfg.showLevels && isStd;
  const showSecondary = cfg.showSecondaryLevels && isStd;
  const showZero = showStdLevels || showSecondary;

  const plotSeries = Series.fromArray(bars, plotRsi);
  const ma = A(ta.sma(plotSeries, cfg.maLength));
  const sd = A(ta.stdev(plotSeries, cfg.maLength)).map((v) => v * cfg.bbMult);

  const line = (values: (i: number) => number, c: string) =>
    bars.map((b, i) => ({ time: b.time, value: values(i), color: c }));
  const level = (on: boolean, v: number, c: string) => line(() => (on ? v : NaN), c);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: 2 },
    plots: {
      plot0: line((i) => plotRsi[i], RSI_COLOR),
      plot1: level(showZero, 0, ZERO_COLOR),
      plot2: level(showStdLevels, cfg.bodyLevel, LEVEL_MID),
      plot3: level(showStdLevels, -cfg.bodyLevel, LEVEL_MID),
      plot4: level(showStdLevels, cfg.tailLevel, LEVEL_HARD),
      plot5: level(showStdLevels, -cfg.tailLevel, LEVEL_HARD),
      plot6: level(showSecondary, cfg.breakoutLevel, LEVEL_SOFT),
      plot7: level(showSecondary, -cfg.breakoutLevel, LEVEL_SOFT),
      plot8: level(showSecondary, cfg.overextLevel, LEVEL_SOFT),
      plot9: level(showSecondary, -cfg.overextLevel, LEVEL_SOFT),
      plot10: line((i) => ma[i], '#F2BD1D'),
      plot11: line((i) => ma[i] + sd[i], '#33E643'),
      plot12: line((i) => ma[i] - sd[i], '#33E643'),
    },
    fills: [
      // fill(bbUpperBand, bbLowerBand, color = show_BB ? color.new(#33A645, 90) : na)
      { plot1: 'plot11', plot2: 'plot12', options: { title: 'Bollinger Bands Background Fill' },
        colors: new Array<string>(n).fill(cfg.showBB ? BB_FILL : 'transparent') },
    ],
  };
}

export const LogitRsi = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
};
