/**
 * [codapro] Tenkan Cloud Signals
 *
 * Ichimoku-style lines from Donchian midpoints: Tenkan (midpoint of the highest high and lowest low over the Tenkan
 * length), Kijun (same over the Kijun length), Senkou Span A = (Tenkan + Kijun) / 2 and Senkou Span B (midpoint over
 * the Span B length). Both spans are drawn `displace` bars forward with a green / red cloud fill (Span A at or above
 * Span B: bull). BUY / SELL flags mark a cross of the Kijun over / under the Span B value plotted on the current bar
 * (Span B of `displace` bars ago) that holds for `confirmBars` bars.
 *
 * Reference: "[codapro] Tenkan Cloud Signals" by CodaPro
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © ArisCodes
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { barInterval, barTime } from '../bar-time';

export interface TenkanCloudSignalsInputs {
  /** Tenkan length */
  tenkanLen: number;
  /** Kijun length */
  kijunLen: number;
  /** Senkou Span B length */
  spanBLen: number;
  /** Forward displacement of the cloud (bars) */
  displace: number;
  showTenkan: boolean;
  showKijun: boolean;
  showCloud: boolean;
  tenkanCol: string;
  kijunCol: string;
  spanACol: string;
  spanBCol: string;
  bullFill: string;
  bearFill: string;
  /** Show the BUY / SELL flags */
  showSignals: boolean;
  /** Number of closes the Kijun must stay above / below Span B (1..10) */
  confirmBars: number;
}

const BULL_FILL = String(color.new(color.green, 85));
const BEAR_FILL = String(color.new(color.red, 85));

export const defaultInputs: TenkanCloudSignalsInputs = {
  tenkanLen: 7,
  kijunLen: 22,
  spanBLen: 44,
  displace: 22,
  showTenkan: true,
  showKijun: false,
  showCloud: true,
  tenkanCol: color.teal,
  kijunCol: color.orange,
  spanACol: color.green,
  spanBCol: color.red,
  bullFill: BULL_FILL,
  bearFill: BEAR_FILL,
  showSignals: true,
  confirmBars: 1,
};

