/**
 * Uptrick: RSI MA Buying/Selling signals
 *
 * RSI of the source over `length` bars, smoothed by an RMA of the same length (RSI MA). The RSI MA is drawn as a line
 * and as a histogram with a "heat" colour: at or above 50 a purple that fades in from 100 % transparency at 50 to 0 %
 * at 70; below 50 an aqua that fades in from 100 % at 50 to 0 % at 30 (or plain aqua / purple with the "Normal" option).
 * Optional candle colouring with the same colour. Buy / Sell triangles on the price pane when the RSI MA crosses
 * above / below 50. A horizontal line at 50.
 *
 * Reference: "Uptrick: RSI MA Buying/Selling signals" by Uptrick
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Uptrick
 */

import { ta, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData, MarkerData } from '../types';

export interface UptrickRsiMaSignalsInputs {
  showRsiMa: boolean;
  showHistogram: boolean;
  /** Colour the candles with the RSI MA heat colour */
  colorCandles: boolean;
  /** Plain aqua / purple colours instead of the heat gradient */
  normalRsi: boolean;
  length: number;
  src: SourceType;
}

export const defaultInputs: UptrickRsiMaSignalsInputs = {
  showRsiMa: true,
  showHistogram: true,
  colorCandles: false,
  normalRsi: false,
  length: 14,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'showRsiMa', type: 'bool', title: 'Show RSI MA', defval: true },
  { id: 'showHistogram', type: 'bool', title: 'Show Histogram', defval: true },
  { id: 'colorCandles', type: 'bool', title: 'Color Candles Based on RSI MA', defval: false },
  { id: 'normalRsi', type: 'bool', title: 'Normal Green/Red RSI', defval: false },
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

const AQUA = '#5CF0D7';
const PURPLE = '#B32AC3';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI MA', color: PURPLE, lineWidth: 1 },
  { id: 'plot1', title: 'Histogram', color: PURPLE, lineWidth: 1, style: 'histogram' },
];

export const metadata = {
  title: 'Uptrick: RSI MA Buying/Selling signals',
  shortTitle: 'UpRSIMA',
  overlay: false,
};

/** Pine float comparisons: a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

export function calculate(
  bars: Bar[],
  inputs: Partial<UptrickRsiMaSignalsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: { toArray(): Array<number | null | undefined> }) => s.toArray().map((v) => v ?? NaN);

  const src = getSourceSeries(bars, cfg.src);
  const rsi = ta.rsi(src, cfg.length);
  const rsiMa = A(ta.rma(rsi, cfg.length));

  // calc_heat_color(value): ovr = 70, ovs = 30, mid = 50
  const heat = (value: number): string => {
    if (cfg.normalRsi) return ge(value, 50) ? AQUA : PURPLE;
    if (ge(value, 50)) {
      // alphaRed = math.round(100 - (value - mid) / (ovr - mid) * 100)
      return String(color.new(PURPLE, Math.round(100 - ((value - 50) / 20) * 100)));
    }
    // alphaAqua = math.round(100 - (mid - value) / (mid - ovs) * 100)
    return String(color.new(AQUA, Math.round(100 - ((50 - value) / 20) * 100)));
  };
  // na RSI MA (warm-up): color.new(#5CF0D7, na), no colour (normal mode: #B32AC3, as na >= 50 is false)
  const heatColor = rsiMa.map((v) => heat(v));

  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];
  for (let i = 0; i < n; i++) {
    // barcolor(color_candles ? calc_heat_color(rsi_ma) : na)
    if (cfg.colorCandles) barColors.push({ time: bars[i].time, color: heatColor[i] });
    // ta.crossover / ta.crossunder(rsi_ma, 50): exact comparisons, na on the previous bar gives false
    if (i === 0) continue;
    const cur = rsiMa[i];
    const prev = rsiMa[i - 1];
    if (cur > 50 && prev <= 50) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: AQUA, size: 'small',
        forceOverlay: true });
    }
    if (cur < 50 && prev >= 50) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: PURPLE, size: 'small',
        forceOverlay: true });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      // plot(show_rsi_ma ? rsi_ma : na, "RSI MA", color = heat_color)
      plot0: bars.map((b, i) => ({ time: b.time, value: cfg.showRsiMa ? rsiMa[i] : NaN, color: heatColor[i] })),
      // plot(show_histogram ? rsi_ma : na, style = plot.style_histogram, color = heat_color, linewidth = 1)
      plot1: bars.map((b, i) => ({ time: b.time, value: cfg.showHistogram ? rsiMa[i] : NaN, color: heatColor[i] })),
    },
    // hline(50, "Y = 50", color = color.white)
    hlines: [{ value: 50, options: { title: 'Y = 50', color: color.white, linestyle: 'dashed' } }],
    markers,
    barColors,
  };
}

export const UptrickRsiMaSignals = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
