/**
 * Market Structure Trailing Stop [LuxAlgo]
 *
 * Overlay trailing stop that adapts based on market structure changes.
 * A close above the last pivot high (not yet crossed) is a bullish structure, a close below the
 * last pivot low (not yet crossed) is a bearish structure. On a reset bar the stop starts at the
 * lowest low / highest high since the pivot, then moves by the change of the running max / min
 * close times incr/100.
 * Reset modes: CHoCH (Change of Character only) or All structure breaks.
 *
 * Reference: "Market Structure Trailing Stop [LuxAlgo]" by LuxAlgo
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LineDrawingData } from '../types';

export interface MarketStructureTrailingStopInputs {
  length: number;
  incr: number;
  resetOn: string;
  showMS: boolean;
  bullCss: string;
  bearCss: string;
  retCss: string;
  areaTransp: number;
}

export const defaultInputs: MarketStructureTrailingStopInputs = {
  length: 14,
  incr: 100,
  resetOn: 'CHoCH',
  showMS: true,
  bullCss: '#00897B',  // Pine v5 color.teal (output 0xFF00897B)
  bearCss: '#FF5252',  // Pine v5 color.red (output 0xFFFF5252)
  retCss: '#ff5d00',
  areaTransp: 80,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Pivot Lookback', defval: 14, min: 1 },
  { id: 'incr', type: 'float', title: 'Increment Factor %', defval: 100, min: 0 },
  { id: 'resetOn', type: 'string', title: 'Reset Stop On', defval: 'CHoCH', options: ['CHoCH', 'All'] },
  { id: 'showMS', type: 'bool', title: 'Show Structures', defval: true },
  { id: 'bullCss', type: 'color', title: 'Bullish MS', defval: '#00897B' },
  { id: 'bearCss', type: 'color', title: 'Bearish MS', defval: '#FF5252' },
  { id: 'retCss', type: 'color', title: 'Retracement', defval: '#ff5d00' },
  { id: 'areaTransp', type: 'int', title: 'Area Transparency', defval: 80, min: 0, max: 100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'ts', title: 'Trailing Stop', color: '#00897B', lineWidth: 1 },
  { id: 'closeLine', title: 'Close', color: '#00000000', lineWidth: 0 },
];

export const metadata = {
  title: 'Market Structure Trailing Stop',
  shortTitle: 'MSTS',
  overlay: true,
};

// Pine: indicator(..., max_lines_count = 500)
const MAX_LINES = 500;

// Pine color.new(c, transp) for a hex colour input
const withTransp = (c: string, transp: number): string => color.from_hex(c, transp) as string;

export function calculate(bars: Bar[], inputs: Partial<MarketStructureTrailingStopInputs> = {}): IndicatorResult & { lines: LineDrawingData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const length = cfg.length;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  // Pine: ph = ta.pivothigh(length, length), pl = ta.pivotlow(length, length)
  const phArr = ta.pivothigh(highSeries, length, length).toArray();
  const plArr = ta.pivotlow(lowSeries, length, length).toArray();

  // Pine `var` state
  let ph_y = NaN, ph_x = NaN;
  let pl_y = NaN, pl_x = NaN;
  let top = NaN, btm = NaN;
  let ph_cross = false, pl_cross = false;
  let max = NaN, min = NaN, ts = NaN;
  let os = 0;

  const tsArr: number[] = new Array(n).fill(NaN);
  const msArr: number[] = new Array(n).fill(0);
  const osArr: number[] = new Array(n).fill(0);
  const lines: LineDrawingData[] = [];

  for (let i = 0; i < n; i++) {
    const close = bars[i].close;
    let ms = 0;

    // Pine `if ph` / `if pl`: na and 0 are false
    const ph = phArr[i];
    const pl = plArr[i];
    if (ph != null && !isNaN(ph) && ph !== 0) {
      ph_y = ph;
      ph_x = i - length;
      ph_cross = false;
    }
    if (pl != null && !isNaN(pl) && pl !== 0) {
      pl_y = pl;
      pl_x = i - length;
      pl_cross = false;
    }

    // Bullish structures (Pine: close > ph_y and not ph_cross; false when ph_y is na)
    if (close > ph_y && !ph_cross) {
      ms = cfg.resetOn === 'CHoCH' ? (os === -1 ? 1 : 0) : 1;
      ph_cross = true;
      if (cfg.showMS) {
        lines.push({
          time1: bars[ph_x].time, price1: ph_y, time2: bars[i].time, price2: ph_y,
          color: cfg.bullCss, width: 1, style: os === -1 ? 'dashed' : 'dotted',
        });
      }
      os = 1;
      // Pine: btm := low; for i = 0 to (n - ph_x) - 1: btm := math.min(low[i], btm)
      btm = bars[i].low;
      for (let k = 0; k <= i - ph_x - 1; k++) btm = Math.min(bars[i - k].low, btm);
    }

    // Bearish structures
    if (close < pl_y && !pl_cross) {
      ms = cfg.resetOn === 'CHoCH' ? (os === 1 ? -1 : 0) : -1;
      pl_cross = true;
      if (cfg.showMS) {
        lines.push({
          time1: bars[pl_x].time, price1: pl_y, time2: bars[i].time, price2: pl_y,
          color: cfg.bearCss, width: 1, style: os === 1 ? 'dashed' : 'dotted',
        });
      }
      os = -1;
      // Pine: top := high; for i = 0 to (n - pl_x) - 1: top := math.max(high[i], top)
      top = bars[i].high;
      for (let k = 0; k <= i - pl_x - 1; k++) top = Math.max(bars[i - k].high, top);
    }

    // Trailing max/min (Pine math.max / math.min return na when an argument is na)
    const prevMax = max;
    const prevMin = min;
    if (ms === 1) {
      max = close;
    } else if (ms === -1) {
      min = close;
    } else {
      max = isNaN(max) ? NaN : Math.max(close, max);
      min = isNaN(min) ? NaN : Math.min(close, min);
    }

    // Trailing stop
    ts = ms === 1 ? btm
      : ms === -1 ? top
      : os === 1 ? ts + (max - prevMax) * cfg.incr / 100
      : ts + (min - prevMin) * cfg.incr / 100;

    tsArr[i] = ts;
    msArr[i] = ms;
    osArr[i] = os;
  }

  // Pine: css = ms ? na : os == 1 ? bullCss : bearCss. A value with an na colour is kept as a
  // transparent point.
  const cssArr: (string | null)[] = msArr.map((ms, i) => (ms !== 0 ? null : osArr[i] === 1 ? cfg.bullCss : cfg.bearCss));

  const tsPlot = tsArr.map((v, i) => ({
    time: bars[i].time,
    value: v,
    color: cssArr[i] ?? 'transparent',
  }));

  // Pine: plot_price = plot(close, editable = false, display = display.none)
  const closePlot = bars.map((b) => ({ time: b.time, value: b.close }));

  // Pine: css_area = (close - ts) * os < 0 ? retCss : css; fill color color.new(css_area, areaTransp).
  // When css_area is na, gives color.new(na, areaTransp) as black with that transparency
  // (0x33000000 for 80), not na: checked with port-fidelity-check/data/tv/na_color_probe2.json.
  const fillColors = bars.map((b, i) => {
    const cssArea = (b.close - tsArr[i]) * osArr[i] < 0 ? cfg.retCss : cssArr[i];
    return withTransp(cssArea ?? '#000000', cfg.areaTransp);
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      ts: tsPlot,
      closeLine: closePlot,
    },
    fills: [{ plot1: 'closeLine', plot2: 'ts', options: { color: withTransp(cfg.bullCss, cfg.areaTransp) }, colors: fillColors }],
    lines: lines.slice(-MAX_LINES),
  };
}

export const MarketStructureTrailingStop = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
