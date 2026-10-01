/**
 * Trend Predictor Ribbon
 *
 * A trailing stop around the Hull moving average of the source: long stop = HMA - multiplier * ATR, short stop =
 * HMA + multiplier * ATR (HMA and ATR over the trend length). In an up trend the stop only rises (max of the long stop
 * and the previous stop); in a down trend it only falls. The trend flips when the close crosses the stop, and the
 * stop jumps to the other side. The stop line and the ribbon between the close and the stop are green in an up trend
 * and red in a down trend; triangles mark the crosses of the close over / under the stop.
 *
 * Reference: "Trend Predictor Ribbon Clone - Fixed" by ronitjain18
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface TrendPredictorRibbonInputs {
  /** Source of the HMA */
  src: SourceType;
  /** HMA and ATR length */
  length: number;
  /** ATR multiplier */
  multiplier: number;
}

export const defaultInputs: TrendPredictorRibbonInputs = {
  src: 'close',
  length: 10,
  multiplier: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'length', type: 'int', title: 'Trend Length', defval: 10, min: 1 },
  { id: 'multiplier', type: 'float', title: 'ATR Multiplier', defval: 2.0, min: 0.1 },
];

const BULL = String(color.new(color.green, 10));
const BEAR = String(color.new(color.red, 10));
const CLOUD_BULL = String(color.new(color.green, 85));
const CLOUD_BEAR = String(color.new(color.red, 85));
const FULLY_TRANSPARENT = String(color.new(color.blue, 100));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Price Line', color: FULLY_TRANSPARENT, lineWidth: 1 },
  { id: 'plot1', title: 'Trend Line', color: BULL, lineWidth: 3 },
];

export const metadata = {
  title: 'Trend Predictor Ribbon Clone - Fixed',
  shortTitle: 'Trend Predictor Ribbon Clone - Fixed',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
/** Pine math.max / math.min: na when an argument is na */
const max = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.max(a, b));
const min = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.min(a, b));

export function calculate(
  bars: Bar[],
  inputs: Partial<TrendPredictorRibbonInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const atr = ta.atr(bars, cfg.length).toArray().map((v) => v ?? NaN);
  const hma = ta.hma(getSourceSeries(bars, cfg.src), cfg.length).toArray().map((v) => v ?? NaN);

  const stop: number[] = new Array(n);
  const dir: number[] = new Array(n);
  let trendStop = NaN; // var float trendStop = na
  let trendDir = 1; // var int trendDir = 1
  for (let i = 0; i < n; i++) {
    const close = bars[i].close;
    const longStop = hma[i] - cfg.multiplier * atr[i];
    const shortStop = hma[i] + cfg.multiplier * atr[i];
    if (isNaN(trendStop)) trendStop = hma[i];
    if (trendDir === 1 && lt(close, trendStop)) {
      trendDir = -1;
      trendStop = shortStop;
    } else if (trendDir === -1 && gt(close, trendStop)) {
      trendDir = 1;
      trendStop = longStop;
    } else {
      trendStop = trendDir === 1 ? max(longStop, trendStop) : min(shortStop, trendStop);
    }
    stop[i] = trendStop;
    dir[i] = trendDir;
  }

  const markers: MarkerData[] = [];
  for (let i = 1; i < n; i++) {
    const t = bars[i].time;
    const c = bars[i].close;
    const c1 = bars[i - 1].close;
    // plotshape(ta.crossover(close, trendStop), "Buy Signal", shape.triangleup, location.belowbar, color.green, size.small)
    if (gt(c, stop[i]) && le(c1, stop[i - 1])) {
      markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'small' });
    }
    // plotshape(ta.crossunder(close, trendStop), "Sell Signal", shape.triangledown, location.abovebar, color.red, size.small)
    if (lt(c, stop[i]) && ge(c1, stop[i - 1])) {
      markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'small' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      // plot(close, title = "Price Line", color = fullyTransparent)
      plot0: bars.map((b) => ({ time: b.time, value: b.close, color: FULLY_TRANSPARENT })),
      // plot(trendStop, title = "Trend Line", color = trendDir == 1 ? bullColor : bearColor, linewidth = 3)
      plot1: bars.map((b, i) => ({ time: b.time, value: stop[i], color: dir[i] === 1 ? BULL : BEAR })),
    },
    // fill(p_price, p_stop, color = trendDir == 1 ? cloudBull : cloudBear, title = "Trend Ribbon")
    fills: [
      { plot1: 'plot0', plot2: 'plot1', options: { title: 'Trend Ribbon' }, colors: dir.map((d) => (d === 1 ? CLOUD_BULL : CLOUD_BEAR)) },
    ],
    markers,
  };
}

export const TrendPredictorRibbon = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
