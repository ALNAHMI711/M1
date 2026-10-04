/**
 * Money Flow Pulse
 *
 * MFI of the source over `length` bars and its one-bar change (MFI ROC, drawn as an area: green when rising, red when
 * falling, lemon when flat). The MFI line is coloured by zone: orchid above 80 or below 20, lime above 60, peach
 * below 40, lemon between 40 and 60.
 *
 * Reference: "Money Flow Pulse" by TheLeadingIndicator
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Open Source | Designed by Adrian Dyer for "The Leading Indicator", Engineered by PineForge Laboratory (2025)
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface MoneyFlowPulseInputs {
  /** MFI length */
  length: number;
  src: SourceType;
}

export const defaultInputs: MoneyFlowPulseInputs = {
  length: 13,
  src: 'hlc3',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'MFI Length', defval: 13 },
  { id: 'src', type: 'source', title: 'Source', defval: 'hlc3' },
];

const LEMON = String(color.rgb(250, 243, 178));
const PEACH = String(color.rgb(255, 179, 128));
const LIME = String(color.rgb(178, 255, 128));
const ORCHID = String(color.rgb(186, 104, 200));
const ROC_UP = String(color.new(color.green, 33));
const ROC_DOWN = String(color.new(color.red, 33));
const ROC_FLAT = String(color.new(LEMON, 33));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MFI ROC', color: ROC_UP, lineWidth: 2, style: 'area' },
  { id: 'plot1', title: 'MFI', color: LEMON, lineWidth: 1 },
];

export const metadata = {
  title: 'Money Flow Pulse',
  shortTitle: 'Money Flow Pulse',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

export function calculate(bars: Bar[], inputs: Partial<MoneyFlowPulseInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const src = getSourceSeries(bars, cfg.src);
  const volume = new Series(bars, (b) => b.volume ?? NaN);
  const mfi = ta.mfi(src, cfg.length, volume).toArray().map((v) => v ?? NaN);

  const plot0 = [];
  const plot1 = [];
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    const m = mfi[i];
    // mfi_score: > 80 -> 2, > 60 -> 1, < 20 -> -2, < 40 -> -1, else 0
    const score = gt(m, 80) ? 2 : gt(m, 60) ? 1 : lt(m, 20) ? -2 : lt(m, 40) ? -1 : 0;
    const mfiColor = score === 2 || score === -2 ? ORCHID : score === 1 ? LIME : score === -1 ? PEACH : LEMON;
    // mfi_roc = mfi_val - mfi_val[1]
    const roc = i > 0 ? m - mfi[i - 1] : NaN;
    const rocColor = gt(roc, 0) ? ROC_UP : lt(roc, 0) ? ROC_DOWN : ROC_FLAT;
    plot0.push({ time: t, value: fin(roc), color: rocColor });
    plot1.push({ time: t, value: fin(m), color: mfiColor });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1 },
    hlines: [
      { value: 0, options: { title: 'Zero Line', color: String(color.new(LEMON, 50)), linestyle: 'solid', linewidth: 1 } },
    ],
  };
}

export const MoneyFlowPulse = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
