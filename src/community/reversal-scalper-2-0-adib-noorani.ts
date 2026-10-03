/**
 * Reversal Scalper 2.0
 *
 * Oscillator: the SMA (`kSmoothing`) of the stochastic of the close (`kLength`), with lines at 80 (supply zone) and
 * 20 (demand zone) and a fill between them. Trend ribbon (HalfTrend logic): the trend turns down when the SMA of the
 * high over `amp` bars is below the highest recent low and the close is below the previous low, and up in the mirror
 * case; the baseline follows the highest low (up trend) or the lowest high (down trend), and the bands are the
 * baseline +- `devFactor` times half the ATR(100). The bands and the baseline are hidden plots on the price pane with
 * the ribbon fills between them; bars closing below the low band are black, above the high band white.
 *
 * Reference: "Reversal Scalper 2.0- Adib Noorani" by AdibNoorani
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface ReversalScalper20AdibNooraniInputs {
  /** Stochastic K length */
  kLength: number;
  /** SMA length of the stochastic */
  kSmoothing: number;
  /** Colour of the reversal strength meter */
  revStrengthColor: string;
  /** Amplitude (bars of the highest / lowest and of the SMAs) */
  amp: number;
  /** ATR deviation factor of the bands */
  devFactor: number;
  /** Buy ribbon colour */
  buyCol: string;
  /** Sell ribbon colour */
  sellCol: string;
}

// Input colour defaults: color.rgb(r, g, b, t) is stored with alpha (100 - t) / 100
export const defaultInputs: ReversalScalper20AdibNooraniInputs = {
  kLength: 8,
  kSmoothing: 5,
  revStrengthColor: 'rgba(17, 14, 209, 0.96)',
  amp: 3,
  devFactor: 3.0,
  buyCol: 'rgba(76, 175, 80, 0.15)',
  sellCol: 'rgba(255, 82, 82, 0.15)',
};

export const inputConfig: InputConfig[] = [
  { id: 'kLength', type: 'int', title: 'Stochastic K Length', defval: 8, group: 'Oscillator Settings' },
  { id: 'kSmoothing', type: 'int', title: 'Stochastic Smoothing SMA', defval: 5, group: 'Oscillator Settings' },
  { id: 'revStrengthColor', type: 'color', title: 'Reversal Strength Meter Color', defval: 'rgba(17, 14, 209, 0.96)', group: 'Visual Settings' },
  { id: 'amp', type: 'int', title: 'Amplitude (Highest/Lowest Bars)', defval: 3, group: 'Trend Ribbon Settings' },
  { id: 'devFactor', type: 'float', title: 'ATR Deviation Factor', defval: 3.0, group: 'Trend Ribbon Settings' },
  { id: 'buyCol', type: 'color', title: 'Buy Ribbon Color', defval: 'rgba(76, 175, 80, 0.15)', group: 'Visual Settings' },
  { id: 'sellCol', type: 'color', title: 'Sell Ribbon Color', defval: 'rgba(255, 82, 82, 0.15)', group: 'Visual Settings' },
];

/** Pine default plot colour */
const DEFAULT_PLOT_COL = '#2962FF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Reversal Strength Meter', color: 'rgba(17, 14, 209, 0.96)', lineWidth: 2 },
  { id: 'plot1', title: 'Potential Supply Zone', color: color.black, lineWidth: 2 },
  { id: 'plot2', title: 'Potential Demand Zone', color: color.black, lineWidth: 2 },
  { id: 'plot3', title: 'High Band (Internal)', color: 'rgba(255, 82, 82, 0.15)', lineWidth: 1, style: 'circles', display: 'none', forceOverlay: true },
  { id: 'plot4', title: 'Low Band (Internal)', color: 'rgba(76, 175, 80, 0.15)', lineWidth: 1, style: 'circles', display: 'none', forceOverlay: true },
  { id: 'plot5', title: 'Center Baseline (Internal)', color: DEFAULT_PLOT_COL, lineWidth: 1, display: 'none', forceOverlay: true },
];

export const metadata = {
  title: 'Reversal Scalper 2.0- Adib Noorani',
  shortTitle: 'RevScalper',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
/** Pine math.max / math.min: na when an argument is na */
const max = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.max(a, b));
const min = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.min(a, b));

