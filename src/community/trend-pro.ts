/**
 * Trend-Pro
 *
 * Candle colours from two filters: the direction of a phase-compensated Hull MA (HMA of hlc3 plus k times its
 * one-bar slope, smoothed by an EMA of length round(sqrt(HMA length))) and the position of the close against a
 * least squares MA (ta.linreg with an offset). Green: the HMA line rises and the close is above the LSMA; red: it
 * falls and the close is below the LSMA; grey: other rising / falling bars. LONG / SHORT labels come from an ATR
 * trailing level scored against its own past values (+1 / -1 per lookback): the signal turns long when the score is
 * above the long threshold and short when it crosses under the short threshold; a label is drawn when the signal
 * flips and the close is on the same side of the LSMA.
 *
 * Reference: "Trend-Pro + Z" by andrwxwy
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © andrwxwy
 */

import { ta, Series, getSourceSeries, callsite, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';

export interface TrendProInputs {
  /** LSMA length */
  length: number;
  /** LSMA offset (ta.linreg offset) */
  offset: number;
  /** LSMA source */
  src: SourceType;
  /** HMA length of the candle colour line */
  lengthCAzul: number;
  /** Phase compensation (slope factor) of the candle colour line */
  kAzul: number;
  showCandles: boolean;
  /** Second HMA length (its line feeds only unused Pine variables: no effect) */
  lengthC: number;
  /** Second phase compensation (no effect, see lengthC) */
  k: number;
  /** ATR period of the trailing level */
  calcP: number;
  /** ATR factor */
  atrFactor: number;
  /** First lookback of the score loop */
  start: number;
  /** Last lookback of the score loop */
  end: number;
  /** Show Reference Lines (no effect: the Pine plots are commented out) */
  showRefs: boolean;
  /** Show Long and Short Signals On Chart? (no effect in the Pine script) */
  showls: boolean;
  /** Long threshold of the score */
  thresL: number;
  /** Short threshold of the score */
  thresS: number;
  longcol: string;
  shortcol: string;
  /** Line Width (no effect: the Pine plots are commented out) */
  lineW: number;
  /** Show On Chart? (no effect: the Pine plots are commented out) */
  onchart: boolean;
  /** Paint Candles to Trend? (no effect in the Pine script) */
  paintCandles: boolean;
  /** Background Color? (no effect in the Pine script) */
  bgCol: boolean;
}

export const defaultInputs: TrendProInputs = {
  length: 39,
  offset: -9,
  src: 'hlc3',
  lengthCAzul: 45,
  kAzul: 9,
  showCandles: true,
  lengthC: 55,
  k: 11,
  calcP: 9,
  atrFactor: 1,
  start: 1,
  end: 12,
  showRefs: true,
  showls: true,
  thresL: 4,
  thresS: -4,
  longcol: '#00DD00',
  shortcol: '#FF0A0A',
  lineW: 5,
  onchart: true,
  paintCandles: false,
  bgCol: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 39 },
  { id: 'offset', type: 'int', title: 'Offset', defval: -9 },
  { id: 'src', type: 'source', title: 'Source', defval: 'hlc3' },
  { id: 'lengthCAzul', type: 'int', title: 'HMA Length', defval: 45, min: 2 },
  { id: 'kAzul', type: 'float', title: 'Phase Compensation', defval: 9, step: 1.0 },
  { id: 'showCandles', type: 'bool', title: 'Show candles', defval: true },
  { id: 'lengthC', type: 'int', title: 'HMA Length', defval: 55, min: 2 },
  { id: 'k', type: 'float', title: 'Phase Compensation', defval: 11, step: 1.0 },
  { id: 'calcP', type: 'int', title: 'Average True Range Period', defval: 9, group: 'Core Calculation Settings' },
  { id: 'atrFactor', type: 'float', title: 'Factor', defval: 1, step: 0.1, group: 'Core Calculation Settings' },
  { id: 'start', type: 'int', title: 'For Loop Start', defval: 1, group: 'Core Calculation Settings' },
  { id: 'end', type: 'int', title: 'End', defval: 12, max: 50, group: 'Core Calculation Settings' },
  { id: 'showRefs', type: 'bool', title: 'Show Reference Lines', defval: true, group: 'Signals Settings' },
  { id: 'showls', type: 'bool', title: 'Show Long and Short Signals On Chart?', defval: true, group: 'Signals Settings' },
  { id: 'thresL', type: 'int', title: 'Long Threshold', defval: 4, group: 'Signals Settings' },
  { id: 'thresS', type: 'int', title: 'Short Threshold', defval: -4, group: 'Signals Settings' },
  { id: 'longcol', type: 'color', title: 'Long Color', defval: '#00DD00', group: 'Plotting and Coloring' },
  { id: 'shortcol', type: 'color', title: 'Short Color', defval: '#FF0A0A', group: 'Plotting and Coloring' },
  { id: 'lineW', type: 'int', title: 'Line Width', defval: 5, group: 'Plotting and Coloring' },
  { id: 'onchart', type: 'bool', title: 'Show On Chart?', defval: true, group: 'Plotting and Coloring' },
  { id: 'paintCandles', type: 'bool', title: 'Paint Candles to Trend?', defval: false, group: 'Plotting and Coloring' },
  { id: 'bgCol', type: 'bool', title: 'Background Color?', defval: false, group: 'Plotting and Coloring' },
];

