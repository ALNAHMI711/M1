/**
 * AO_AC_ZONE (Customizable)
 *
 * Awesome Oscillator AO = MA(price, fast) - MA(price, slow) and Accelerator Oscillator AC = AO - MA(AO, acLength),
 * with a choice of moving average (SMA, EMA, RMA, WMA, VWMA) and of price. The Zone histogram is the AO, green when
 * AO and AC both rise, red when both fall, gray otherwise; the bars take the Zone colour. AO (aqua when rising,
 * navy otherwise) and AC (fuchsia when rising, purple otherwise) are hidden by default.
 *
 * Reference: "AO_AC_ZONE (Customizable)" by pirooz_trader
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';

export type AoAcZoneMaType = 'SMA' | 'EMA' | 'RMA' | 'WMA' | 'VWMA';
export type AoAcZonePriceType = 'close' | 'hl2' | 'hlc3' | 'ohlc4' | 'lhcc4' | 'open' | 'high' | 'low';

export interface AwesomeAcceleratorZoneOscillatorInputs {
  hideAwesome: boolean;
  hideAccelerator: boolean;
  hideZone: boolean;
  /** Do not colour the bars with the Zone colour */
  hideZoneBarsColor: boolean;
  maType: AoAcZoneMaType;
  /** Fast MA length of the AO */
  fastLength: number;
  /** Slow MA length of the AO */
  slowLength: number;
  /** MA length of the AC */
  acLength: number;
  /** Price; lhcc4 = (low + high + close + close) / 4 */
  priceType: AoAcZonePriceType;
}

export const defaultInputs: AwesomeAcceleratorZoneOscillatorInputs = {
  hideAwesome: true,
  hideAccelerator: true,
  hideZone: false,
  hideZoneBarsColor: false,
  maType: 'SMA',
  fastLength: 5,
  slowLength: 34,
  acLength: 5,
  priceType: 'hl2',
};

export const inputConfig: InputConfig[] = [
  { id: 'hideAwesome', type: 'bool', title: 'Hide AO', defval: true },
  { id: 'hideAccelerator', type: 'bool', title: 'Hide AC', defval: true },
  { id: 'hideZone', type: 'bool', title: 'Hide Zone Histogram', defval: false },
  { id: 'hideZoneBarsColor', type: 'bool', title: 'Hide Zone Trading Color on Bars', defval: false },
  { id: 'maType', type: 'string', title: 'Moving Average Type', defval: 'SMA', options: ['SMA', 'EMA', 'RMA', 'WMA', 'VWMA'] },
  { id: 'fastLength', type: 'int', title: 'Fast MA Length', defval: 5, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow MA Length', defval: 34, min: 1 },
  { id: 'acLength', type: 'int', title: 'AC MA Length', defval: 5, min: 1 },
  { id: 'priceType', type: 'string', title: 'Price Type', defval: 'hl2', options: ['close', 'hl2', 'hlc3', 'ohlc4', 'lhcc4', 'open', 'high', 'low'] },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'AO', color: color.aqua, lineWidth: 2, style: 'columns' },
  { id: 'plot1', title: 'AC', color: color.fuchsia, lineWidth: 2, style: 'columns' },
  { id: 'plot2', title: 'Zone', color: color.green, lineWidth: 2, style: 'columns' },
];

export const metadata = {
  title: 'AO_AC_ZONE (Customizable)',
  shortTitle: 'AO_AC_ZONE',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<AwesomeAcceleratorZoneOscillatorInputs> = {},
): IndicatorResult & { barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  const priceOf = (b: Bar): number => {
    switch (cfg.priceType) {
      case 'close': return b.close;
      case 'hl2': return (b.high + b.low) / 2;
      case 'hlc3': return (b.high + b.low + b.close) / 3;
      case 'ohlc4': return (b.open + b.high + b.low + b.close) / 4;
      case 'lhcc4': return (b.low + b.high + b.close + b.close) / 4;
      case 'open': return b.open;
      case 'high': return b.high;
      case 'low': return b.low;
      default: return NaN;
    }
  };
  const volume = S(bars.map((b) => b.volume ?? NaN));
  // ma(source, length): the moving average of the selected type (na for an unknown type)
  const ma = (src: number[], length: number): number[] => {
    const s = S(src);
    switch (cfg.maType) {
      case 'SMA': return A(ta.sma(s, length));
      case 'EMA': return A(ta.ema(s, length));
      case 'RMA': return A(ta.rma(s, length));
      case 'WMA': return A(ta.wma(s, length));
      case 'VWMA': return A(ta.vwma(s, length, volume));
      default: return new Array(n).fill(NaN);
    }
  };

  const price = bars.map(priceOf);
  const fastMA = ma(price, cfg.fastLength);
  const slowMA = ma(price, cfg.slowLength);
  const ao = fastMA.map((f, i) => f - slowMA[i]);
  const acMA = ma(ao, cfg.acLength);
  const ac = ao.map((v, i) => v - acMA[i]);

  const plot0: { time: number; value: number; color: string }[] = [];
  const plot1: { time: number; value: number; color: string }[] = [];
  const plot2: { time: number; value: number; color: string }[] = [];
  const barColors: BarColorData[] = [];
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    const ao1 = i > 0 ? ao[i - 1] : NaN;
    const ac1 = i > 0 ? ac[i - 1] : NaN;
    const aoColor = gt(ao[i], ao1) ? color.aqua : color.navy;
    const acColor = gt(ac[i], ac1) ? color.fuchsia : color.purple;
    const zoneColor = gt(ao[i], ao1) && gt(ac[i], ac1) ? color.green
      : lt(ao[i], ao1) && lt(ac[i], ac1) ? color.red : color.gray;
    // barcolor(not hideZoneBarsColor ? zoneColor : na)
    if (!cfg.hideZoneBarsColor) barColors.push({ time: t, color: zoneColor });
    plot0.push({ time: t, value: !cfg.hideAwesome ? ao[i] : NaN, color: aoColor });
    plot1.push({ time: t, value: !cfg.hideAccelerator ? ac[i] : NaN, color: acColor });
    plot2.push({ time: t, value: !cfg.hideZone ? ao[i] : NaN, color: zoneColor });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2 },
    hlines: [{ value: 0, options: { title: 'Zero Line', color: color.gray, linestyle: 'dotted' } }],
    barColors,
  };
}

export const AwesomeAcceleratorZoneOscillator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
