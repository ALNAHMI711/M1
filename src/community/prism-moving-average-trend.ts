/**
 * Prism Moving Average Trend (PriMAT)
 *
 * PRISM(x, length): a weighted average of the last `length` values with the weights (sin(a) + cos(a) + 1) / 2,
 * a = (i + 1) * pi / (length + 1), blended with the current value: base * (1 - alpha) + x * alpha, alpha =
 * 2 / (1 + Lookback). The Prism MA is PRISM(PRISM(src, Lookback), round(sqrt(Lookback))). Bands are the MA +- ATR(Lookback)
 * * multiplier. The trend turns up when the source closes above the upper band with a rising MA, down when it closes
 * below the lower band with a falling MA; it colours the candles, the MA, the bands and the band fill. A yellow
 * background warns of a possible reversal when (src - MA) * trend is at its lowest over Lookback bars.
 *
 * Reference: "Prism Moving Average Trend" by MisinkoMaster
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © MisinkoMaster
 */

import { ta, Series, math, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BgColorData, PlotCandleData } from '../types';

export interface PrismMovingAverageTrendInputs {
  /** Source */
  src: SourceType;
  /** Lookback */
  len: number;
  /** ATR multiplier of the bands */
  mul: number;
}

export const defaultInputs: PrismMovingAverageTrendInputs = {
  src: 'close',
  len: 31,
  mul: 0.85,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close', group: 'Prism Moving Average Trend' },
  { id: 'len', type: 'int', title: 'Lookback', defval: 31, min: 2, tooltip: 'Changes the amount of data used.',
    group: 'Prism Moving Average Trend' },
  { id: 'mul', type: 'float', title: 'Multiplier', defval: 0.85, step: 0.05, group: 'Prism Moving Average Trend' },
];

const NEUTRAL = String(color.rgb(72, 72, 72));
const NEUTRAL_T = String(color.rgb(72, 72, 72, 60));
const UP = String(color.rgb(0, 255, 187));
const UP_T = String(color.rgb(0, 255, 187, 60));
const DOWN = String(color.rgb(255, 0, 157));
const DOWN_T = String(color.rgb(255, 0, 157, 60));
const DANGER = String(color.rgb(253, 249, 57, 65));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Prism Moving Average', color: NEUTRAL, lineWidth: 3 },
  { id: 'plot1', title: 'Prism Upper Band', color: NEUTRAL, lineWidth: 2 },
  { id: 'plot2', title: 'Prism Lower Band', color: NEUTRAL, lineWidth: 2 },
  { id: 'plot3', title: 'Change', color: NEUTRAL, lineWidth: 1, display: 'status_line' },
];

export const metadata = {
  title: 'Prism Moving Average Trend',
  shortTitle: 'PriMAT │ MisinkoMaster',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

export function calculate(
  bars: Bar[],
  inputs: Partial<PrismMovingAverageTrendInputs> = {},
): IndicatorResult & { bgColors: BgColorData[]; plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const { len, mul } = cfg;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const src = A(getSourceSeries(bars, cfg.src));

  const sqrtlen = math.round(math.sqrt(len) as number) as number;
  // PRISM(source, length); alpha uses the Lookback input `len`, not `length` (as the Pine source)
  const PRISM = (source: number[], length: number): number[] => {
    const alpha = 2 / (1 + len);
    const out: number[] = new Array(n);
    for (let k = 0; k < n; k++) {
      let sum = 0.0;
      let w = 0.0;
      for (let i = 0; i <= length - 1; i++) {
        const angle = ((i + 1) * Math.PI) / (length + 1);
        const weight = ((math.sin(angle) as number) + (math.cos(angle) as number) + 1) / 2;
        sum += (k - i >= 0 ? source[k - i] : NaN) * weight;
        w += weight;
      }
      // w != 0 (Pine: not within 1e-10 of 0)
      const base = !eq(w, 0) ? sum / w : source[k];
      out[k] = base * (1 - alpha) + source[k] * alpha;
    }
    return out;
  };
  const base = PRISM(src, len);
  const prism = PRISM(base, sqrtlen);

  const atr = A(ta.atr(bars, len));
  const upper: number[] = new Array(n);
  const lower: number[] = new Array(n);
  const change: number[] = new Array(n);
  const dist: number[] = new Array(n);
  const trendArr: number[] = new Array(n);
  const col: string[] = new Array(n);
  const colT: string[] = new Array(n);
  const colC: string[] = new Array(n);
  let trend = 0; // var trend = 0
  let c = NEUTRAL; // var col
  let cT = NEUTRAL_T; // var colT
  let cC = NEUTRAL; // var colC
  for (let i = 0; i < n; i++) {
    const vol = atr[i] * mul;
    upper[i] = prism[i] + vol;
    lower[i] = prism[i] - vol;
    change[i] = prism[i] - (i > 0 ? prism[i - 1] : NaN);
    if (gt(src[i], upper[i]) && gt(change[i], 0)) trend = 1;
    if (lt(src[i], lower[i]) && lt(change[i], 0)) trend = -1;
    trendArr[i] = trend;
    if (trend === 1) {
      c = UP;
      cT = UP_T;
    }
    if (trend === -1) {
      c = DOWN;
      cT = DOWN_T;
    }
    if (gt(change[i], 0)) cC = UP;
    if (lt(change[i], 0)) cC = DOWN;
    col[i] = c;
    colT[i] = cT;
    colC[i] = cC;
    dist[i] = (src[i] - prism[i]) * trend;
  }
  // (src - prism) * trend == ta.lowest((src - prism) * trend, len)
  const lowestDist = A(ta.lowest(Series.fromArray(bars, dist), len));

  const plot0 = [];
  const plot1 = [];
  const plot2 = [];
  const plot3 = [];
  const candles: PlotCandleData[] = [];
  const bgColors: BgColorData[] = [];
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const time = b.time;
    // plotcandle(open, high, low, close, color = col, bordercolor = col, wickcolor = col, display = display.pane)
    candles.push({ time, open: b.open, high: b.high, low: b.low, close: b.close, color: col[i], wickColor: col[i], borderColor: col[i] });
    plot0.push({ time, value: fin(prism[i]), color: col[i] });
    plot1.push({ time, value: fin(upper[i]), color: col[i] });
    plot2.push({ time, value: fin(lower[i]), color: col[i] });
    plot3.push({ time, value: fin(change[i]), color: colC[i] });
    if (eq(dist[i], lowestDist[i])) bgColors.push({ time, color: DANGER });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2, plot3 },
    // fill(u, l, colT, "Band Filling")
    fills: [{ plot1: 'plot1', plot2: 'plot2', options: { title: 'Band Filling' }, colors: colT }],
    bgColors,
    plotCandles: { prismCandles: candles },
  };
}

export const PrismMovingAverageTrend = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
