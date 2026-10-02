/**
 * Visualisation tendances
 *
 * Trend view: an EMA of the source (drawn `offset` bars forward) and an SMA(3) of the close, with a fill between
 * them, red while the EMA is above the SMA(3) and green otherwise. Bollinger bands: SMA of the close +- mult *
 * standard deviation, with a blue fill. Both parts are hidden by default (the lines and fills have an na colour
 * until their switch is on).
 *
 * Reference: "Visualisation tendances" by Benjamin69
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Benjamin69
 */

import {
  ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import { barInterval, barTime } from '../bar-time';

export interface VisualisationTendancesInputs {
  /** Show the trend view (EMA, SMA(3) and their fill) */
  showTrend: boolean;
  /** Show the Bollinger bands and their fill */
  showBollinger: boolean;
  /** EMA source */
  src: SourceType;
  /** EMA length */
  emaLength: number;
  /** Bars the EMA is drawn forward (plot offset) */
  offset: number;
  /** Fill colour while the EMA is not above the SMA(3) */
  colorAbove: string;
  /** Fill colour while the EMA is above the SMA(3) */
  colorBelow: string;
  /** Bollinger length */
  bbLength: number;
  /** Bollinger standard deviation multiplier */
  mult: number;
}

const TREND = 'visualisation tendance';
const BB = 'Bandes Bollinger';

export const defaultInputs: VisualisationTendancesInputs = {
  showTrend: false,
  showBollinger: false,
  src: 'close',
  emaLength: 14,
  offset: 3,
  colorAbove: 'rgba(76, 175, 80, 0.7)',
  colorBelow: 'rgba(242, 54, 69, 0.7)',
  bbLength: 20,
  mult: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'showTrend', type: 'bool', title: 'Montrer visualisation tendance', defval: false },
  { id: 'showBollinger', type: 'bool', title: 'Bandes_Bollinger', defval: false },
  { id: 'src', type: 'source', title: 'Prix', defval: 'close' },
  { id: 'emaLength', type: 'int', title: 'Moyenne expo Base', defval: 14, min: 1, group: TREND },
  { id: 'offset', type: 'int', title: 'décalage', defval: 3, min: 0, max: 50, group: TREND },
  { id: 'colorAbove', type: 'color', title: 'Tendance haussière', defval: 'rgba(76, 175, 80, 0.7)', group: TREND },
  { id: 'colorBelow', type: 'color', title: 'Tendance baissière', defval: 'rgba(242, 54, 69, 0.7)', group: TREND },
  { id: 'bbLength', type: 'int', title: 'periode', defval: 20, min: 1, group: BB },
  { id: 'mult', type: 'float', title: 'Ecart type', defval: 2.0, min: 0.001, max: 50, group: BB },
];

const EMA_COLOR = 'rgb(19, 44, 184)';
const BB_COLOR = '#2708ad';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Moyenne_décalee', color: EMA_COLOR, lineWidth: 2 },
  { id: 'plot1', title: 'lissage_prix', color: color.blue, lineWidth: 1 },
  { id: 'plot2', title: 'Bollinger_supérieur', color: BB_COLOR, lineWidth: 1 },
  { id: 'plot3', title: 'Bollinger_inférieur', color: BB_COLOR, lineWidth: 1 },
];

export const metadata = {
  title: 'Visualisation tendances',
  shortTitle: 'Visu Trend',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(bars: Bar[], inputs: Partial<VisualisationTendancesInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const close = Series.fromArray(bars, bars.map((b) => b.close));

  const ema = A(ta.ema(getSourceSeries(bars, cfg.src), cfg.emaLength)); // Sortie_4
  const sma3 = A(ta.sma(close, 3)); // Prix_2
  const basis = A(ta.sma(close, cfg.bbLength));
  const sd = A(ta.stdev(close, cfg.bbLength));
  const upper = basis.map((b, i) => b + cfg.mult * sd[i]);
  const lower = basis.map((b, i) => b - cfg.mult * sd[i]);

  const interval = barInterval(bars);
  const emaCol = cfg.showTrend ? EMA_COLOR : 'transparent';
  const smaCol = cfg.showTrend ? color.blue : 'transparent';
  const bbCol = cfg.showBollinger ? BB_COLOR : 'transparent';

  // plot(Sortie_4, ..., offset = offset): the value of bar i is drawn on bar i + offset (future bars with barTime)
  const plot0 = ema.map((v, i) => ({ time: barTime(bars, i + cfg.offset, interval), value: v, color: emaCol }));
  const plot1 = bars.map((b, i) => ({ time: b.time, value: sma3[i], color: smaCol }));
  // display = display.all - display.status_line
  const plot2 = bars.map((b, i) => ({ time: b.time, value: upper[i], color: bbCol }));
  const plot3 = bars.map((b, i) => ({ time: b.time, value: lower[i], color: bbCol }));

  // fill(Plot4, Plot5, montrer_moyenne_decalee ? (Sortie_4 > Prix_2 ? color_below : color_above) : na)
  const trendFill: string[] = new Array(n);
  for (let i = 0; i < n; i++) {
    trendFill[i] = cfg.showTrend ? (gt(ema[i], sma3[i]) ? cfg.colorBelow : cfg.colorAbove) : 'transparent';
  }
  // fill(plot13, plot14, montrer_Bollinger ? color.rgb(33, 149, 243, 91) : na, title = "Background")
  const bbFillColor = cfg.showBollinger ? String(color.rgb(33, 149, 243, 91)) : 'transparent';

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2, plot3 },
    fills: [
      { plot1: 'plot0', plot2: 'plot1', colors: trendFill },
      { plot1: 'plot2', plot2: 'plot3', options: { title: 'Background' }, colors: new Array(n).fill(bbFillColor) },
    ],
  };
}

export const VisualisationTendances = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
