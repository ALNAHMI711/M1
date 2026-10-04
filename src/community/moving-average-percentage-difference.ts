/**
 * Moving Average Percentage Difference (MAPD)
 *
 * The bar to bar change of a moving average of the close in percent: 100 * (ma / ma[1] - 1). The line (and the
 * moving average drawn on the price pane) is green when the change rises, red otherwise. The area between the line
 * and zero is filled green above zero and red below zero, stronger when the change moves away from zero. A
 * "twilight" band around zero marks the zone where nothing happens.
 *
 * Reference: "Moving Average Percentage Difference" by GapLogic
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Intetics
 */

import {
  ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar,
} from 'oakscriptjs';

export type MapdMaType = 'SMA' | 'EMA' | 'VWMA' | 'RMA' | 'WMA' | 'HMA' | 'SWMA';

export interface MovingAveragePercentageDifferenceInputs {
  /** Script version (a single option, no effect) */
  version: string;
  /** Moving average length */
  maLength: number;
  /** Moving average type */
  maType: MapdMaType;
  /** Colour when the change rises */
  maIncreaseColor: string;
  /** Colour when the change falls */
  maDecreaseColor: string;
  /** Plot the moving average on the price pane */
  plotMAOnChart: boolean;
  /** Fill the space between the line and zero */
  showFill: boolean;
  /** Show the twilight zone */
  showTwilightZone: boolean;
  /** Twilight zone half size */
  twilightLength: number;
  /** Twilight colour */
  twilightColor: string;
}

export const defaultInputs: MovingAveragePercentageDifferenceInputs = {
  version: '1.1',
  maLength: 20,
  maType: 'EMA',
  maIncreaseColor: color.green,
  maDecreaseColor: color.red,
  plotMAOnChart: true,
  showFill: true,
  showTwilightZone: true,
  twilightLength: 0.5,
  twilightColor: color.gray,
};

export const inputConfig: InputConfig[] = [
  { id: 'version', type: 'string', title: 'Version', defval: '1.1', options: ['1.1'] },
  { id: 'maLength', type: 'int', title: 'Moving Average Length', defval: 20 },
  { id: 'maType', type: 'string', title: 'Moving Average Type', defval: 'EMA', options: ['SMA', 'EMA', 'VWMA', 'RMA', 'WMA', 'HMA', 'SWMA'] },
  { id: 'maIncreaseColor', type: 'color', title: 'Increase Color', defval: color.green },
  { id: 'maDecreaseColor', type: 'color', title: 'Decrease Color', defval: color.red },
  { id: 'plotMAOnChart', type: 'bool', title: 'Plot MA on the main chart', defval: true },
  { id: 'showFill', type: 'bool', title: 'Fill space above/below zero line', defval: true },
  { id: 'showTwilightZone', type: 'bool', title: 'Show twilight zone', defval: true },
  { id: 'twilightLength', type: 'float', title: 'Twilight size', defval: 0.5 },
  { id: 'twilightColor', type: 'color', title: 'Twilight Color', defval: color.gray },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Moving Average Difference', color: color.green, lineWidth: 1 },
  { id: 'plot1', title: 'Moving Average', color: color.green, lineWidth: 1, forceOverlay: true },
  { id: 'plot2', title: 'Zero Line For Fill', color: 'transparent', lineWidth: 1, display: 'none' },
];

/** hline(0) and the twilight hlines with the default inputs (the result `hlines` follow the inputs) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, title: 'Level', color: '#787B86', linestyle: 'dashed' },
  { id: 'hline_twilight_upper', price: 0.5, title: 'Twilight Upper Limit', color: color.gray, linestyle: 'dashed' },
  { id: 'hline_twilight_lower', price: -0.5, title: 'Twilight Lower Limit', color: color.gray, linestyle: 'dashed' },
];

/** fill(twilightUpper, twilightLower, color.new(twilightColor, 85)) with the default colour */
export const fillConfig: FillConfig[] = [
  { id: 'fill_twilight', plot1: 'hline_twilight_upper', plot2: 'hline_twilight_lower', color: String(color.new(color.gray, 85)), title: 'Twilight' },
];

