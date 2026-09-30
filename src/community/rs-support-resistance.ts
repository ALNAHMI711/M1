/**
 * [RS] Support and Resistance V0
 *
 * Short-term and long-term support/resistance from the last high (low) that reached the
 * highest high (lowest low) of a lookback window. No pivots.
 *
 * Pine:
 *   short_term_top = ta.valuewhen(h >= ta.highest(h, window1), h, 0)   (bot, long-term: same form)
 *   short_term_resist = ta.change(short_term_top) != 0 ? na : short_term_top   (linebr)
 *   long_term_resist_marker = ta.change(fixnan(long_term_resist)) != 0 ? long_term_resist : na
 *   trade limits: kept from the previous bar while the short-term level lasts.
 *
 * Reference: "[RS]Support and Resistance V0" by RicardoSantos (community)
 */

import { getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface RSSupportResistanceInputs {
  /** Use alternative source? */
  useAltSeries: boolean;
  /** Alternative source */
  altSrc: SourceType;
  /** lookback window 1 */
  window1: number;
  /** lookback window 2 */
  window2: number;
  /** Percent of the diff to use for trade zone */
  tradeZonePct: number;
}

export const defaultInputs: RSSupportResistanceInputs = {
  useAltSeries: false,
  altSrc: 'close',
  window1: 8,
  window2: 21,
  tradeZonePct: 25,
};

export const inputConfig: InputConfig[] = [
  { id: 'useAltSeries', type: 'bool', title: 'Use alternative source?', defval: false },
  { id: 'altSrc', type: 'source', title: 'Alternative source:', defval: 'close' },
  { id: 'window1', type: 'int', title: 'lookback window 1:', defval: 8 },
  { id: 'window2', type: 'int', title: 'lookback window 2:', defval: 21 },
  { id: 'tradeZonePct', type: 'float', title: 'Percent of the diff to use for trade zone', defval: 25 },
];

// Pine colours: color.navy #311B92, color.rgb(33,150,243,70), color.blue #2962FF (v5 values), color.red #FF5252, color.lime #00E676
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'STR', color: '#311B92', lineWidth: 1, style: 'linebr' },
  { id: 'plot1', title: 'STS', color: '#311B92', lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'LTR', color: 'rgba(33,150,243,0.3)', lineWidth: 4, style: 'linebr' },
  { id: 'plot3', title: 'LTS', color: 'rgba(33,150,243,0.3)', lineWidth: 4, style: 'linebr' },
  { id: 'plot4', title: 'L', color: '#FF5252', lineWidth: 1, style: 'linebr' },
  { id: 'plot5', title: 'L', color: '#00E676', lineWidth: 1, style: 'linebr' },
  { id: 'ltResistMarker', title: '.R', color: '#2962FF', lineWidth: 4, style: 'circles' },
  { id: 'ltSupportMarker', title: '.S', color: '#2962FF', lineWidth: 4, style: 'circles' },
];

export const metadata = {
  title: '[RS] Support and Resistance V0',
  shortTitle: 'RS S/R',
  overlay: true,
};

/** Pine float comparison: a == b when |a - b| <= 1e-10 */
const EPS = 1e-10;

/** ta.valuewhen(src >= ta.highest(src, len), src, 0) (isHigh) or the lowest form. Comparisons with na are false. */
function lastExtreme(src: number[], len: number, isHigh: boolean): number[] {
  const n = src.length;
  const out = new Array<number>(n).fill(NaN);
  let last = NaN;
  for (let i = 0; i < n; i++) {
    if (i >= len - 1) {
      let ext = NaN;
      for (let j = i - len + 1; j <= i; j++) {
        const v = src[j];
        if (Number.isNaN(v)) continue;
        if (Number.isNaN(ext) || (isHigh ? v > ext : v < ext)) ext = v;
      }
      const v = src[i];
      if (!Number.isNaN(v) && !Number.isNaN(ext) && (isHigh ? ext - v <= EPS : v - ext <= EPS)) last = v;
    }
    out[i] = last;
  }
  return out;
}

