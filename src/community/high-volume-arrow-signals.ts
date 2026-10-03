/**
 * High Volume Arrow Signals (Ajustável)
 *
 * SMA of the volume over `lookbackLength` bars. A bar has high volume when its volume is above the SMA times the
 * multiplier. A high-volume bullish bar (close > open) gets a blue up arrow below the bar; a high-volume bearish bar
 * (close < open) gets a fuchsia down arrow above the bar. The volume SMA is also plotted.
 *
 * Reference: "High Volume Arrow Signals (Ajustável)" by IdeManson
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface HighVolumeArrowSignalsInputs {
  /** Volume MA length */
  lookbackLength: number;
  /** Volume multiplier */
  multiplier: number;
}

export const defaultInputs: HighVolumeArrowSignalsInputs = {
  lookbackLength: 20,
  multiplier: 1.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookbackLength', type: 'int', title: 'Volume MA Length', defval: 20, min: 5 },
  { id: 'multiplier', type: 'float', title: 'Volume Multiplier', defval: 1.5, min: 1.0 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume MA', color: color.gray, lineWidth: 1 },
];

export const metadata = {
  title: 'High Volume Arrow Signals (Ajustável)',
  shortTitle: 'High Volume Arrow Signals (Ajustável)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<HighVolumeArrowSignalsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const volume = bars.map((b) => b.volume ?? NaN);
  const volMa = ta.sma(Series.fromArray(bars, volume), cfg.lookbackLength).toArray().map((v) => v ?? NaN);

  const buyColor = String(color.new(color.blue, 0));
  const sellColor = String(color.new(color.fuchsia, 0));
  const markers: MarkerData[] = [];
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const isHighVol = gt(volume[i], volMa[i] * cfg.multiplier);
    const t = b.time as number;
    // plotshape(buy_signal, "High Volume Buy", shape.arrowup, location.belowbar, color.new(color.blue, 0), size.normal)
    if (isHighVol && gt(b.close, b.open)) {
      markers.push({ time: t, position: 'belowBar', shape: 'arrowUp', color: buyColor, size: 'normal' });
    }
    // plotshape(sell_signal, "High Volume Sell", shape.arrowdown, location.abovebar, color.new(color.fuchsia, 0), size.normal)
    if (isHighVol && gt(b.open, b.close)) {
      markers.push({ time: t, position: 'aboveBar', shape: 'arrowDown', color: sellColor, size: 'normal' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: bars.map((b, i) => ({ time: b.time, value: volMa[i], color: color.gray })) },
    markers,
  };
}

export const HighVolumeArrowSignals = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
