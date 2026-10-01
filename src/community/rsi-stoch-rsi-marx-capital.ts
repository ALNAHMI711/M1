/**
 * RSI + STOCH RSI - Marx_Capital
 *
 * The RSI of the RSI source and the Stochastic RSI in one pane: %K is the SMA (Smooth K) of the stochastic of the
 * RSI (StochRSI RSI length) over the stoch length, %D the SMA (Smooth D) of %K. RSI overbought / oversold levels
 * with a purple zone fill, StochRSI levels at 80 / 20, and three optional extra levels at 0, 50 and 100.
 *
 * Reference: "RSI + STOCH RSI - Marx_Capital" by Marx_Capital
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Marx_Capital
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar, type SourceType } from 'oakscriptjs';

export type MarxLineStyle = 'Solid' | 'Dotted' | 'Dashed';

export interface RSIStochRSIMarxCapitalInputs {
  /** RSI source */
  srcRsi: SourceType;
  /** RSI length */
  lenRsi: number;
  /** RSI overbought level */
  rsiOB: number;
  /** RSI oversold level */
  rsiOS: number;
  /** StochRSI %K smoothing */
  smoothK: number;
  /** StochRSI %D smoothing */
  smoothD: number;
  /** RSI length of the StochRSI */
  lengthRSI: number;
  /** Stochastic length of the StochRSI */
  lengthStoch: number;
  /** StochRSI source */
  srcStoch: SourceType;
  /** Show the extra levels (0, 50, 100) */
  showExtra: boolean;
  /** Line style of the extra levels */
  styleInput: MarxLineStyle;
  /** Line width of the extra levels */
  widthInput: number;
  /** Colour of the level at 0 */
  col1: string;
  /** Colour of the level at 50 */
  col2: string;
  /** Colour of the level at 100 */
  col3: string;
}

export const defaultInputs: RSIStochRSIMarxCapitalInputs = {
  srcRsi: 'close',
  lenRsi: 14,
  rsiOB: 70,
  rsiOS: 30,
  smoothK: 3,
  smoothD: 3,
  lengthRSI: 14,
  lengthStoch: 14,
  srcStoch: 'close',
  showExtra: true,
  styleInput: 'Dotted',
  widthInput: 1,
  col1: color.gray,
  col2: color.gray,
  col3: color.gray,
};

export const inputConfig: InputConfig[] = [
  { id: 'srcRsi', type: 'source', title: 'RSI Source', defval: 'close' },
  { id: 'lenRsi', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'rsiOB', type: 'float', title: 'RSI Overbought', defval: 70, step: 0.1 },
  { id: 'rsiOS', type: 'float', title: 'RSI Oversold', defval: 30, step: 0.1 },
  { id: 'smoothK', type: 'int', title: 'StochRSI Smooth K', defval: 3, min: 1 },
  { id: 'smoothD', type: 'int', title: 'StochRSI Smooth D', defval: 3, min: 1 },
  { id: 'lengthRSI', type: 'int', title: 'StochRSI RSI Length', defval: 14, min: 1 },
  { id: 'lengthStoch', type: 'int', title: 'StochRSI Stoch Length', defval: 14, min: 1 },
  { id: 'srcStoch', type: 'source', title: 'StochRSI Source', defval: 'close' },
  { id: 'showExtra', type: 'bool', title: 'Show extra levels', defval: true },
  { id: 'styleInput', type: 'string', title: 'Line style', defval: 'Dotted', options: ['Solid', 'Dotted', 'Dashed'] },
  { id: 'widthInput', type: 'int', title: 'Line width', defval: 1, min: 1, max: 4 },
  { id: 'col1', type: 'color', title: 'line 1 color', defval: color.gray },
  { id: 'col2', type: 'color', title: 'line 2 color', defval: color.gray },
  { id: 'col3', type: 'color', title: 'line 3 color', defval: color.gray },
];

const RSI_COLOR = String(color.rgb(54, 194, 250));
/** Pine default hline colour */
const HLINE_COLOR = '#787B86';
const RSI_ZONE = String(color.new(color.purple, 80));
const STOCH_ZONE = String(color.new(color.black, 100));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: RSI_COLOR, lineWidth: 2 },
  { id: 'plot1', title: '%K', color: color.white, lineWidth: 1 },
  { id: 'plot2', title: '%D', color: color.orange, lineWidth: 1 },
];