export const metadata = {
  title: 'Moving Average Percentage Difference',
  shortTitle: 'MAPD',
  overlay: false,
  format: 'percent',
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

export function calculate(bars: Bar[], inputs: Partial<MovingAveragePercentageDifferenceInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const close = S(bars.map((b) => b.close));
  const len = cfg.maLength;

  // calcMA(_type, _src, _len): only the branch of the selected type runs
  let maValue: number[];
  switch (cfg.maType) {
    case 'SMA': maValue = A(ta.sma(close, len)); break;
    case 'VWMA': maValue = A(ta.vwma(close, len, S(bars.map((b) => b.volume ?? NaN)))); break;
    case 'RMA': maValue = A(ta.rma(close, len)); break;
    case 'WMA': maValue = A(ta.wma(close, len)); break;
    case 'HMA':
      // ta.hma(x, 1) calls ta.wma(x, 0): a Pine runtime error
      if (Math.floor(len / 2) < 1 && n > 0) {
        throw new Error("Invalid value of the 'length' argument (0.0) in the 'wma' function. It must be > 0.");
      }
      maValue = A(ta.hma(close, len));
      break;
    case 'SWMA': maValue = A(ta.swma(close)); break;
    case 'EMA':
    default: maValue = A(ta.ema(close, len)); break;
  }

  // maDiff = 100 * (maValue / maValue[1] - 1): a plain division (x / 0 is +-infinity, plots show na)
  const maDiff = maValue.map((v, i) => (i > 0 ? 100 * (v / maValue[i - 1] - 1) : NaN));
  const prev = (i: number) => (i > 0 ? maDiff[i - 1] : NaN);
  const maColor = (i: number) => (gt(maDiff[i], prev(i)) ? cfg.maIncreaseColor : cfg.maDecreaseColor);
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

  const plot0 = bars.map((b, i) => ({ time: b.time, value: fin(maDiff[i]), color: maColor(i) }));
  const plot1 = bars.map((b, i) => ({ time: b.time, value: cfg.plotMAOnChart ? fin(maValue[i]) : NaN, color: maColor(i) }));
  const plot2 = bars.map((b) => ({ time: b.time, value: cfg.showFill ? 0 : NaN }));

  // zeroFillColor = maDiff > 0 ? increase : decrease; transparency 80 when the change moves away from zero, else 90
  const zeroFill = bars.map((_b, i) => {
    const d = maDiff[i];
    const c = gt(d, 0) ? cfg.maIncreaseColor : cfg.maDecreaseColor;
    const away = (gt(d, 0) && gt(d, prev(i))) || (le(d, 0) && lt(d, prev(i)));
    return String(color.new(c, away ? 80 : 90));
  });

  const twilight = cfg.showTwilightZone ? cfg.twilightLength : NaN;
  const hlines: NonNullable<IndicatorResult['hlines']> = [
    { value: 0, options: { title: 'Level', color: '#787B86', linestyle: 'dashed' } },
  ];
  if (cfg.showTwilightZone) {
    hlines.push(
      { value: twilight, options: { title: 'Twilight Upper Limit', color: cfg.twilightColor, linestyle: 'dashed' } },
      { value: -1 * twilight, options: { title: 'Twilight Lower Limit', color: cfg.twilightColor, linestyle: 'dashed' } },
    );
  }

  // fill(twilightUpper, twilightLower, color.new(twilightColor, 85)): the hlines are na when the zone is off, so
  // nothing is drawn (transparent here)
  const twilightFill = cfg.showTwilightZone ? String(color.new(cfg.twilightColor, 85)) : 'transparent';
  const fills: NonNullable<IndicatorResult['fills']> = [
    // fill(maDiffPlot, zeroLineForFill, color.new(zeroFillColor, zeroFillTransparency))
    { plot1: 'plot0', plot2: 'plot2', options: { title: 'Zero Fill' }, colors: zeroFill },
    { plot1: 'hline_twilight_upper', plot2: 'hline_twilight_lower', options: { title: 'Twilight' },
      colors: new Array<string>(n).fill(twilightFill) },
  ];

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, format: metadata.format },
    plots: { plot0, plot1, plot2 },
    hlines,
    fills,
  };
}

export const MovingAveragePercentageDifference = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
