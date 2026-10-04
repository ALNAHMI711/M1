/**
 * VWRSI Crossovers & Extremes
 *
 * Volume-weighted RSI: the up and down moves of the close are averaged with a volume-weighted RMA
 * (rma(move * volume) / rma(volume)), then RSI = 100 - 100 / (1 + up / down). An EMA of the VWRSI is the signal
 * line; the space between them is filled green (VWRSI above the EMA) or red. A release signal fires when the VWRSI
 * comes back above the oversold level (Up) or below the overbought level (Dn), with an orange background flash.
 *
 * Reference: "VWRSI Crossovers & Extremes [The AI Trading Desk]" by TheAITradingDesk
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';

export interface VwrsiCrossoversExtremesInputs {
  /** VWRSI length */
  rsiLen: number;
  /** EMA length of the signal line */
  maLen: number;
  /** Overbought level */
  obLevel: number;
  /** Oversold level */
  osLevel: number;
}

export const defaultInputs: VwrsiCrossoversExtremesInputs = {
  rsiLen: 14,
  maLen: 9,
  obLevel: 70,
  osLevel: 30,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'VWRSI Length', defval: 14, min: 1 },
  { id: 'maLen', type: 'int', title: 'MA Length', defval: 9, min: 1 },
  { id: 'obLevel', type: 'int', title: 'Overbought Level', defval: 70, min: 60, max: 90 },
  { id: 'osLevel', type: 'int', title: 'Oversold Level', defval: 30, min: 10, max: 40 },
];

const RSI_COLOR = String(color.new(color.blue, 0));
const MA_COLOR = String(color.new(color.gray, 20));
const MID_COLOR = String(color.new(color.yellow, 0));
const FILL_UP = String(color.new(color.green, 50));
const FILL_DOWN = String(color.new(color.red, 50));
const FLASH = String(color.new(color.orange, 40));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VWRSI', color: RSI_COLOR, lineWidth: 2 },
  { id: 'plot1', title: 'MA', color: MA_COLOR, lineWidth: 1, linestyle: 'dotted' },
  { id: 'plot2', title: 'Mid', color: MID_COLOR, lineWidth: 1 },
];

export const metadata = {
  title: 'VWRSI Crossovers & Extremes [The AI Trading Desk]',
  shortTitle: 'VWRSI',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<VwrsiCrossoversExtremesInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const close = bars.map((b) => b.close);
  const volume = bars.map((b) => b.volume ?? NaN);

  // vwrma(src, len) = ta.rma(src * volume, len) / ta.rma(volume, len); ta.change(close) is na on the first bar
  const change = close.map((c, i) => (i > 0 ? c - close[i - 1] : NaN));
  const vwrma = (src: number[]) => {
    const num = A(ta.rma(S(src.map((v, i) => v * volume[i])), cfg.rsiLen));
    const den = A(ta.rma(S(volume), cfg.rsiLen));
    return num.map((v, i) => v / den[i]);
  };
  const vwUp = vwrma(change.map((v) => Math.max(v, 0.0)));
  const vwDown = vwrma(change.map((v) => Math.max(-v, 0.0)));
  // rsi = vwDown == 0.0 ? 100.0 : vwUp == 0.0 ? 0.0 : 100.0 - 100.0 / (1.0 + vwUp / vwDown)
  const rsi = vwUp.map((u, i) => {
    const d = vwDown[i];
    if (eq(d, 0)) return 100.0;
    if (eq(u, 0)) return 0.0;
    return 100.0 - 100.0 / (1.0 + u / d);
  });
  const rsiMa = A(ta.ema(S(rsi), cfg.maLen));

  const plot0 = [];
  const plot1 = [];
  const plot2 = [];
  const fillColors: string[] = [];
  const bgColors: BgColorData[] = [];
  const markers: MarkerData[] = [];
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    plot0.push({ time: t, value: fin(rsi[i]), color: RSI_COLOR });
    plot1.push({ time: t, value: fin(rsiMa[i]), color: MA_COLOR });
    plot2.push({ time: t, value: 50, color: MID_COLOR });
    fillColors.push(gt(rsi[i], rsiMa[i]) ? FILL_UP : FILL_DOWN);

    const prev = i > 0 ? rsi[i - 1] : NaN;
    const releaseUp = le(prev, cfg.osLevel) && gt(rsi[i], cfg.osLevel);
    const releaseDn = ge(prev, cfg.obLevel) && lt(rsi[i], cfg.obLevel);
    if (releaseUp || releaseDn) bgColors.push({ time: t, color: FLASH });
    // plotshape(releaseDn, "OB Release", location.top, shape.triangledown, size.small, color.red, text = "Dn")
    if (releaseDn) {
      markers.push({ time: t, position: 'top', shape: 'triangleDown', color: color.red, size: 'small', text: 'Dn',
        textColor: color.blue });
    }
    // plotshape(releaseUp, "OS Release", location.bottom, shape.triangleup, size.small, color.green, text = "Up")
    if (releaseUp) {
      markers.push({ time: t, position: 'bottom', shape: 'triangleUp', color: color.green, size: 'small', text: 'Up',
        textColor: color.blue });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2 },
    hlines: [
      { value: cfg.obLevel, options: { title: 'OB Level', color: String(color.new(color.red, 40)), linestyle: 'dashed' } },
      { value: cfg.osLevel, options: { title: 'OS Level', color: String(color.new(color.green, 40)), linestyle: 'dashed' } },
    ],
    // fill(rsiPlot, maPlot, color = rsi > rsiMA ? color.new(color.green, 50) : color.new(color.red, 50))
    fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'Momentum Spread Fill' }, colors: fillColors }],
    bgColors,
    markers,
  };
}

export const VwrsiCrossoversExtremes = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
