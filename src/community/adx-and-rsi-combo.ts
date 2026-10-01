/**
 * ADX and RSI Combo
 *
 * Two RSIs of the close (lengths 2 and 5 by default) with the up / down changes averaged by an SMA ("Simple RSI")
 * or an RMA: rsi = 100 when the average fall is 0, 0 when the average rise is 0, else 100 - 100 / (1 + up / down).
 * Bands at 85 and 15 with a fill. The DI+ / DI- lines come from Wilder sums (S = S[1] - S[1] / len + x) of the true
 * range and the directional movements, and the ADX is the RMA of DX. Triangles on the RSI2 line: up when RSI2 was
 * below 15 and rises, down when it was above 85 and falls.
 *
 * Reference: "ADX and RSI Combo" by Tracks
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface AdxAndRsiComboInputs {
  /** Length of RSI1 */
  len1: number;
  /** Length of RSI2 */
  len2: number;
  /** RSI1 averages with an SMA (else an RMA) */
  rs1: boolean;
  /** RSI2 averages with an SMA (else an RMA) */
  rs2: boolean;
  /** Show the RSI2 triangles */
  ut: boolean;
  /** Length of the Wilder sums and of the ADX RMA */
  len: number;
}

export const defaultInputs: AdxAndRsiComboInputs = {
  len1: 2,
  len2: 5,
  rs1: true,
  rs2: true,
  ut: true,
  len: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'len1', type: 'int', title: 'RSI1 Length', defval: 2, min: 1 },
  { id: 'len2', type: 'int', title: 'RSI2 Length', defval: 5, min: 1 },
  { id: 'rs1', type: 'bool', title: 'Simple RSI(2)', defval: true },
  { id: 'rs2', type: 'bool', title: 'Simple RSI(5)', defval: true },
  { id: 'ut', type: 'bool', title: 'Show RSI Triggers', defval: true },
  { id: 'len', type: 'int', title: 'ADX Length', defval: 5 },
];

const PURPLE = String(color.new(color.purple, 0));
const GREEN = String(color.new(color.green, 0));
const RED = String(color.new(color.red, 0));
const BLACK = String(color.new(color.black, 0));
const BAND_FILL = String(color.new(color.purple, 90));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI1', color: PURPLE, lineWidth: 4 },
  { id: 'plot1', title: 'RSI2', color: PURPLE, lineWidth: 1 },
  { id: 'plot2', title: 'DI+', color: GREEN, lineWidth: 1 },
  { id: 'plot3', title: 'DI-', color: RED, lineWidth: 1 },
  { id: 'plot4', title: 'ADX', color: BLACK, lineWidth: 1 },
];

/** hline(85) / hline(15): default colour and style */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: 85, title: 'Upper Level', color: '#787B86', linestyle: 'dashed' },
  { id: 'hline_lower', price: 15, title: 'Lower Level', color: '#787B86', linestyle: 'dashed' },
];

/** fill(band1, band0, color = color.new(color.purple, 90)) */
export const fillConfig: FillConfig[] = [
  { id: 'fill_bands', plot1: 'hline_upper', plot2: 'hline_lower', color: BAND_FILL, title: 'Band Fill' },
];

