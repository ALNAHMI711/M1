/**
 * Primitive Delta Divergence
 *
 * Meta-candle of the last Lookback Period bars: open = open[n - 1], close = close. The volume of these n bars is
 * split into up volume (close > open), down volume (close < open) and neutral volume. Volume bias =
 * (up - down) / (up + down) (0 when up + down is not > 0). Bearish divergence (red dot above the bar): the
 * meta-candle is up and the bias < 0. Bullish divergence (lime dot below the bar): the meta-candle is down and the
 * bias > 0.
 *
 * Reference: "Primitive Delta Divergence" by bfoster238
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © bfoster238
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface PrimitiveDeltaDivergenceInputs {
  /** Lookback Period */
  n: number;
}

export const defaultInputs: PrimitiveDeltaDivergenceInputs = {
  n: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'n', type: 'int', title: 'Lookback Period', defval: 20, min: 1 },
];

// No plot(): the outputs are the plotchar markers
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Primitive Delta Divergence',
  shortTitle: 'DeltaDiv',
  overlay: true,
};

/** Pine float comparisons: equal within 1e-10; na compares false */
const EPS = 1e-10;
const gt = (a: number, b: number) => !isNaN(a) && !isNaN(b) && a - b > EPS;
const lt = (a: number, b: number) => !isNaN(a) && !isNaN(b) && b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<PrimitiveDeltaDivergenceInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const { n } = { ...defaultInputs, ...inputs };
  const len = bars.length;
  // x[k]: na before the first bar
  const at = (i: number, f: (b: Bar) => number) => (i >= 0 ? f(bars[i]) : NaN);

  const markers: MarkerData[] = [];
  for (let i = 0; i < len; i++) {
    const b = bars[i];
    const metaOpen = at(i - (n - 1), (x) => x.open);
    const metaClose = b.close;
    const priceUp = gt(metaClose, metaOpen);
    const priceDown = lt(metaClose, metaOpen);

    // getBucketAnalysis(0, n)
    let upVolume = 0.0;
    let downVolume = 0.0;
    let neutralVolume = 0.0;
    for (let k = 0; k <= n - 1; k++) {
      const candleOpen = at(i - k, (x) => x.open);
      const candleClose = at(i - k, (x) => x.close);
      const candleVolume = at(i - k, (x) => x.volume ?? NaN);
      if (gt(candleClose, candleOpen)) upVolume = upVolume + candleVolume;
      else if (lt(candleClose, candleOpen)) downVolume = downVolume + candleVolume;
      else neutralVolume = neutralVolume + candleVolume;
    }
    void neutralVolume; // returned by the Pine function, not used by calculateVolumeBias

    // calculateVolumeBias(up, down, neutral)
    const directionalVolume = upVolume + downVolume;
    const rawVolumeBias = gt(directionalVolume, 0) ? (upVolume - downVolume) / directionalVolume : 0.0;

    const volumeUp = gt(rawVolumeBias, 0);
    const volumeDown = lt(rawVolumeBias, 0);
    const bearishDivergence = priceUp && volumeDown;
    const bullishDivergence = priceDown && volumeUp;

    const t = b.time as number;
    // plotchar(bullish_divergence, 'Bullish Divergence', '●', location.belowbar, color.lime, size = size.tiny)
    if (bullishDivergence) {
      markers.push({ time: t, position: 'belowBar', shape: 'circle', color: 'transparent', text: '●', textColor: color.lime, size: 'tiny' });
    }
    // plotchar(bearish_divergence, 'Bearish Divergence', '●', location.abovebar, color.red, size = size.tiny)
    if (bearishDivergence) {
      markers.push({ time: t, position: 'aboveBar', shape: 'circle', color: 'transparent', text: '●', textColor: color.red, size: 'tiny' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
  };
}

export const PrimitiveDeltaDivergence = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
