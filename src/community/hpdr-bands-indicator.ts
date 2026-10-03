/**
 * HPDR Bands
 *
 * A wide range: the highest high over `length` bars * 1.15 and the lowest low * 0.85; the midline is their average.
 * The outer bands blend 70 % of this range with 30 % of the highest high / lowest low over `probLength` bars. Seven
 * levels are drawn on each side, from the outer band (100 %) towards the midline (95, 88, 78, 61, 50, 38 % of the
 * distance between the outer band and the midline).
 *
 * Reference: "HPDR Bands Indicator" by afonso_77
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Trigooo
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface HpdrBandsIndicatorInputs {
  /** Lookback length of the wide range */
  length: number;
  /** Lookback length of the recent highest high / lowest low */
  probLength: number;
}

export const defaultInputs: HpdrBandsIndicatorInputs = {
  length: 100,
  probLength: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Lookback Length', defval: 100, min: 1 },
  { id: 'probLength', type: 'int', title: 'Probability Length', defval: 10, min: 1 },
];

/** Levels from the outer band towards the midline, with their colours */
const LEVELS: { pct: number; ratio: number; color: string }[] = [
  { pct: 100, ratio: 0, color: '#00FF00' },
  { pct: 95, ratio: 0.95, color: '#0000FF' },
  { pct: 88, ratio: 0.88, color: '#00FFFF' },
  { pct: 78, ratio: 0.78, color: '#FFFF00' },
  { pct: 61, ratio: 0.61, color: '#FFA500' },
  { pct: 50, ratio: 0.5, color: '#FF0000' },
  { pct: 38, ratio: 0.38, color: '#8B0000' },
];

export const plotConfig: PlotConfig[] = [
  ...LEVELS.map((l, k) => ({ id: `plot${k}`, title: `Level ${l.pct} High`, color: l.color, lineWidth: 1 })),
  ...LEVELS.map((l, k) => ({ id: `plot${k + 7}`, title: `Level ${l.pct} Low`, color: l.color, lineWidth: 1 })),
  { id: 'plot14', title: 'Midline', color: color.white, lineWidth: 3 },
];

export const metadata = {
  title: 'HPDR Bands',
  shortTitle: 'HPDR Bands',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<HpdrBandsIndicatorInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const high = Series.fromArray(bars, bars.map((b) => b.high));
  const low = Series.fromArray(bars, bars.map((b) => b.low));

  const longHigh = A(ta.highest(high, cfg.length));
  const longLow = A(ta.lowest(low, cfg.length));
  const recentHigh = A(ta.highest(high, cfg.probLength));
  const recentLow = A(ta.lowest(low, cfg.probLength));

  const plots: Record<string, { time: number; value: number; color: string }[]> = {};
  plotConfig.forEach((p) => {
    plots[p.id] = [];
  });
  bars.forEach((b, i) => {
    const visibleHigh = longHigh[i] * 1.15;
    const visibleLow = longLow[i] * 0.85;
    const midline = (visibleHigh + visibleLow) / 2;
    const adaptedHigh = visibleHigh * 0.7 + recentHigh[i] * 0.3;
    const adaptedLow = visibleLow * 0.7 + recentLow[i] * 0.3;
    LEVELS.forEach((l, k) => {
      // level_100_high = adaptedHigh; level_X_high = adaptedHigh - (adaptedHigh - midline) * X
      const hi = l.pct === 100 ? adaptedHigh : adaptedHigh - (adaptedHigh - midline) * l.ratio;
      const lo = l.pct === 100 ? adaptedLow : adaptedLow + (midline - adaptedLow) * l.ratio;
      plots[`plot${k}`].push({ time: b.time, value: hi, color: l.color });
      plots[`plot${k + 7}`].push({ time: b.time, value: lo, color: l.color });
    });
    plots.plot14.push({ time: b.time, value: midline, color: color.white });
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
  };
}

export const HpdrBandsIndicator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
