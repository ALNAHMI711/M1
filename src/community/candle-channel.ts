/**
 * Candle Channel
 *
 * A channel around the SMA of the candle midpoint (high + low) / 2. The half width is the SMA of the candle height
 * (high - low) times `scale` / 100. Each half of the channel is split into 12 layers by hidden levels; the layers
 * are filled with the band colour, more transparent near the centre (gradient), or one solid fill covers the whole
 * channel. Signals: a bearish candle that closes back below the upper band after a close above it, a bullish candle
 * that closes back above the lower band after a close below it, and crosses of the close with the midpoint SMA.
 *
 * Reference: "Candle Channel" by Uncle_the_shooter
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Uncle_the_shooter
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface CandleChannelInputs {
  /** SMA length of the candle midpoint and of the candle height */
  length: number;
  /** Band scaling (% of the average candle height) */
  scale: number;
  /** Channel fill: 'Gradient', 'Solid' or 'None' */
  fillType: 'Gradient' | 'Solid' | 'None';
  /** Upper band and upper gradient colour */
  colUpper: string;
  /** Lower band and lower gradient colour */
  colLower: string;
  /** Colour of the solid fill */
  solidFillColor: string;
  /** Show the band reversal signals */
  showReturnSignals: boolean;
  /** Lower band reversal signal colour */
  bullishSignalColor: string;
  /** Upper band reversal signal colour */
  bearishSignalColor: string;
  /** Show the SMA crossover signals */
  showSmaSignals: boolean;
  smaCrossUpColor: string;
  smaCrossDownColor: string;
}

export const defaultInputs: CandleChannelInputs = {
  length: 20,
  scale: 200.0,
  fillType: 'Gradient',
  colUpper: 'rgb(162, 16, 6)',
  colLower: 'rgb(6, 162, 47)',
  solidFillColor: color.gray,
  showReturnSignals: true,
  bullishSignalColor: color.green,
  bearishSignalColor: color.red,
  showSmaSignals: true,
  smaCrossUpColor: color.green,
  smaCrossDownColor: color.red,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'SMA Length for Candle Midpoint', defval: 20, min: 1 },
  { id: 'scale', type: 'float', title: 'Band Scaling (% of Average Candle Height)', defval: 200.0, min: 1.0, step: 1.0 },
  { id: 'fillType', type: 'string', title: 'Fill Type', defval: 'Gradient', options: ['Gradient', 'Solid', 'None'] },
  { id: 'colUpper', type: 'color', title: 'Upper Band and Gradient Color', defval: 'rgb(162, 16, 6)' },
  { id: 'colLower', type: 'color', title: 'Lower Band and Gradient Color', defval: 'rgb(6, 162, 47)' },
  { id: 'solidFillColor', type: 'color', title: 'Solid Fill Color', defval: color.gray },
  { id: 'showReturnSignals', type: 'bool', title: 'Show Band Reversal Signals', defval: true },
  { id: 'bullishSignalColor', type: 'color', title: 'Lower Band Reversal Signal Color', defval: color.green },
  { id: 'bearishSignalColor', type: 'color', title: 'Upper Band Reversal Signal Color', defval: color.red },
  { id: 'showSmaSignals', type: 'bool', title: 'Show SMA Crossover Signals', defval: true },
  { id: 'smaCrossUpColor', type: 'color', title: 'SMA Crossover Up Signal Color', defval: color.green },
  { id: 'smaCrossDownColor', type: 'color', title: 'SMA Crossover Down Signal Color', defval: color.red },
];

/** The 24 hidden gradient levels: 0..11 from the upper band to the centre, 12..23 from the centre to the lower band */
const LEVELS = 24;

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Candle Midpoint SMA', color: String(color.new('#a5a7ad', 70)), lineWidth: 1 },
  { id: 'plot1', title: 'Upper Band', color: 'rgb(162, 16, 6)', lineWidth: 1 },
  { id: 'plot2', title: 'Lower Band', color: 'rgb(6, 162, 47)', lineWidth: 1 },
  { id: 'plot3', title: 'Midpoint', color: '#2962FF', lineWidth: 1, display: 'none' },
  ...Array.from({ length: LEVELS }, (_v, k): PlotConfig => ({
    id: `plot${4 + k}`, title: `Gradient Level ${k}`, color: '#2962FF', lineWidth: 1, display: 'none',
  })),
];