export const metadata = {
  title: 'ADX and RSI Combo',
  shortTitle: 'ADX&RSI',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<AdxAndRsiComboInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  // ta.change(src) (na on the first bar; math.max / math.min keep na)
  const close = bars.map((b) => b.close);
  const change = close.map((c, i) => (i > 0 ? c - close[i - 1] : NaN));
  const gain = S(change.map((x) => Math.max(x, 0)));
  const loss = S(change.map((x) => -Math.min(x, 0)));
  // up / down: if rs ? ta.sma(...) : ta.rma(...) (only the chosen average runs)
  const avg = (s: Series, simple: boolean, len: number) => A(simple ? ta.sma(s, len) : ta.rma(s, len));
  const rsiOf = (simple: boolean, len: number) => {
    const up = avg(gain, simple, len);
    const down = avg(loss, simple, len);
    // down == 0 ? 100 : up == 0 ? 0 : 100 - 100 / (1 + up / down)
    return up.map((u, i) => (eq(down[i], 0) ? 100 : eq(u, 0) ? 0 : 100 - 100 / (1 + u / down[i])));
  };
  const rsi = rsiOf(cfg.rs1, cfg.len1);
  const rsi2 = rsiOf(cfg.rs2, cfg.len2);

  // Wilder sums: S := nz(S[1]) - nz(S[1]) / len + x; nz(close[1]) etc. are 0 on the first bar
  const len = cfg.len;
  const diPlus: number[] = new Array(n);
  const diMinus: number[] = new Array(n);
  const dx: number[] = new Array(n);
  let sTr = 0;
  let sPlus = 0;
  let sMinus = 0;
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const pc = i > 0 ? (isNaN(bars[i - 1].close) ? 0 : bars[i - 1].close) : 0;
    const ph = i > 0 ? (isNaN(bars[i - 1].high) ? 0 : bars[i - 1].high) : 0;
    const pl = i > 0 ? (isNaN(bars[i - 1].low) ? 0 : bars[i - 1].low) : 0;
    const tr = Math.max(Math.max(b.high - b.low, Math.abs(b.high - pc)), Math.abs(b.low - pc));
    const dmPlus = gt(b.high - ph, pl - b.low) ? Math.max(b.high - ph, 0) : 0;
    const dmMinus = gt(pl - b.low, b.high - ph) ? Math.max(pl - b.low, 0) : 0;
    const nz = (x: number) => (Number.isFinite(x) ? x : 0);
    sTr = nz(sTr) - nz(sTr) / len + tr;
    sPlus = nz(sPlus) - nz(sPlus) / len + dmPlus;
    sMinus = nz(sMinus) - nz(sMinus) / len + dmMinus;
    // plain divisions: x / 0 is +-infinity, 0 / 0 na
    diPlus[i] = (sPlus / sTr) * 100;
    diMinus[i] = (sMinus / sTr) * 100;
    dx[i] = (Math.abs(diPlus[i] - diMinus[i]) / (diPlus[i] + diMinus[i])) * 100;
  }
  // ADX = ta.rma(DX, len): +-infinity is skipped like na
  const adx = A(ta.rma(S(dx.map((x) => (Number.isFinite(x) ? x : NaN))), len));

  const markers: MarkerData[] = [];
  for (let i = 1; i < n; i++) {
    const t = bars[i].time;
    // bc = rsi2[1] < 15 and rsi2 > rsi2[1] and ut; plotshape(bc ? rsi2 : na, triangleup, green, location.absolute)
    if (cfg.ut && lt(rsi2[i - 1], 15) && gt(rsi2[i], rsi2[i - 1])) {
      markers.push({ time: t, position: 'atPriceMiddle', price: rsi2[i], shape: 'triangleUp', color: GREEN });
    }
    // bp = rsi2[1] > 85 and rsi2 < rsi2[1] and ut; plotshape(bp ? rsi2 : na, triangledown, red, location.absolute)
    if (cfg.ut && gt(rsi2[i - 1], 85) && lt(rsi2[i], rsi2[i - 1])) {
      markers.push({ time: t, position: 'atPriceMiddle', price: rsi2[i], shape: 'triangleDown', color: RED });
    }
  }

  const val = (v: number) => (Number.isFinite(v) ? v : NaN);
  const plot = (a: number[], c: string) => bars.map((b, i) => ({ time: b.time, value: val(a[i]), color: c }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: plot(rsi, PURPLE),
      plot1: plot(rsi2, PURPLE),
      plot2: plot(diPlus, GREEN),
      plot3: plot(diMinus, RED),
      plot4: plot(adx, BLACK),
    },
    hlines: hlineConfig.map((h) => ({ value: h.price, options: { title: h.title, color: h.color, linestyle: h.linestyle } })),
    fills: [{ plot1: 'hline_upper', plot2: 'hline_lower', options: { title: 'Band Fill', color: BAND_FILL } }],
    markers,
  };
}

export const AdxAndRsiCombo = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
