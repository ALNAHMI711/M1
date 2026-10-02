/**
 * [Mad] Level2 Signalfilter Liquidity Protection
 *
 * Filters a routed signal (the sign of source * input multiplier: 1 long, -1 short, 0 none). With the protection on,
 * the first long (short) signal passes and arms a lock with release levels at a percentage of the close; repeated
 * signals of the same side are suppressed until the close leaves the band (above the upper or below the lower level),
 * which releases the lock. A 0 signal clears the output while a lock is armed. With the protection off, the signals
 * pass 1:1. Plots: the input signal (crosses), the filtered output (columns), the release levels (hidden), the lock
 * state (+1 long lock, -1 short lock) and the close (hidden), with levels at +1, 0 and -1 times the output multiplier.
 *
 * Reference: "[Mad] Level2 Signalfilter Liquidity Protection" by djmad
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface Level2SignalfilterLiquidityProtectionInputs {
  /** Routed signal source */
  signalSource: SourceType;
  /** Input multiplier (a negative value reverses the signal) */
  inputMult: number;
  /** Plot / output multiplier */
  outputMult: number;
  /** Liquidity protection on */
  useLiqProt: boolean;
  /** Upper release level of a long lock, in % of the arming close */
  growLongPct: number;
  /** Lower release level of a long lock, in % of the arming close */
  shrinkLongPct: number;
  /** Upper release level of a short lock, in % of the arming close */
  growShortPct: number;
  /** Lower release level of a short lock, in % of the arming close */
  shrinkShortPct: number;
}

export const defaultInputs: Level2SignalfilterLiquidityProtectionInputs = {
  signalSource: 'close',
  inputMult: 1.0,
  outputMult: 1.0,
  useLiqProt: true,
  growLongPct: 101.0,
  shrinkLongPct: 99.0,
  growShortPct: 101.0,
  shrinkShortPct: 99.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'signalSource', type: 'source', title: 'Select L2 Indicator Signal', defval: 'close' },
  { id: 'inputMult', type: 'float', title: 'Input multiplier / reverse (-value)', defval: 1.0 },
  { id: 'outputMult', type: 'float', title: 'Plot/Output multiplier', defval: 1.0 },
  { id: 'useLiqProt', type: 'bool', title: 'Liquidity Safer active', defval: true },
  { id: 'growLongPct', type: 'float', title: 'Grow for next long', defval: 101.0 },
  { id: 'shrinkLongPct', type: 'float', title: 'Shrink for next long', defval: 99.0 },
  { id: 'growShortPct', type: 'float', title: 'Grow for next short', defval: 101.0 },
  { id: 'shrinkShortPct', type: 'float', title: 'Shrink for next short', defval: 99.0 },
];