export const inputConfig: InputConfig[] = [
  { id: 'tenkanLen', type: 'int', title: 'Tenkan Length', defval: 7, min: 1, group: 'Ichimoku Parameters' },
  { id: 'kijunLen', type: 'int', title: 'Kijun Length (calculated)', defval: 22, min: 1, group: 'Ichimoku Parameters' },
  { id: 'spanBLen', type: 'int', title: 'Senkou Span B Length', defval: 44, min: 1, group: 'Ichimoku Parameters' },
  { id: 'displace', type: 'int', title: 'Cloud Forward Displacement', defval: 22, min: 0, group: 'Ichimoku Parameters' },
  { id: 'showTenkan', type: 'bool', title: 'Plot Tenkan Line', defval: true, group: 'Visuals' },
  { id: 'showKijun', type: 'bool', title: 'Plot Kijun Line (optional)', defval: false, group: 'Visuals' },
  { id: 'showCloud', type: 'bool', title: 'Show Cloud Fill', defval: true, group: 'Visuals' },
  { id: 'tenkanCol', type: 'color', title: 'Tenkan Color', defval: color.teal, group: 'Visuals' },
  { id: 'kijunCol', type: 'color', title: 'Kijun Color', defval: color.orange, group: 'Visuals' },
  { id: 'spanACol', type: 'color', title: 'Span A Color', defval: color.green, group: 'Visuals' },
  { id: 'spanBCol', type: 'color', title: 'Span B Color', defval: color.red, group: 'Visuals' },
  { id: 'bullFill', type: 'color', title: 'Bull Cloud Fill', defval: BULL_FILL, group: 'Visuals' },
  { id: 'bearFill', type: 'color', title: 'Bear Cloud Fill', defval: BEAR_FILL, group: 'Visuals' },
  { id: 'showSignals', type: 'bool', title: 'Show Buy/Sell Flags', defval: true, group: 'Signals' },
  { id: 'confirmBars', type: 'int', title: 'Confirmation Bars (close)', defval: 1, min: 1, max: 10, group: 'Signals' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Tenkan', color: color.teal, lineWidth: 2 },
  { id: 'plot1', title: 'Kijun (calc)', color: color.orange, lineWidth: 2 },
  { id: 'plot2', title: 'Senkou Span A', color: color.green, lineWidth: 1 },
  { id: 'plot3', title: 'Senkou Span B', color: color.red, lineWidth: 1 },
];

export const metadata = {
  title: '[codapro] Tenkan Cloud Signals',
  shortTitle: '[codapro] Tenkan Cloud Signals',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

/**
 * One Pine ta.highest / ta.lowest call site that only runs on some bars (right side of a lazy `and`); rule of
 * batch 5 (adaptive-ml-trailing-stop): the source history is a ring of len + 1 slots indexed by bar, written only
 * on the bars where the call runs (a slot never written is skipped); the extreme is kept with its bar and replaced
 * by a value that passes it; the window of the last len bars is scanned again when the extreme is len bars old (the
 * oldest bar wins a tie); an na source resets the extreme and returns na; na before bar len - 1.
 */
function pineExtreme(len: number, isLow: boolean) {
  const ring = len + 1;
  const slot: number[] = new Array(ring).fill(NaN);
  let ext = NaN;
  let extBar = -1;
  return (bar: number, x: number): number => {
    slot[bar % ring] = x;
    if (isNaN(x)) {
      ext = NaN;
      return NaN;
    }
    if (isNaN(ext) || bar - extBar >= len) {
      ext = NaN;
      for (let k = 0; k < len && bar - k >= 0; k++) {
        const v = slot[(bar - k) % ring];
        if (!isNaN(v) && (isNaN(ext) || (isLow ? v <= ext : v >= ext))) {
          ext = v;
          extBar = bar - k;
        }
      }
    } else if (isLow ? x < ext : x > ext) {
      ext = x;
      extBar = bar;
    }
    return bar < len - 1 ? NaN : ext;
  };
}

export function calculate(
  bars: Bar[],
  inputs: Partial<TenkanCloudSignalsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const high = Series.fromArray(bars, bars.map((b) => b.high));
  const low = Series.fromArray(bars, bars.map((b) => b.low));
  // donchianMid(len) = (ta.highest(high, len) + ta.lowest(low, len)) / 2
  const donchianMid = (len: number) => {
    const hh = A(ta.highest(high, len));
    const ll = A(ta.lowest(low, len));
    return hh.map((h, i) => (h + ll[i]) / 2.0);
  };
  const tenkan = donchianMid(cfg.tenkanLen);
  const kijun = donchianMid(cfg.kijunLen);
  const spanA = tenkan.map((t, i) => (t + kijun[i]) / 2.0);
  const spanB = donchianMid(cfg.spanBLen);
  const k = cfg.displace;
  // spanB_asPlottedNow = displace > 0 ? spanB_now[displace] : spanB_now
  const spanBNow = spanB.map((_v, i) => (k > 0 ? (i - k >= 0 ? spanB[i - k] : NaN) : spanB[i]));

  // Signals
  const c = cfg.confirmBars;
  const lowest = pineExtreme(c, true);
  const highest = pineExtreme(c, false);
  const crossUp: boolean[] = new Array(n).fill(false);
  const crossDown: boolean[] = new Array(n).fill(false);
  const markers: MarkerData[] = [];
  // ta.crossover / ta.crossunder compare with the last bar where both values were not na
  let prevK = NaN;
  let prevB = NaN;
  for (let i = 0; i < n; i++) {
    const kj = kijun[i];
    const sb = spanBNow[i];
    const both = !isNaN(kj) && !isNaN(sb);
    crossUp[i] = both && gt(kj, sb) && le(prevK, prevB);
    crossDown[i] = both && lt(kj, sb) && ge(prevK, prevB);
    if (both) {
      prevK = kj;
      prevB = sb;
    }
    const aboveNow = gt(kj, sb);
    const belowNow = lt(kj, sb);
    // aboveConfirmed = confirmBars == 1 ? aboveNow : (aboveNow and ta.lowest(kijun - spanB_asPlottedNow, confirmBars) > 0)
    // the lazy `and` runs ta.lowest / ta.highest only on the bars where aboveNow / belowNow is true
    const aboveConfirmed = c === 1 ? aboveNow : aboveNow && gt(lowest(i, kj - sb), 0);
    const belowConfirmed = c === 1 ? belowNow : belowNow && lt(highest(i, kj - sb), 0);
    // buySignal = showSignals and crossUp[confirmBars - 1] and aboveConfirmed
    const j = i - (c - 1);
    const buySignal = cfg.showSignals && j >= 0 && crossUp[j] && aboveConfirmed;
    const sellSignal = cfg.showSignals && j >= 0 && crossDown[j] && belowConfirmed;
    const t = bars[i].time;
    if (buySignal) {
      markers.push({ time: t, position: 'belowBar', shape: 'flag', color: String(color.new(color.lime, 0)), text: 'BUY',
        textColor: color.black, size: 'small' });
    }
    if (sellSignal) {
      markers.push({ time: t, position: 'aboveBar', shape: 'flag', color: String(color.new(color.red, 0)), text: 'SELL',
        textColor: color.white, size: 'small' });
    }
  }

  // plot(..., offset = displace): the value of bar i is drawn on bar i + displace (future bars with barTime)
  const interval = barInterval(bars);
  const shifted = (vals: number[], col: string) => bars.map((_b, i) => ({
    time: barTime(bars, i + k, interval), value: vals[i], color: col,
  }));
  // cloudBull = spanA_now >= spanB_now; fill colour of bar i goes with the plot points of bar i
  const cloud = spanA.map((a, i) => (cfg.showCloud ? (ge(a, spanB[i]) ? cfg.bullFill : cfg.bearFill) : 'transparent'));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: cfg.showTenkan ? tenkan[i] : NaN, color: cfg.tenkanCol })),
      plot1: bars.map((b, i) => ({ time: b.time, value: cfg.showKijun ? kijun[i] : NaN, color: cfg.kijunCol })),
      plot2: shifted(spanA, cfg.spanACol),
      plot3: shifted(spanB, cfg.spanBCol),
    },
    fills: [{ plot1: 'plot2', plot2: 'plot3', options: { title: 'Cloud Fill' }, colors: cloud }],
    markers,
  };
}

export const TenkanCloudSignals = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
