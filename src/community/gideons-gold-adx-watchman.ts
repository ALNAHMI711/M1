/**
 * Gideons Gold - ADX Watchman
 *
 * Average Directional Index drawn as columns: +DI / -DI = fixnan(100 * rma(+DM / -DM, DI length) / rma(true range,
 * DI length)), ADX = 100 * rma(|+DI - -DI| / (+DI + -DI, 1 when the sum is 0), ADX smoothing). The columns are red
 * at or below 20, yellow below 22 and green otherwise.
 *
 * Reference: "Gideons Gold — ADX Watchman" by gideonsgold
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, fixnan, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface GideonsGoldAdxWatchmanInputs {
  /** ADX smoothing length */
  adxlen: number;
  /** DI length */
  dilen: number;
}

export const defaultInputs: GideonsGoldAdxWatchmanInputs = {
  adxlen: 14,
  dilen: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'adxlen', type: 'int', title: 'ADX Smoothing', defval: 14, min: 1 },
  { id: 'dilen', type: 'int', title: 'DI Length', defval: 14, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ADX Histogram', color: color.green, lineWidth: 2, style: 'columns' },
];

export const metadata = {
  title: 'Gideons Gold — ADX Watchman',
  shortTitle: 'Gideons Gold — ADX Watchman',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

export function calculate(bars: Bar[], inputs: Partial<GideonsGoldAdxWatchmanInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  // dirmov(dilen)
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  const up = high.map((h, i) => (i > 0 ? h - high[i - 1] : NaN)); // ta.change(high)
  const down = low.map((l, i) => (i > 0 ? -(l - low[i - 1]) : NaN)); // -ta.change(low)
  const plusDM = up.map((u, i) => (isNaN(u) ? NaN : gt(u, down[i]) && gt(u, 0) ? u : 0));
  const minusDM = down.map((d, i) => (isNaN(d) ? NaN : gt(d, up[i]) && gt(d, 0) ? d : 0));
  const tr = ta.tr(bars, false); // ta.tr: na on the first bar
  const truerange = A(ta.rma(tr, cfg.dilen));
  const plusRma = A(ta.rma(S(plusDM), cfg.dilen));
  const minusRma = A(ta.rma(S(minusDM), cfg.dilen));
  // A plain division: x / 0 is +-infinity (fixnan keeps it), 0 / 0 is na (fixnan replaces it)
  const plus = fixnan(plusRma.map((v, i) => (100 * v) / truerange[i]));
  const minus = fixnan(minusRma.map((v, i) => (100 * v) / truerange[i]));

  // adx = 100 * ta.rma(math.abs(plus - minus) / (sum == 0 ? 1 : sum), adxlen)
  const x = plus.map((p, i) => {
    const sum = p + minus[i];
    return Math.abs(p - minus[i]) / (eq(sum, 0) ? 1 : sum);
  });
  const sig = A(ta.rma(S(x), cfg.adxlen)).map((v) => 100 * v);

  // histColor = sig <= 20 ? color.red : sig < 22 ? color.yellow : color.green
  const plot0 = bars.map((b, i) => ({
    time: b.time,
    value: Number.isFinite(sig[i]) ? sig[i] : NaN,
    color: le(sig[i], 20) ? color.red : lt(sig[i], 22) ? color.yellow : color.green,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
  };
}

export const GideonsGoldAdxWatchman = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