const COL_LONG = '#4C9900';
const COL_SHORT = '#CC0000';
const COL_TRANSPARENT = String(color.new(color.black, 100));
const DEFAULT_PLOT = '#2962FF';
const LVL_OFF_LOW = 0.0; // upper release level disarmed
const LVL_OFF_HIGH = 10000000.0; // lower release level disarmed

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Signalinput', color: COL_LONG, lineWidth: 1, style: 'cross' },
  { id: 'plot1', title: 'Signaloutput', color: COL_LONG, lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'Long release upper', color: DEFAULT_PLOT, lineWidth: 1, style: 'cross', display: 'none' },
  { id: 'plot3', title: 'Short release upper', color: DEFAULT_PLOT, lineWidth: 1, style: 'cross', display: 'none' },
  { id: 'plot4', title: 'Long release lower', color: DEFAULT_PLOT, lineWidth: 1, style: 'cross', display: 'none' },
  { id: 'plot5', title: 'Short release lower', color: DEFAULT_PLOT, lineWidth: 1, style: 'cross', display: 'none' },
  { id: 'plot6', title: 'Lock state', color: color.yellow, lineWidth: 1, style: 'cross' },
  { id: 'plot7', title: 'Close (hidden)', color: DEFAULT_PLOT, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: '[Mad] Level2 Signalfilter Liquidity Protection',
  shortTitle: '[Mad] L2 Filter LiqProt',
  overlay: false,
  precision: 2,
  format: 'price',
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<Level2SignalfilterLiquidityProtectionInputs> = {},
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const source = getSourceSeries(bars, cfg.signalSource).toArray().map((v) => v ?? NaN);
  const out = cfg.outputMult;

  let longUpper = LVL_OFF_LOW;
  let longLower = LVL_OFF_HIGH;
  let shortUpper = LVL_OFF_LOW;
  let shortLower = LVL_OFF_HIGH;
  let longActive = false;
  let shortActive = false;
  let filterBuy = 0;
  let filterSell = 0;

  type Point = { time: number; value: number; color?: string };
  const plots: Record<string, Point[]> = {};
  for (let k = 0; k < 8; k++) plots[`plot${k}`] = [];
  const fin = (x: number) => (Number.isFinite(x) ? x : NaN);

  for (let i = 0; i < n; i++) {
    const close = bars[i].close;
    const weightedSignal = source[i] * cfg.inputMult;
    const signal = gt(weightedSignal, 0) ? 1 : lt(weightedSignal, 0) ? -1 : 0;

    if (cfg.useLiqProt) {
      if (signal === 1 && !longActive) {
        longActive = true;
        longUpper = close * (cfg.growLongPct / 100);
        longLower = close * (cfg.shrinkLongPct / 100);
        filterBuy = 1;
      } else if (signal === 1 && longActive) {
        filterBuy = 0;
      } else if (signal === -1 && !shortActive) {
        shortActive = true;
        shortUpper = close * (cfg.growShortPct / 100);
        shortLower = close * (cfg.shrinkShortPct / 100);
        filterSell = -1;
      } else if (signal === -1 && shortActive) {
        filterSell = 0;
      } else if (signal === 0 && (shortActive || longActive)) {
        filterBuy = 0;
        filterSell = 0;
      }
    } else if (signal === 1) {
      filterBuy = 1;
    } else if (signal === -1) {
      filterSell = -1;
    } else {
      filterBuy = 0;
      filterSell = 0;
    }

    // Release the locks once the close leaves the protection band
    if (shortActive && (gt(close, shortUpper) || lt(close, shortLower))) {
      shortUpper = LVL_OFF_LOW;
      shortLower = LVL_OFF_HIGH;
      shortActive = false;
    }
    if (longActive && (gt(close, longUpper) || lt(close, longLower))) {
      longUpper = LVL_OFF_LOW;
      longLower = LVL_OFF_HIGH;
      longActive = false;
    }

    const filterOut = filterBuy > 0 ? 1 : filterSell < 0 ? -1 : 0;
    const signalColor = signal > 0 ? COL_LONG : signal < 0 ? COL_SHORT : color.yellow;
    const filterColor = filterOut > 0 ? COL_LONG : filterOut < 0 ? COL_SHORT : COL_TRANSPARENT;

    const t = bars[i].time;
    plots.plot0.push({ time: t, value: signal !== 0 ? fin(signal * out) : NaN, color: signalColor });
    plots.plot1.push({ time: t, value: filterOut !== 0 ? fin(filterOut * out) : 0, color: filterColor });
    plots.plot2.push({ time: t, value: eq(longUpper, LVL_OFF_LOW) ? NaN : fin(longUpper) });
    plots.plot3.push({ time: t, value: eq(shortUpper, LVL_OFF_LOW) ? NaN : fin(shortUpper) });
    plots.plot4.push({ time: t, value: eq(longLower, LVL_OFF_HIGH) ? NaN : fin(longLower) });
    plots.plot5.push({ time: t, value: eq(shortLower, LVL_OFF_HIGH) ? NaN : fin(shortLower) });
    plots.plot6.push({ time: t, value: longActive ? 1 : shortActive ? -1 : NaN });
    plots.plot7.push({ time: t, value: fin(close) });
  }

  const level = { color: '#787B86', linestyle: 'dashed' as const, linewidth: 1 };
  return {
    metadata: {
      title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay,
      precision: metadata.precision, format: metadata.format,
    },
    plots,
    hlines: [
      { value: 1 * out, options: { title: 'Level +1', ...level } },
      { value: 0, options: { title: 'Level 0', ...level } },
      { value: -1 * out, options: { title: 'Level -1', ...level } },
    ],
  };
}

export const Level2SignalfilterLiquidityProtection = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
