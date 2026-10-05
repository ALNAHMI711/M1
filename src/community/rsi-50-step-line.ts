/**
 * RSI-50 Step Line
 *
 * A step line on the price: the close of the last bar where the RSI crossed 50 (either direction); it stays flat
 * until the next cross. The line and the cross circles have one of four colours: close above the level with the
 * RSI rising / falling, close at or below the level with the RSI falling / rising.
 *
 * Reference: "RSI-50 Step Line" by Devjames
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Devjames
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface Rsi50StepLineInputs {
  rsiLength: number;
  rsiSource: SourceType;
  /** Line width (the plot width is static: the default width 2 is drawn) */
  lineWidth: number;
  /** Above + Rising (bullish, strengthening) */
  colorAboveRising: string;
  /** Above + Falling (bullish, fading) */
  colorAboveFalling: string;
  /** Below + Falling (bearish, strengthening) */
  colorBelowFalling: string;
  /** Below + Rising (bearish, recovering) */
  colorBelowRising: string;
}

export const defaultInputs: Rsi50StepLineInputs = {
  rsiLength: 9,
  rsiSource: 'close',
  lineWidth: 2,
  colorAboveRising: '#00FF00',
  colorAboveFalling: '#006400',
  colorBelowFalling: '#FF0000',
  colorBelowRising: '#8B0000',
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 9, min: 1 },
  { id: 'rsiSource', type: 'source', title: 'RSI Source', defval: 'close' },
  { id: 'lineWidth', type: 'int', title: 'Line Width', defval: 2, min: 1, max: 5 },
  { id: 'colorAboveRising', type: 'color', title: 'Above + Rising (Bullish, Strengthening)', defval: '#00FF00' },
  { id: 'colorAboveFalling', type: 'color', title: 'Above + Falling (Bullish, Fading)', defval: '#006400' },
  { id: 'colorBelowFalling', type: 'color', title: 'Below + Falling (Bearish, Strengthening)', defval: '#FF0000' },
  { id: 'colorBelowRising', type: 'color', title: 'Below + Rising (Bearish, Recovering)', defval: '#8B0000' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI-50 Level', color: '#00FF00', lineWidth: 2, style: 'stepline' },
];

export const metadata = {
  title: 'RSI-50 Step Line',
  shortTitle: 'RSI-50 Step Line',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<Rsi50StepLineInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const rsi = ta.rsi(getSourceSeries(bars, cfg.rsiSource), cfg.rsiLength).toArray().map((v) => v ?? NaN);

  const plot0: { time: number; value: number; color: string }[] = [];
  const markers: MarkerData[] = [];
  let level = NaN; // var float level = na
  for (let i = 0; i < n; i++) {
    const close = bars[i].close;
    // ta.cross(rsiValue, 50): (a[1] <= 50 and a > 50) or (a[1] >= 50 and a < 50), compared exactly (no 1e-10
    // tolerance; na compares false)
    const prev = i > 0 ? rsi[i - 1] : NaN;
    const crossed = (prev <= 50 && rsi[i] > 50) || (prev >= 50 && rsi[i] < 50);
    if (crossed) level = close;
    const above = gt(close, level);
    const rising = gt(rsi[i], prev);
    const stateColor = above && rising ? cfg.colorAboveRising
      : above && !rising ? cfg.colorAboveFalling
        : !above && !rising ? cfg.colorBelowFalling
          : cfg.colorBelowRising;
    plot0.push({ time: bars[i].time, value: level, color: stateColor });
    // plotshape(crossed ? close : na, style = shape.circle, location = location.absolute, size = size.tiny)
    if (crossed) {
      markers.push({ time: bars[i].time, position: 'atPriceMiddle', price: close, shape: 'circle', color: stateColor, size: 'tiny' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
    markers,
  };
}

export const Rsi50StepLine = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