/** ta.change(x) != 0 : na when either value is na (then the condition is false). */
function changed(x: number[], i: number): boolean {
  if (i === 0) return false;
  const a = x[i];
  const b = x[i - 1];
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return Math.abs(a - b) > EPS;
}

/** x_resist = ta.change(top) != 0 ? na : top */
function breakOnChange(top: number[]): number[] {
  return top.map((v, i) => (changed(top, i) ? NaN : v));
}

function fixnan(x: number[]): number[] {
  let last = NaN;
  return x.map((v) => {
    if (!Number.isNaN(v)) last = v;
    return last;
  });
}

/** ta.change(fixnan(level)) != 0 ? level : na */
function changeMarker(level: number[]): number[] {
  const fixed = fixnan(level);
  return level.map((v, i) => (changed(fixed, i) ? v : NaN));
}

export function calculate(bars: Bar[], inputs: Partial<RSSupportResistanceInputs> = {}): IndicatorResult {
  const { useAltSeries, altSrc, window1, window2, tradeZonePct } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const alt = useAltSeries ? getSourceSeries(bars, altSrc).toArray().map((v) => (v == null ? NaN : v)) : [];
  const h = useAltSeries ? alt : bars.map((b) => b.high);
  const l = useAltSeries ? alt : bars.map((b) => b.low);
  const pct = 0.01 * tradeZonePct;

  const shortTermTop = lastExtreme(h, window1, true);
  const shortTermBot = lastExtreme(l, window1, false);
  const longTermTop = lastExtreme(h, window2, true);
  const longTermBot = lastExtreme(l, window2, false);

  const shortTermResist = breakOnChange(shortTermTop);
  const shortTermSuport = breakOnChange(shortTermBot);
  const longTermResist = breakOnChange(longTermTop);
  const longTermSuport = breakOnChange(longTermBot);

  const longTermResistMarker = changeMarker(longTermResist);
  const longTermSuportMarker = changeMarker(longTermSuport);

  // Entry zone: diff = fixnan(short_term_resist) - fixnan(short_term_suport)
  const fixResist = fixnan(shortTermResist);
  const fixSuport = fixnan(shortTermSuport);
  const resistLimit = new Array<number>(n).fill(NaN);
  const suportLimit = new Array<number>(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    const diff = fixResist[i] - fixSuport[i];
    if (!Number.isNaN(shortTermResist[i])) {
      const prev = i > 0 ? resistLimit[i - 1] : NaN;
      resistLimit[i] = !Number.isNaN(prev) ? prev : shortTermResist[i] - diff * pct;
    }
    if (!Number.isNaN(shortTermSuport[i])) {
      const prev = i > 0 ? suportLimit[i - 1] : NaN;
      suportLimit[i] = !Number.isNaN(prev) ? prev : shortTermSuport[i] + diff * pct;
    }
  }

  const toPlot = (arr: number[]) => arr.map((value, i) => ({ time: bars[i].time, value }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'plot0': toPlot(shortTermResist),
      'plot1': toPlot(shortTermSuport),
      'plot2': toPlot(longTermResist),
      'plot3': toPlot(longTermSuport),
      'plot4': toPlot(resistLimit),
      'plot5': toPlot(suportLimit),
      'ltResistMarker': toPlot(longTermResistMarker),
      'ltSupportMarker': toPlot(longTermSuportMarker),
    },
    fills: [
      { plot1: 'plot0', plot2: 'plot2', options: { color: 'rgba(255,152,0,0.2)', title: 'Resistance' } },
      { plot1: 'plot1', plot2: 'plot3', options: { color: 'rgba(128,128,0,0.2)', title: 'Support' } },
    ],
  };
}

export const RSSupportResistance = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
