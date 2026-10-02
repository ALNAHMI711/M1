/**
 * VWAP & Dual MA Ribbon Tracker Pro
 *
 * A ribbon (histogram at 1) coloured by the trend state. Green when the fast MA is above the VWAP + cushion and
 * above the slow MA + cushion and the Elder Force Index (EMA of (close - close[1]) * volume) is > 0; red when the
 * fast MA is below the VWAP - cushion and below the slow MA - cushion and the EFI is < 0; blue otherwise. The
 * cushion is ATR * multiplier (0 when the ATR filter is off); the EFI condition is skipped when its filter is off.
 * The MAs are EMAs or SMAs of the close.
 *
 * Timeframe limit: daily and higher timeframes only. Pine `ta.vwap` resets on each new trading day
 * (anchor timeframe.change("1D")). When each bar is one trading day or more, it resets on every bar, so the VWAP is
 * hlc3 of the bar (na when the volume is 0 or na). On intraday bars the reset needs the exchange time zone and the
 * symbol session, which calculate() does not get: calculate() throws an Error when the bar interval
 * (barInterval: most frequent gap between bars) is below one day.
 *
 * Reference: "VWAP & Dual MA Ribbon Tracker Pro" by Simon20cent
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { barInterval } from '../bar-time';

export interface VwapDualMaRibbonTrackerProInputs {
  /** Moving average type */
  maType: 'EMA' | 'SMA';
  /** Fast MA length */
  ma1Length: number;
  /** Slow MA length */
  ma2Length: number;
  /** Require the Elder Force Index in the trade direction */
  useEfiFilter: boolean;
  /** EMA length of the Elder Force Index */
  efiLength: number;
  /** Add an ATR cushion to the comparisons */
  useAtrFilter: boolean;
  atrLength: number;
  atrMultiplier: number;
}

export const defaultInputs: VwapDualMaRibbonTrackerProInputs = {
  maType: 'EMA',
  ma1Length: 4,
  ma2Length: 9,
  useEfiFilter: true,
  efiLength: 2,
  useAtrFilter: true,
  atrLength: 14,
  atrMultiplier: 0.2,
};

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA', options: ['EMA', 'SMA'] },
  { id: 'ma1Length', type: 'int', title: 'MA 1 Length', defval: 4 },
  { id: 'ma2Length', type: 'int', title: 'MA 2 Length', defval: 9 },
  { id: 'useEfiFilter', type: 'bool', title: 'Filter out weak Elder Force Index?', defval: true },
  { id: 'efiLength', type: 'int', title: 'EFI EMA Smoothing Length (Elder Classic = 2)', defval: 2 },
  { id: 'useAtrFilter', type: 'bool', title: 'Use ATR Cushion Filter?', defval: true },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14 },
  { id: 'atrMultiplier', type: 'float', title: 'ATR Multiplier Cushion', defval: 0.2, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trend Ribbon Pro', color: color.blue, lineWidth: 4, style: 'histogram' },
];

export const metadata = {
  title: 'VWAP & Dual MA Ribbon Tracker Pro',
  shortTitle: 'VWAP & Dual MA Ribbon Tracker Pro',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

const DAY_SECONDS = 86400;

export function calculate(bars: Bar[], inputs: Partial<VwapDualMaRibbonTrackerProInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const interval = barInterval(bars);
  if (interval > 0 && interval < DAY_SECONDS) {
    throw new Error(
      'VWAP & Dual MA Ribbon Tracker Pro supports daily and higher timeframes only: on intraday bars ta.vwap resets '
      + 'on each trading day, which needs the exchange time zone and session.',
    );
  }

  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const vol = bars.map((b) => b.volume ?? NaN);

  // ta.vwap (hlc3, anchor timeframe.change("1D")): a new anchor on every daily or higher bar, so
  // sum(hlc3 * volume) / sum(volume) over the bar alone (0 / 0 = na when the volume is 0, na when it is na)
  const vwap = bars.map((b, i) => (((b.high + b.low + b.close) / 3) * vol[i]) / vol[i]);
  // get_ma(type, src, len) => type == 'EMA' ? ta.ema(src, len) : ta.sma(src, len)
  const close = S(bars.map((b) => b.close));
  const ma = (len: number) => A(cfg.maType === 'EMA' ? ta.ema(close, len) : ta.sma(close, len));
  const ma1 = ma(cfg.ma1Length);
  const ma2 = ma(cfg.ma2Length);

  // smoothed_efi = ta.ema((close - close[1]) * volume, efi_length)
  const rawEfi = bars.map((b, i) => (i > 0 ? (b.close - bars[i - 1].close) * vol[i] : NaN));
  const efi = A(ta.ema(S(rawEfi), cfg.efiLength));
  const atr = A(ta.atr(bars, cfg.atrLength));

  const plot0 = new Array(n);
  for (let i = 0; i < n; i++) {
    const efiLongValid = !cfg.useEfiFilter || gt(efi[i], 0);
    const efiShortValid = !cfg.useEfiFilter || lt(efi[i], 0);
    const cushion = cfg.useAtrFilter ? atr[i] * cfg.atrMultiplier : 0.0;
    const isGreen = gt(ma1[i], vwap[i] + cushion) && gt(ma1[i], ma2[i] + cushion) && efiLongValid;
    const isRed = lt(ma1[i], vwap[i] - cushion) && lt(ma1[i], ma2[i] - cushion) && efiShortValid;
    const c = isGreen ? color.green : isRed ? color.red : color.blue;
    plot0[i] = { time: bars[i].time, value: 1, color: c };
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
  };
}

export const VwapDualMaRibbonTrackerPro = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
