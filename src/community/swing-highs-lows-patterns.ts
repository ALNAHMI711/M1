/**
 * Swing Highs/Lows & Candle Patterns
 *
 * Identifies swing highs/lows using ta.pivothigh/ta.pivotlow, classifies them as
 * HH/LH or HL/LL, and detects candle patterns (hammer, inverted hammer,
 * bullish engulfing, hanging man, shooting star, bearish engulfing) at pivot points.
 *
 * Reference: "Swing Highs/Lows & Candle Patterns [LuxAlgo]" by LuxAlgo (Pine v5)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, LabelData } from '../types';

export interface SwingHighsLowsPatternsInputs {
  length: number;
  /** Swing High label text colour */
  swinghCss: string;
  /** Swing Low label text colour */
  swinglCss: string;
}

// Pine v5 colours: color.red #FF5252, color.teal #00897B
export const defaultInputs: SwingHighsLowsPatternsInputs = {
  length: 21,
  swinghCss: '#FF5252',
  swinglCss: '#00897B',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 21, min: 1 },
  { id: 'swinghCss', type: 'color', title: 'Swing High', defval: '#FF5252' },
  { id: 'swinglCss', type: 'color', title: 'Swing Low', defval: '#00897B' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Anchor', color: 'transparent', lineWidth: 0, display: 'none' },
];

export const metadata = {
  title: 'Swing Highs/Lows & Candle Patterns',
  shortTitle: 'SwingPat',
  overlay: true,
};

/** Pine max_labels_count */
const MAX_LABELS = 500;

/**
 * Pine compares floats with an absolute tolerance: a == b when |a - b| <= 1e-10.
 * So a < b only when b - a > 1e-10.
 */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(bars: Bar[], inputs: Partial<SwingHighsLowsPatternsInputs> = {}): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; labels: LabelData[] } {
  const { length, swinghCss, swinglCss } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const phArr = ta.pivothigh(highSeries, length, length).toArray();
  const plArr = ta.pivotlow(lowSeries, length, length).toArray();

  const labels: LabelData[] = [];
  const closePlot = bars.map((b) => ({ time: b.time, value: NaN }));

  // Pine: var float phy = na, var float ply = na
  let phy = NaN;
  let ply = NaN;

  for (let i = 0; i < n; i++) {
    const ph = phArr[i] ?? NaN;
    const pl = plArr[i] ?? NaN;
    // Pine v5 `if ph` / `pl and ...`: a float is true when it is not na and not 0
    const hasPh = !Number.isNaN(ph) && ph !== 0;
    const hasPl = !Number.isNaN(pl) && pl !== 0;

    // Candle data at the pivot bar: o = open[length], ...
    const pivotIdx = i - length;
    if (pivotIdx < 0) continue;

    const o = bars[pivotIdx].open;
    const h = bars[pivotIdx].high;
    const l = bars[pivotIdx].low;
    const c = bars[pivotIdx].close;
    const d = Math.abs(c - o);
    // c[1], o[1] (na before the first bar: conditions false)
    const c1 = pivotIdx >= 1 ? bars[pivotIdx - 1].close : NaN;
    const o1 = pivotIdx >= 1 ? bars[pivotIdx - 1].open : NaN;

    const isHammer = hasPl && gt(Math.min(o, c) - l, d) && lt(h - Math.max(c, o), d);
    const isInvHammer = hasPl && gt(h - Math.max(c, o), d) && lt(Math.min(c, o) - l, d);
    const isBullEng = gt(c, o) && lt(c1, o1) && gt(c, o1) && lt(o, c1);
    const isHanging = hasPh && gt(Math.min(c, o) - l, d) && lt(h - Math.max(o, c), d);
    const isShooting = hasPh && gt(h - Math.max(o, c), d) && lt(Math.min(c, o) - l, d);
    // Pine source: same condition as bullish engulfing
    const isBearEng = gt(c, o) && lt(c1, o1) && gt(c, o1) && lt(o, c1);

    let patternName = 'None';
    if (isHammer) patternName = 'Hammer';
    else if (isInvHammer) patternName = 'Inverted Hammer';
    else if (isBullEng) patternName = 'Bullish Engulfing';
    else if (isHanging) patternName = 'Hanging Man';
    else if (isShooting) patternName = 'Shooting Star';
    else if (isBearEng) patternName = 'Bearish Engulfing';

    // Pine: if ph ... else if pl (one label per bar at most)
    if (hasPh) {
      // ph > phy is false when phy is na: the first swing high is 'LH'
      const label = gt(ph, phy) ? 'HH' : 'LH';
      labels.push({
        time: bars[pivotIdx].time,
        price: ph,
        text: label + '\n' + patternName,
        textColor: swinghCss,
        style: 'label_down',
        size: 'normal',
      });
      phy = ph;
    } else if (hasPl) {
      // pl < ply is false when ply is na: the first swing low is 'HL'
      const label = lt(pl, ply) ? 'LL' : 'HL';
      labels.push({
        time: bars[pivotIdx].time,
        price: pl,
        text: label + '\n' + patternName,
        textColor: swinglCss,
        style: 'label_up',
        size: 'normal',
      });
      ply = pl;
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': closePlot },
    // Pine draws labels only (no plotshape)
    markers: [],
    labels: labels.slice(-MAX_LABELS),
  };
}

export const SwingHighsLowsPatterns = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
