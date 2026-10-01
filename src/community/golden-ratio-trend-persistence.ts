/**
 * Golden Ratio Trend Persistence
 *
 * A trend state starts on the first confirmed pivot (a pivot high starts a downtrend, a pivot low an uptrend). In an
 * uptrend the extremity is the highest high (or close) since the trend start and the anchor moves up to every higher
 * confirmed pivot low; the trend level is extremity - ratio * (extremity - anchor). A close below the level flips to
 * a downtrend, with the old extremity as the new anchor (the downtrend is the mirror). The level is drawn as a step
 * line, and the background shows the trend direction.
 *
 * Reference: "Golden Ratio Trend Persistence [EWT]" by YetAnotherTA
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © ZenTrader
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';

export interface GoldenRatioTrendPersistenceInputs {
  /** Pivot lookback left */
  pivotLeft: number;
  /** Pivot lookback right (a pivot is confirmed this many bars later) */
  pivotRight: number;
  /** Fibonacci retracement ratio of the trend level */
  fibRatio: number;
  /** Source of the trend extremity: 'High/Low' or 'Close' */
  extremitySource: 'High/Low' | 'Close';
}

export const defaultInputs: GoldenRatioTrendPersistenceInputs = {
  pivotLeft: 15,
  pivotRight: 10,
  fibRatio: 0.618,
  extremitySource: 'High/Low',
};

export const inputConfig: InputConfig[] = [
  { id: 'pivotLeft', type: 'int', title: 'Pivot Lookback Left', defval: 15, min: 1 },
  { id: 'pivotRight', type: 'int', title: 'Pivot Lookback Right', defval: 10, min: 1 },
  { id: 'fibRatio', type: 'float', title: 'Fibonacci Ratio', defval: 0.618, min: 0.0, max: 1.0 },
  { id: 'extremitySource', type: 'string', title: 'Source for Extremity', defval: 'High/Low', options: ['High/Low', 'Close'] },
];

const UP_COL = String(color.new(color.teal, 0));
const DOWN_COL = String(color.new(color.maroon, 0));
const UP_BG = String(color.new(color.teal, 90));
const DOWN_BG = String(color.new(color.maroon, 90));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trend Level', color: UP_COL, lineWidth: 2, style: 'stepline' },
];

export const metadata = {
  title: 'Golden Ratio Trend Persistence [EWT]',
  shortTitle: 'GRTP',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<GoldenRatioTrendPersistenceInputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const pivotHigh = A(ta.pivothigh(Series.fromArray(bars, bars.map((b) => b.high)), cfg.pivotLeft, cfg.pivotRight));
  const pivotLow = A(ta.pivotlow(Series.fromArray(bars, bars.map((b) => b.low)), cfg.pivotLeft, cfg.pivotRight));
  const useHl = cfg.extremitySource === 'High/Low';

  const plot0: { time: number; value: number; color: string }[] = [];
  const bgColors: BgColorData[] = [];
  let trend = 0; // var int trend = 0
  let anchor = NaN; // var float anchorPrice = na
  let extremity = NaN; // var float extremityPrice = na
  let level = NaN; // var float trendLevel = na

  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const ph = pivotHigh[i];
    const pl = pivotLow[i];
    const sourceUp = useHl ? b.high : b.close;
    const sourceDown = useHl ? b.low : b.close;

    if (trend === 0) {
      if (!isNaN(ph)) {
        trend = -1;
        anchor = ph;
        extremity = sourceDown;
      } else if (!isNaN(pl)) {
        trend = 1;
        anchor = pl;
        extremity = sourceUp;
      }
    } else if (trend === 1) {
      extremity = Math.max(isNaN(extremity) ? sourceUp : extremity, sourceUp);
      if (!isNaN(pl) && gt(pl, anchor)) anchor = pl;
      level = extremity - cfg.fibRatio * (extremity - anchor);
      if (lt(b.close, level)) {
        trend = -1;
        anchor = extremity;
        extremity = sourceDown;
      }
    } else if (trend === -1) {
      extremity = Math.min(isNaN(extremity) ? sourceDown : extremity, sourceDown);
      if (!isNaN(ph) && lt(ph, anchor)) anchor = ph;
      level = extremity + cfg.fibRatio * (anchor - extremity);
      if (gt(b.close, level)) {
        trend = 1;
        anchor = extremity;
        extremity = sourceUp;
      }
    }

    plot0.push({ time: b.time, value: level, color: trend === 1 ? UP_COL : DOWN_COL });
    if (trend === 1) bgColors.push({ time: b.time, color: UP_BG });
    else if (trend === -1) bgColors.push({ time: b.time, color: DOWN_BG });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
    bgColors,
  };
}

export const GoldenRatioTrendPersistence = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
