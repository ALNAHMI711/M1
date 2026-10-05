/**
 * Vacuum Candles
 *
 * Price candles with a black body whose transparency shows the volume efficiency of the bar: eff = volume /
 * (high - low) * Multiplier, relative to the average efficiency (SMA of volume / SMA of high - low over Length bars),
 * clamped to 0..1. Transparency = int(100 * clamped): bars with a large range for their volume ("vacuum") get a
 * dark body, bars with much volume for their range a transparent body. Wicks and borders are transparent.
 *
 * Reference: "Vacuum Candles [XrayAlgo]" by XrayAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © XrayAlgo
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';

export interface VacuumCandlesInputs {
  /** Length */
  len: number;
  /** Multiplier */
  mult: number;
}

export const defaultInputs: VacuumCandlesInputs = {
  len: 15,
  mult: 1.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Length', defval: 15, min: 1, max: 100 },
  { id: 'mult', type: 'float', title: 'Multiplier', defval: 1.0, min: 0.1, max: 3, step: 0.1 },
];

// Only candles (plotcandle): no line plots
export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [
  { id: 'vacuum', title: 'PlotCandle' },
];

export const metadata = {
  title: 'Vacuum Candles [XrayAlgo]',
  shortTitle: 'Vacuum Candles [XrayAlgo]',
  overlay: true,
};

export function calculate(
  bars: Bar[],
  inputs: Partial<VacuumCandlesInputs> = {},
): Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const volume = bars.map((b) => b.volume ?? NaN);
  const currMove = bars.map((b) => b.high - b.low);

  const avgVolume = A(ta.sma(S(volume), cfg.len));
  const avgMove = A(ta.sma(S(currMove), cfg.len));

  const transparentCol = color.rgb(0, 0, 0, 100);
  const candles: PlotCandleData[] = [];
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    // Plain division as Pine: x / 0 is +-infinity, 0 / 0 is na
    const eff = (volume[i] / currMove[i]) * cfg.mult;
    const avgEff = avgVolume[i] / avgMove[i];
    const relEff = eff / avgEff;
    const clampedEff = Math.max(0, Math.min(relEff, 1));
    const inefficientAlpha = Math.trunc(100 * clampedEff); // int(): na stays na
    candles.push({
      time: b.time as number,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      color: color.rgb(0, 0, 0, inefficientAlpha),
      wickColor: transparentCol,
      borderColor: transparentCol,
      forceOverlay: true,
    });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    plotCandles: { vacuum: candles },
  };
}

export const VacuumCandles = { calculate, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig };
