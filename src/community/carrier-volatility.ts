/**
 * Carrier Volatility [Pumori]
 *
 * An RSI (default), its SMA, the close or a custom source is smoothed twice by an exponential average with a
 * fractional length (default 0.1, alpha = 2 / (length + 1) above 1): sum = alpha * x + (1 - alpha) * nz(sum[1]).
 * The second average ("EMA") is drawn with a copy shifted one bar to the left ("EMA offset") and a fill between
 * them, with the input series. The set is drawn in the indicator pane, or on the price pane when "Show on Main
 * Chart?" is on.
 *
 * Reference: "Pumori" by et20tradeview
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © et20tradeview
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import { barInterval, barTime } from '../bar-time';

export type CarrierVolatilityMode = 'Defaut (RSI)' | 'Diagnostic (RSI SMA)' | 'Price' | 'Custom';

export interface CarrierVolatilityInputs {
  /** Draw the lines on the price pane (else in the indicator pane) */
  showOnPrice: boolean;
  /** Input series */
  mode: CarrierVolatilityMode;
  /** Source of the Custom mode */
  source: SourceType;
  /** Length of the first average */
  factor: number;
  /** Length of the second average */
  factor2: number;
  rsiLength: number;
  maLength: number;
}

export const defaultInputs: CarrierVolatilityInputs = {
  showOnPrice: false,
  mode: 'Defaut (RSI)',
  source: 'close',
  factor: 0.1,
  factor2: 0.1,
  rsiLength: 14,
  maLength: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'showOnPrice', type: 'bool', title: 'Show on Main Chart?', defval: false },
  { id: 'mode', type: 'string', title: 'Input Mode', defval: 'Defaut (RSI)', options: ['Defaut (RSI)', 'Diagnostic (RSI SMA)', 'Price', 'Custom'] },
  { id: 'source', type: 'source', title: 'Custom Mode', defval: 'close' },
  { id: 'factor', type: 'float', title: 'factor', defval: 0.1, min: 0.1, step: 0.1 },
  { id: 'factor2', type: 'float', title: 'factor2', defval: 0.1, min: 0.1, step: 0.1 },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14 },
  { id: 'maLength', type: 'int', title: 'MA Length', defval: 14 },
];

const SOURCE_COLOR = String(color.new(color.rgb(255, 235, 59), 75));

export const plotConfig: PlotConfig[] = [
  // display = showOnPrice ? display.none : display.all (result.visibility.showInPane)
  { id: 'plot0', title: 'EMA', color: color.purple, lineWidth: 1, visible: 'showInPane' },
  { id: 'plot1', title: 'EMA offset', color: color.purple, lineWidth: 1, visible: 'showInPane' },
  { id: 'plot2', title: 'source', color: SOURCE_COLOR, lineWidth: 1, visible: 'showInPane' },
  // force_overlay = true, display = showOnPrice ? display.all : display.none
  { id: 'plot3', title: 'EMA', color: color.purple, lineWidth: 1, forceOverlay: true, visible: 'showOnPrice' },
  { id: 'plot4', title: 'EMA offset', color: color.purple, lineWidth: 1, forceOverlay: true, visible: 'showOnPrice' },
  { id: 'plot5', title: 'source', color: SOURCE_COLOR, lineWidth: 1, forceOverlay: true, visible: 'showOnPrice' },
];

export const metadata = {
  title: 'Pumori',
  shortTitle: 'Pumori',
  overlay: false,
};

/** pine_ema(src, length): sum = alpha * src + (1 - alpha) * nz(sum[1]), alpha = 2 / (length + 1) */
function pineEma(src: number[], length: number): number[] {
  const alpha = 2 / (length + 1);
  const out: number[] = new Array(src.length);
  for (let i = 0; i < src.length; i++) {
    const prev = i > 0 && !isNaN(out[i - 1]) ? out[i - 1] : 0;
    out[i] = alpha * src[i] + (1 - alpha) * prev;
  }
  return out;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<CarrierVolatilityInputs> = {},
): IndicatorResult & { visibility: Record<string, boolean> } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  // rsi_input = ta.rsi(close, rsiLengthInput); rsi_ma = ta.sma(rsi_input, maLengthInput)
  const rsiS = ta.rsi(Series.fromArray(bars, bars.map((b) => b.close)), cfg.rsiLength);
  const rsi = A(rsiS);
  const rsiMa = A(ta.sma(rsiS, cfg.maLength));
  const seriesP = cfg.mode === 'Defaut (RSI)' ? rsi
    : cfg.mode === 'Diagnostic (RSI SMA)' ? rsiMa
      : cfg.mode === 'Price' ? bars.map((b) => b.close)
        : A(getSourceSeries(bars, cfg.source));

  const ln1 = pineEma(seriesP, cfg.factor);
  const ln2 = pineEma(ln1, cfg.factor2);

  const interval = barInterval(bars);
  const t = (i: number) => bars[i].time;
  const line = () => bars.map((_b, i) => ({ time: t(i), value: ln2[i], color: color.purple }));
  // plot(ln2, "EMA offset", offset = -1): the value of bar i is drawn on bar i - 1
  const shifted = () => bars.slice(1).map((_b, k) => ({ time: barTime(bars, k, interval), value: ln2[k + 1], color: color.purple }));
  const source = () => bars.map((_b, i) => ({ time: t(i), value: seriesP[i], color: SOURCE_COLOR }));

  // fill(p2, p3, color.new(#69359C, 70), "Lag Shading", display = showOnPrice ? none : all); fill(p4, p5, ...)
  const shade = String(color.new('#69359C', 70));
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: line(),
      plot1: shifted(),
      plot2: source(),
      plot3: line(),
      plot4: shifted(),
      plot5: source(),
    },
    fills: [
      { plot1: 'plot0', plot2: 'plot1', options: { title: 'Lag Shading' },
        colors: new Array<string>(n).fill(cfg.showOnPrice ? 'transparent' : shade) },
      { plot1: 'plot3', plot2: 'plot4', options: { title: 'Lag Shading' },
        colors: new Array<string>(n).fill(cfg.showOnPrice ? shade : 'transparent') },
    ],
    visibility: { showInPane: !cfg.showOnPrice, showOnPrice: cfg.showOnPrice },
  };
}

export const CarrierVolatility = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