/** The levels with the default inputs (the result `hlines` follow the inputs) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_rsi_ob', price: 70, title: 'RSI OB', color: HLINE_COLOR, linestyle: 'solid' },
  { id: 'hline_rsi_os', price: 30, title: 'RSI OS', color: HLINE_COLOR, linestyle: 'solid' },
  { id: 'hline_stoch_ob', price: 80, title: 'StochRSI OB', color: HLINE_COLOR, linestyle: 'dashed' },
  { id: 'hline_stoch_os', price: 20, title: 'StochRSI OS', color: HLINE_COLOR, linestyle: 'dashed' },
  { id: 'hline_line1', price: 0, title: 'line 1', color: color.gray, linestyle: 'dotted', linewidth: 1 },
  { id: 'hline_line2', price: 50, title: 'line 2', color: color.gray, linestyle: 'dotted', linewidth: 1 },
  { id: 'hline_line3', price: 100, title: 'line 3', color: color.gray, linestyle: 'dotted', linewidth: 1 },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill_rsi_zone', plot1: 'hline_rsi_ob', plot2: 'hline_rsi_os', color: RSI_ZONE, title: 'RSI Zone' },
  { id: 'fill_stoch_zone', plot1: 'hline_stoch_ob', plot2: 'hline_stoch_os', color: STOCH_ZONE, title: 'StochRSI Zone' },
];

export const metadata = {
  title: 'RSI + STOCH RSI - Marx_Capital',
  shortTitle: 'MARX RSI+STOCH-RSI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<RSIStochRSIMarxCapitalInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  // rsiVal = ta.rsi(srcRsi, lenRsi)
  const rsiVal = A(ta.rsi(getSourceSeries(bars, cfg.srcRsi), cfg.lenRsi));
  // rsi1 = ta.rsi(srcStoch, lengthRSI); k = ta.sma(ta.stoch(rsi1, rsi1, rsi1, lengthStoch), smoothK); d = ta.sma(k, smoothD)
  const rsi1 = ta.rsi(getSourceSeries(bars, cfg.srcStoch), cfg.lengthRSI);
  const kSeries = ta.sma(ta.stoch(rsi1, rsi1, rsi1, cfg.lengthStoch), cfg.smoothK);
  const k = A(kSeries);
  const d = A(ta.sma(kSeries, cfg.smoothD));

  // lvlStyle: "Solid" -> solid, "Dashed" -> dashed, else dotted; display.none when the extra levels are off
  const lvlStyle = cfg.styleInput === 'Solid' ? 'solid' : cfg.styleInput === 'Dashed' ? 'dashed' : 'dotted';
  const extra = cfg.showExtra
    ? [
      { value: 0, options: { title: 'line 1', color: cfg.col1, linestyle: lvlStyle, linewidth: cfg.widthInput } },
      { value: 50, options: { title: 'line 2', color: cfg.col2, linestyle: lvlStyle, linewidth: cfg.widthInput } },
      { value: 100, options: { title: 'line 3', color: cfg.col3, linestyle: lvlStyle, linewidth: cfg.widthInput } },
    ] as const
    : [];

  const t = (i: number) => bars[i].time;
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: rsiVal.map((v, i) => ({ time: t(i), value: v, color: RSI_COLOR })),
      plot1: k.map((v, i) => ({ time: t(i), value: v, color: color.white })),
      plot2: d.map((v, i) => ({ time: t(i), value: v, color: color.orange })),
    },
    hlines: [
      { value: cfg.rsiOB, options: { title: 'RSI OB', color: HLINE_COLOR, linestyle: 'solid' } },
      { value: cfg.rsiOS, options: { title: 'RSI OS', color: HLINE_COLOR, linestyle: 'solid' } },
      { value: 80, options: { title: 'StochRSI OB', color: HLINE_COLOR, linestyle: 'dashed' } },
      { value: 20, options: { title: 'StochRSI OS', color: HLINE_COLOR, linestyle: 'dashed' } },
      ...extra,
    ],
    fills: [
      { plot1: 'hline_rsi_ob', plot2: 'hline_rsi_os', options: { title: 'RSI Zone' }, colors: new Array<string>(n).fill(RSI_ZONE) },
      { plot1: 'hline_stoch_ob', plot2: 'hline_stoch_os', options: { title: 'StochRSI Zone' }, colors: new Array<string>(n).fill(STOCH_ZONE) },
    ],
  };
}

export const RSIStochRSIMarxCapital = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
