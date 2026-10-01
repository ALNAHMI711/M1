/**
 * Volume Bands
 *
 * The Hull MA (length round(sqrt(source length))) of the source is sampled on the bar of the highest volume of the
 * last `source length` bars (the oldest such bar on a tie); the bands are the median of that value over the median
 * length +/- ATR * multiplier. The trend turns long when the source closes above the upper band and short when it
 * closes below the lower band. In a long trend the lower band is drawn (green) and in a short trend the upper band
 * (pink), each filled to the close; labels mark the trend changes and the candles take the trend colour (grey before
 * the first trend).
 *
 * Reference: "Volume Bands" by MisinkoMaster
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © MisinkoMaster
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';

export interface VolumeBandsInputs {
  /** Source */
  src: SourceType;
  /** Source length: volume window and sqrt(length) of the Hull MA */
  len: number;
  /** Median length */
  mlen: number;
  /** ATR length */
  vlen: number;
  /** Multiplier of the upper band */
  mulu: number;
  /** Multiplier of the lower band */
  muld: number;
}

export const defaultInputs: VolumeBandsInputs = {
  src: 'close',
  len: 14,
  mlen: 14,
  vlen: 14,
  mulu: 1.35,
  muld: 1.35,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'len', type: 'int', title: 'Source Length', defval: 14 },
  { id: 'mlen', type: 'int', title: 'Median Length', defval: 14 },
  { id: 'vlen', type: 'int', title: 'ATR Length', defval: 14 },
  { id: 'mulu', type: 'float', title: 'Multiplier upper', defval: 1.35, step: 0.01 },
  { id: 'muld', type: 'float', title: 'Multiplier lower', defval: 1.35, step: 0.01 },
];

const LONG_COL = String(color.rgb(0, 255, 187));
const SHORT_COL = String(color.rgb(255, 0, 157));
const NEUTRAL_COL = String(color.rgb(72, 72, 72));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper', color: LONG_COL, lineWidth: 1, style: 'linebr' },
  { id: 'plot1', title: 'Lower', color: SHORT_COL, lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'Close', color: '#2962FF', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Volume Bands',
  shortTitle: 'Volume Bands | MisinkoMaster',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<VolumeBandsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const srcS = getSourceSeries(bars, cfg.src);
  const src = A(srcS);
  const vol = bars.map((b) => b.volume ?? NaN);

  // xm = ta.hma(src, math.round(math.sqrt(len)))
  const xm = A(ta.hma(srcS, Math.round(Math.sqrt(cfg.len))));
  const hv = A(ta.highest(S(vol), cfg.len));
  // xr = 0.0; for i = 0 to len - 1: if volume[i] == ta.highest(volume, len): xr := xm[i] (the last match wins)
  const xr = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let v = 0.0;
    for (let k = 0; k <= cfg.len - 1; k++) {
      if (i - k >= 0 && eq(vol[i - k], hv[i])) v = xm[i - k];
    }
    xr[i] = v;
  }
  const x = A(ta.median(S(xr), cfg.mlen));
  const atr = A(ta.atr(bars, cfg.vlen));
  const upper = x.map((v, i) => v + atr[i] * cfg.mulu);
  const lower = x.map((v, i) => v - atr[i] * cfg.muld);

  const trend = new Array<number>(n);
  let tr = 0; // var trend = 0
  for (let i = 0; i < n; i++) {
    const L = gt(src[i], upper[i]);
    const Sh = lt(src[i], lower[i]);
    if (L && !Sh) tr = 1;
    if (Sh) tr = -1;
    trend[i] = tr;
  }
  const upSeries = trend.map((tv, i) => (tv === 1 ? lower[i] : NaN));
  const downSeries = trend.map((tv, i) => (tv === -1 ? upper[i] : NaN));
  // var col = gray; trend == 1 -> green; trend == -1 -> pink
  const col = trend.map((tv) => (tv === 1 ? LONG_COL : tv === -1 ? SHORT_COL : NEUTRAL_COL));

  const t = (i: number) => bars[i].time;
  const plot0 = bars.map((_b, i) => ({ time: t(i), value: upSeries[i], color: LONG_COL }));
  const plot1 = bars.map((_b, i) => ({ time: t(i), value: downSeries[i], color: SHORT_COL }));
  // c = plot(close, display = display.none, editable = false)
  const plot2 = bars.map((b) => ({ time: b.time, value: b.close }));

  const markers: MarkerData[] = [];
  for (let i = 1; i < n; i++) {
    // plotshape(trend > trend[1] ? upSeries : na, shape.labelup, location.absolute, size.normal, ...)
    if (trend[i] > trend[i - 1] && !isNaN(upSeries[i])) {
      markers.push({ time: t(i), position: 'atPriceBottom', price: upSeries[i], shape: 'labelUp', color: LONG_COL,
        size: 'normal', text: '𝓛𝓸𝓷𝓰', textColor: String(color.rgb(7, 83, 63)) });
    }
    // plotshape(trend < trend[1] ? downSeries : na, shape.labeldown, location.absolute, size.normal, ...)
    if (trend[i] < trend[i - 1] && !isNaN(downSeries[i])) {
      markers.push({ time: t(i), position: 'atPriceTop', price: downSeries[i], shape: 'labelDown', color: SHORT_COL,
        size: 'normal', text: '𝓢𝓱𝓸𝓻𝓽', textColor: String(color.rgb(146, 11, 94)) });
    }
  }

  // plotcandle(open, high, low, close, color = col, bordercolor = col, wickcolor = col)
  const candles: PlotCandleData[] = bars.map((b, i) => ({
    time: b.time, open: b.open, high: b.high, low: b.low, close: b.close,
    color: col[i], borderColor: col[i], wickColor: col[i],
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2 },
    // fill(a, c, color.rgb(0, 255, 187, 50)); fill(b, c, color.rgb(255, 0, 157, 50))
    fills: [
      { plot1: 'plot0', plot2: 'plot2', options: { color: String(color.rgb(0, 255, 187, 50)) } },
      { plot1: 'plot1', plot2: 'plot2', options: { color: String(color.rgb(255, 0, 157, 50)) } },
    ],
    markers,
    plotCandles: { PlotCandle: candles },
  };
}

export const VolumeBands = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