export const metadata = {
  title: 'Candle Channel',
  shortTitle: 'Candle Channel',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<CandleChannelInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  const close = bars.map((b) => b.close);
  // candleMid = (high + low) / 2; midSma = ta.sma(candleMid, length); avgRange = ta.sma(high - low, length)
  const midSma = A(ta.sma(S(bars.map((b) => (b.high + b.low) / 2)), cfg.length));
  const avgRange = A(ta.sma(S(bars.map((b) => b.high - b.low)), cfg.length));
  const upperBand: number[] = new Array(n);
  const lowerBand: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const offset = (avgRange[i] * cfg.scale) / 100;
    upperBand[i] = midSma[i] + offset;
    lowerBand[i] = midSma[i] - offset;
  }

  // ta.crossover(close, midSma) / ta.crossunder(close, midSma): run on every bar (left side of `and` is an input)
  const crossUp = ta.crossover(S(close), S(midSma)).toArray();
  const crossDown = ta.crossunder(S(close), S(midSma)).toArray();

  const t = (i: number) => bars[i].time;
  const plots: Record<string, Array<{ time: number; value: number; color?: string }>> = {};
  plots.plot0 = bars.map((_b, i) => ({ time: t(i), value: midSma[i] }));
  plots.plot1 = bars.map((_b, i) => ({ time: t(i), value: upperBand[i], color: cfg.colUpper }));
  plots.plot2 = bars.map((_b, i) => ({ time: t(i), value: lowerBand[i], color: cfg.colLower }));
  const midCenter = bars.map((_b, i) => (upperBand[i] + lowerBand[i]) / 2);
  plots.plot3 = bars.map((_b, i) => ({ time: t(i), value: midCenter[i] }));
  for (let k = 0; k < LEVELS; k++) {
    plots[`plot${4 + k}`] = bars.map((_b, i) => {
      // mid0..mid11: upperBand - (upperBand - midCenter) * k / 12
      // mid12..mid23: midCenter + (lowerBand - midCenter) * (k - 11) / 12
      const u = upperBand[i];
      const m = midCenter[i];
      const value = k < 12 ? u - ((u - m) * k) / 12 : m + ((lowerBand[i] - m) * (k - 11)) / 12;
      return { time: t(i), value };
    });
  }

  // Fills: plotUpper / mid0, mid0 / mid1, ..., mid10 / mid11 (colUpper, transparency 60..93), mid11 / mid12 (gray 95),
  // mid12 / mid13, ..., mid22 / mid23 (colLower, transparency 90..60); then plotUpper / plotLower (solid)
  const gradient = cfg.fillType === 'Gradient';
  const constant = (c: string) => new Array<string>(n).fill(c);
  const fills: NonNullable<IndicatorResult['fills']> = [];
  const level = (k: number) => `plot${4 + k}`;
  const gradFill = (plot1: string, plot2: string, c: string, tr: number) => {
    fills.push({ plot1, plot2, options: { title: 'Plots Background' },
      colors: constant(gradient ? String(color.new(c, tr)) : 'transparent') });
  };
  gradFill('plot1', level(0), cfg.colUpper, 60);
  for (let k = 0; k < 11; k++) gradFill(level(k), level(k + 1), cfg.colUpper, 63 + 3 * k);
  gradFill(level(11), level(12), color.gray, 95);
  for (let k = 12; k < 23; k++) gradFill(level(k), level(k + 1), cfg.colLower, 90 - 3 * (k - 12));
  fills.push({ plot1: 'plot1', plot2: 'plot2', options: { title: 'Solid Fill' },
    colors: constant(cfg.fillType === 'Solid' ? String(color.new(cfg.solidFillColor, 90)) : 'transparent') });

  const markers: MarkerData[] = [];
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    // aboveUpper = close[1] > upperBand[1]; returnToUpper = ... and close < upperBand and close < open
    const aboveUpper = i > 0 && gt(close[i - 1], upperBand[i - 1]);
    const returnToUpper = cfg.showReturnSignals && aboveUpper && lt(b.close, upperBand[i]) && lt(b.close, b.open);
    const belowLower = i > 0 && lt(close[i - 1], lowerBand[i - 1]);
    const returnToLower = cfg.showReturnSignals && belowLower && gt(b.close, lowerBand[i]) && gt(b.close, b.open);
    const smaCrossUp = cfg.showSmaSignals && !!crossUp[i];
    const smaCrossDown = cfg.showSmaSignals && !!crossDown[i];
    if (returnToUpper) {
      markers.push({ time: t(i), position: 'aboveBar', shape: 'triangleDown', color: cfg.bearishSignalColor, size: 'tiny' });
    }
    if (returnToLower) {
      markers.push({ time: t(i), position: 'belowBar', shape: 'triangleUp', color: cfg.bullishSignalColor, size: 'tiny' });
    }
    if (smaCrossUp) {
      markers.push({ time: t(i), position: 'belowBar', shape: 'circle', color: cfg.smaCrossUpColor, size: 'tiny' });
    }
    if (smaCrossDown) {
      markers.push({ time: t(i), position: 'aboveBar', shape: 'circle', color: cfg.smaCrossDownColor, size: 'tiny' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills,
    markers,
  };
}

export const CandleChannel = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
