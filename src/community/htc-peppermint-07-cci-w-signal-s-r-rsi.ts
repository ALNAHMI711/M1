/**
 * HTC peppermint_07 CCI w signal + s&r RSI
 *
 * RSI and CCI lines in one pane, with dotted lines at the CCI overbought / oversold levels. The background is grey
 * when the RSI is above its overbought level and teal when it is below its oversold level. A red label at the top of
 * the pane marks the bars where both the RSI and the CCI are above their overbought levels; a teal label at the bottom
 * marks the bars where both are below their oversold levels.
 *
 * Reference: "HTC peppermint_07 CCI w signal + s&r RSI " by peppermint07
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType, type Series } from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';

export interface HtcPeppermint07CciRsiInputs {
  rsiLength: number;
  rsiOverbought: number;
  rsiOversold: number;
  rsiSource: SourceType;
  cciLength: number;
  cciOverbought: number;
  cciOversold: number;
  cciSource: SourceType;
}

export const defaultInputs: HtcPeppermint07CciRsiInputs = {
  rsiLength: 9,
  rsiOverbought: 70,
  rsiOversold: 30,
  rsiSource: 'close',
  cciLength: 20,
  cciOverbought: 100,
  cciOversold: -100,
  cciSource: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 9 },
  { id: 'rsiOverbought', type: 'int', title: 'RSI Overbought Level', defval: 70 },
  { id: 'rsiOversold', type: 'int', title: 'RSI Oversold Level', defval: 30 },
  { id: 'rsiSource', type: 'source', title: 'RSI Source', defval: 'close' },
  { id: 'cciLength', type: 'int', title: 'CCI Length', defval: 20 },
  { id: 'cciOverbought', type: 'int', title: 'CCI Overbought Level', defval: 100 },
  { id: 'cciOversold', type: 'int', title: 'CCI Oversold Level', defval: -100 },
  { id: 'cciSource', type: 'source', title: 'CCI Source', defval: 'close' },
];

const RSI_COLOR = 'rgb(20, 126, 168)';
const CCI_COLOR = '#1b1b1b';
const LEVEL_COLOR = 'rgb(71, 71, 71)';
const OB_BG = '#4d4b4b1a';
const OS_BG = '#2ca4b41a';
const OB_SHAPE = '#ee4444e7';
const OS_SHAPE = '#0ea8a1';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: RSI_COLOR, lineWidth: 1 },
  { id: 'plot1', title: 'CCI', color: CCI_COLOR, lineWidth: 1 },
];

export const metadata = {
  title: 'HTC peppermint_07 CCI w signal + s&r RSI ',
  shortTitle: 'HTC peppermint_07 CCI w signal + s&r RSI ',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<HtcPeppermint07CciRsiInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  const rsi = A(ta.rsi(getSourceSeries(bars, cfg.rsiSource), cfg.rsiLength));
  const cci = A(ta.cci(getSourceSeries(bars, cfg.cciSource), cfg.cciLength));

  const bgColors: BgColorData[] = [];
  const markers: MarkerData[] = [];
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    // bgcolor(rsiValue > rsiOverbought ? #4d4b4b1a : na, title = "RSI Overbought Background")
    if (gt(rsi[i], cfg.rsiOverbought)) bgColors.push({ time: t, color: OB_BG });
    // bgcolor(rsiValue < rsiOversold ? #2ca4b41a : na, title = "RSI Oversold Background")
    if (lt(rsi[i], cfg.rsiOversold)) bgColors.push({ time: t, color: OS_BG });
    // plotshape(series = cond ? rsiValue : na, location.top / location.bottom, ...): with a location other than
    // absolute the series is read as a bool: na and 0 draw no shape (an RSI of 0 draws nothing)
    if (gt(rsi[i], cfg.rsiOverbought) && gt(cci[i], cfg.cciOverbought) && !isNaN(rsi[i]) && rsi[i] !== 0) {
      markers.push({ time: t, position: 'top', shape: 'labelUp', color: OB_SHAPE });
    }
    if (lt(rsi[i], cfg.rsiOversold) && lt(cci[i], cfg.cciOversold) && !isNaN(rsi[i]) && rsi[i] !== 0) {
      markers.push({ time: t, position: 'bottom', shape: 'labelDown', color: OS_SHAPE });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: rsi[i], color: RSI_COLOR })),
      plot1: bars.map((b, i) => ({ time: b.time, value: cci[i], color: CCI_COLOR })),
    },
    hlines: [
      { value: cfg.cciOverbought, options: { title: 'CCI Overbought', color: LEVEL_COLOR, linestyle: 'dotted' } },
      { value: cfg.cciOversold, options: { title: 'CCI Oversold', color: LEVEL_COLOR, linestyle: 'dotted' } },
    ],
    bgColors,
    markers,
  };
}

export const HtcPeppermint07CciRsi = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