export function calculate(
  bars: Bar[],
  inputs: Partial<ReversalScalper20AdibNooraniInputs> = {},
): IndicatorResult & { barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  const highS = S(high);
  const lowS = S(low);

  // reversalStrength = ta.sma(ta.stoch(close, high, low, kLength), kSmoothing)
  const reversalStrength = A(ta.sma(ta.stoch(S(bars.map((b) => b.close)), highS, lowS, cfg.kLength), cfg.kSmoothing));

  // Trend ribbon
  const halfATR = A(ta.atr(bars, 100)).map((x) => x / 2);
  const hb = A(ta.highestbars(highS, cfg.amp));
  const lb = A(ta.lowestbars(lowS, cfg.amp));
  const hAvg = A(ta.sma(highS, cfg.amp));
  const lAvg = A(ta.sma(lowS, cfg.amp));

  const hiBand: number[] = new Array(n);
  const loBand: number[] = new Array(n);
  const center: number[] = new Array(n);
  const barColors: BarColorData[] = [];
  let t = 0; // var int t = 0
  let nt = 0; // var int nt = 0
  // var float maxLow = na(low[1]) ? low : low[1]; var float minHigh = na(high[1]) ? high : high[1] (bar 0: low / high)
  let maxLow = n > 0 ? low[0] : NaN;
  let minHigh = n > 0 ? high[0] : NaN;
  let u = 0.0; // var float u = 0.0
  let d = 0.0; // var float d = 0.0
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const dev = cfg.devFactor * halfATR[i];
    // high[math.abs(ta.highestbars(amp))]: a history offset of na reads the current bar
    const hOff = isNaN(hb[i]) ? 0 : Math.abs(hb[i]);
    const lOff = isNaN(lb[i]) ? 0 : Math.abs(lb[i]);
    const hPrice = i - hOff >= 0 ? high[i - hOff] : NaN;
    const lPrice = i - lOff >= 0 ? low[i - lOff] : NaN;
    const prevLow = i > 0 ? low[i - 1] : NaN;
    const prevHigh = i > 0 ? high[i - 1] : NaN;
    // t[1], u[1], d[1]: the values of the previous bar (na on bar 0)
    const tPrev = i > 0 ? t : NaN;
    const uPrev = i > 0 ? u : NaN;
    const dPrev = i > 0 ? d : NaN;

    if (nt === 1) {
      maxLow = max(lPrice, maxLow);
      if (lt(hAvg[i], maxLow) && lt(b.close, prevLow)) {
        t = 1;
        nt = 0;
        minHigh = hPrice;
      }
    } else {
      minHigh = min(hPrice, minHigh);
      if (gt(lAvg[i], minHigh) && gt(b.close, prevHigh)) {
        t = 0;
        nt = 1;
        maxLow = lPrice;
      }
    }

    let hi: number;
    let lo: number;
    if (t === 0) {
      u = !isNaN(tPrev) && tPrev !== 0 ? (isNaN(dPrev) ? d : dPrev) : isNaN(uPrev) ? maxLow : max(maxLow, uPrev);
      hi = u + dev;
      lo = u - dev;
    } else {
      d = !isNaN(tPrev) && tPrev !== 1 ? (isNaN(uPrev) ? u : uPrev) : isNaN(dPrev) ? minHigh : min(minHigh, dPrev);
      hi = d + dev;
      lo = d - dev;
    }
    hiBand[i] = hi;
    loBand[i] = lo;
    center[i] = t === 0 ? u : d;

    // barcolor(close < loBand ? color.black : close > hiBand ? color.white : na)
    if (lt(b.close, lo)) barColors.push({ time: b.time, color: color.black });
    else if (gt(b.close, hi)) barColors.push({ time: b.time, color: color.white });
  }

  const P = (f: (i: number) => number, c: string) => bars.map((b, i) => ({ time: b.time, value: f(i), color: c }));
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: P((i) => reversalStrength[i], cfg.revStrengthColor),
      plot1: P(() => 80, color.black),
      plot2: P(() => 20, color.black),
      plot3: P((i) => hiBand[i], cfg.sellCol),
      plot4: P((i) => loBand[i], cfg.buyCol),
      plot5: P((i) => center[i], DEFAULT_PLOT_COL),
    },
    fills: [
      // fill(supplyZone, demandZone, color = color.new(#0fc5dd, 90), title = 'Zone Fill')
      { plot1: 'plot1', plot2: 'plot2', options: { color: String(color.new('#0fc5dd', 90)), title: 'Zone Fill' } },
      // fill(centerPlot, hiBandPlot, title = 'High Ribbon Fill', color = sellCol)
      { plot1: 'plot5', plot2: 'plot3', options: { color: cfg.sellCol, title: 'High Ribbon Fill' }, colors: bars.map(() => cfg.sellCol) },
      // fill(centerPlot, loBandPlot, title = 'Low Ribbon Fill', color = buyCol)
      { plot1: 'plot5', plot2: 'plot4', options: { color: cfg.buyCol, title: 'Low Ribbon Fill' }, colors: bars.map(() => cfg.buyCol) },
    ],
    barColors,
  };
}

export const ReversalScalper20AdibNoorani = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