export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [
  { id: 'candles', title: 'Trend Candles' },
];

export const metadata = {
  title: 'Trend-Pro + Z',
  shortTitle: 'Trend-Pro + Z',
  overlay: true,
};

// Pine comparison operators: a > b only when a - b > 1e-10; a comparison with na is false
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;

const GREEN = 'rgb(8, 166, 0)';
const RED = 'rgb(210, 0, 0)';
const GREY = 'rgb(110, 110, 110)';
const TEXT = 'rgb(0, 0, 0)';

export function calculate(
  bars: Bar[],
  inputs: Partial<TrendProInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  // lsma = ta.linreg(src, length, offset)
  const lsma = A(ta.linreg(getSourceSeries(bars, cfg.src), cfg.length, cfg.offset));

  // final_azul = ta.ema(hma + k * (hma - hma[1]), math.round(math.sqrt(lengthC_azul)))
  const hma = A(ta.hma(getSourceSeries(bars, 'hlc3'), cfg.lengthCAzul));
  const pseudo = hma.map((h, i) => (i > 0 ? h + cfg.kAzul * (h - hma[i - 1]) : NaN));
  const finalAzul = A(ta.ema(Series.fromArray(bars, pseudo), Math.round(Math.sqrt(cfg.lengthCAzul))));
  // final_ (second HMA line) only feeds the unused buySignal / sellSignal: not computed

  const atr = A(ta.atr(bars, cfg.calcP));

  // for i = start to end: counts down when start > end
  const step = cfg.start <= cfg.end ? 1 : -1;
  const lookbacks: number[] = [];
  for (let k = cfg.start; step > 0 ? k <= cfg.end : k >= cfg.end; k += step) lookbacks.push(k);

  const crossunder = callsite.crossunder();
  const trail: number[] = new Array(n);
  const candles: PlotCandleData[] = [];
  const markers: MarkerData[] = [];
  let signal = 1; // var tState st = tState.new(1)
  let prevSignal = NaN; // sigS[1]: na on the first bar

  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const isUp = gt(finalAzul[i], i > 0 ? finalAzul[i - 1] : NaN);
    const isDown = lt(finalAzul[i], i > 0 ? finalAzul[i - 1] : NaN);
    const aboveGMA = gt(b.close, lsma[i]);
    const belowGMA = lt(b.close, lsma[i]);

    const candleColor = isUp && aboveGMA ? GREEN : isDown && belowGMA ? RED : isUp || isDown ? GREY : null;
    // plotcandle(showCandles ? open : na, ...): an na colour draws no candle
    if (cfg.showCandles) {
      const c = candleColor ?? 'transparent';
      candles.push({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, color: c, wickColor: c, borderColor: c });
    }

    // ATR trailing level: trailS := nz(trailS[1], close), pushed to close -/+ band
    const band = atr[i] * cfg.atrFactor;
    let trailS = i > 0 && !isNaN(trail[i - 1]) ? trail[i - 1] : b.close;
    const up = b.close + band;
    const dn = b.close - band;
    if (gt(dn, trailS)) trailS = dn;
    if (lt(up, trailS)) trailS = up;
    trail[i] = trailS;

    // scoreS += trailS > trailS[k] ? 1 : -1 (na history: -1)
    let score = 0;
    for (const k of lookbacks) score += gt(trailS, i - k >= 0 ? trail[i - k] : NaN) ? 1 : -1;

    const longCond = gt(score, cfg.thresL);
    const shortCond = crossunder(score, cfg.thresS);
    if (longCond && !shortCond) signal = 1;
    else if (shortCond) signal = -1;

    // plotshape(sigS == 1 and sigS[1] == -1 and aboveGMA, 'Long Signal', shape.labelup, location.belowbar, longcol,
    // text = 'LONG', textcolor = color.rgb(0, 0, 0), size = size.tiny, force_overlay = true)
    if (signal === 1 && prevSignal === -1 && aboveGMA) {
      markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: cfg.longcol, text: 'LONG', textColor: TEXT, size: 'tiny', forceOverlay: true });
    }
    // plotshape(sigS == -1 and sigS[1] == 1 and belowGMA, 'Short Signal', shape.labeldown, location.abovebar, ...)
    if (signal === -1 && prevSignal === 1 && belowGMA) {
      markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: cfg.shortcol, text: 'SHORT', textColor: TEXT, size: 'tiny', forceOverlay: true });
    }
    prevSignal = signal;
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    plotCandles: cfg.showCandles ? { candles } : {},
  };
}

export const TrendPro = { calculate, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig };
