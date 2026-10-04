/**
 * ADR Contraction Tightness
 *
 * Bar range % = (high - low) / low * 100 (na when low <= 0). The contraction ratio is the SMA of the range % over
 * the short length divided by its SMA over the long length (na when the long SMA is na or 0). The line is lime when
 * the ratio is at or below the super-tight threshold, yellow at or below the tight threshold, dark orange otherwise.
 * Dashed lines at both thresholds; the two SMAs and the tight / super-tight flags (1 / 0) are data-window values.
 *
 * Reference: "ADR Contraction Tightness" by etfbreakouts
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © etfbreakouts
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface AdrContractionTightnessInputs {
  /** SMA length of the recent range % */
  shortLen: number;
  /** SMA length of the baseline range % */
  longLen: number;
  /** Ratio at or below this: tight */
  tightThresh: number;
  /** Ratio at or below this: super-tight */
  superTightThresh: number;
}

export const defaultInputs: AdrContractionTightnessInputs = {
  shortLen: 20,
  longLen: 50,
  tightThresh: 0.70,
  superTightThresh: 0.50,
};

export const inputConfig: InputConfig[] = [
  { id: 'shortLen', type: 'int', title: 'Short ADR% length (recent)', defval: 20, min: 1 },
  { id: 'longLen', type: 'int', title: 'Long ADR% length (baseline)', defval: 50, min: 2 },
  { id: 'tightThresh', type: 'float', title: 'Tight threshold', defval: 0.70, min: 0.0, step: 0.01 },
  { id: 'superTightThresh', type: 'float', title: 'Super-tight threshold', defval: 0.50, min: 0.0, step: 0.01 },
];

const LOOSE = String(color.rgb(176, 58, 22));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Contraction Ratio', color: LOOSE, lineWidth: 2 },
  { id: 'plot1', title: 'ADR% short (recent)', color: color.aqua, lineWidth: 1, display: 'data_window' },
  { id: 'plot2', title: 'ADR% long (baseline)', color: color.gray, lineWidth: 1, display: 'data_window' },
  { id: 'plot3', title: 'isTight (1/0)', color: String(color.new(color.yellow, 100)), lineWidth: 1, display: 'data_window' },
  { id: 'plot4', title: 'isSuperTight (1/0)', color: String(color.new(color.lime, 100)), lineWidth: 1,
    display: 'data_window' },
];

export const metadata = {
  title: 'ADR Contraction Tightness',
  shortTitle: 'ADR Contract',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

export function calculate(bars: Bar[], inputs: Partial<AdrContractionTightnessInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  // bar_range_pct = low > 0 ? (high - low) / low * 100.0 : na
  const rangePct = bars.map((b) => (gt(b.low, 0) ? ((b.high - b.low) / b.low) * 100.0 : NaN));
  const rangeSeries = Series.fromArray(bars, rangePct);
  const adrShort = A(ta.sma(rangeSeries, cfg.shortLen));
  const adrLong = A(ta.sma(rangeSeries, cfg.longLen));

  const t = (i: number) => bars[i].time;
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const plot0 = [];
  const plot1 = [];
  const plot2 = [];
  const plot3 = [];
  const plot4 = [];
  for (let i = 0; i < bars.length; i++) {
    // (na(adr_pct_long) or adr_pct_long == 0.0) ? na : adr_pct_short / adr_pct_long
    const ratio = !Number.isFinite(adrLong[i]) || eq(adrLong[i], 0.0) ? NaN : adrShort[i] / adrLong[i];
    const naRatio = !Number.isFinite(ratio);
    const isTight = naRatio ? false : le(ratio, cfg.tightThresh);
    const isSuperTight = naRatio ? false : le(ratio, cfg.superTightThresh);
    const c = isSuperTight ? color.lime : isTight ? color.yellow : LOOSE;
    plot0.push({ time: t(i), value: fin(ratio), color: c });
    plot1.push({ time: t(i), value: fin(adrShort[i]) });
    plot2.push({ time: t(i), value: fin(adrLong[i]) });
    plot3.push({ time: t(i), value: isTight ? 1 : 0 });
    plot4.push({ time: t(i), value: isSuperTight ? 1 : 0 });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: 1 },
    plots: { plot0, plot1, plot2, plot3, plot4 },
    hlines: [
      { value: cfg.tightThresh, options: { title: 'Tight threshold', color: color.yellow, linestyle: 'dashed', linewidth: 1 } },
      { value: cfg.superTightThresh,
        options: { title: 'Super-tight threshold', color: color.lime, linestyle: 'dashed', linewidth: 1 } },
    ],
  };
}

export const AdrContractionTightness = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
