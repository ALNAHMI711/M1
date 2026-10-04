/**
 * CVD Polarity Indicator (Rolling Smoothed)
 *
 * Rolling CVD: the bar volume is signed by the candle direction (close >= open: +volume, else -volume) and summed
 * over the last `cumulationLength` bars (cum(x) - cum(x)[length], 0 while not available). The polarity of a bar is
 * +volume when the rolling CVD rises and -volume when it falls, on a bar with close != open; 0 when the candle or
 * the CVD change is flat. The polarity is summed over the last `polarityLength` bars, with an EMA of `emaLength`
 * bars.
 *
 * Reference: "CVD Polarity Indicator (Rolling Smoothed)" by Cruiser
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface CvdPolarityIndicatorInputs {
  /** Number of bars of the rolling CVD sum */
  cumulationLength: number;
  /** Number of bars of the rolling polarity sum */
  polarityLength: number;
  /** EMA length of the smoothed polarity */
  emaLength: number;
}

export const defaultInputs: CvdPolarityIndicatorInputs = {
  cumulationLength: 14,
  polarityLength: 14,
  emaLength: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'cumulationLength', type: 'int', title: 'CVD Cumulation Length', defval: 14, min: 1 },
  { id: 'polarityLength', type: 'int', title: 'Polarity Rolling Length', defval: 14, min: 1 },
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 10, min: 1 },
];

const POLARITY_COLOR = String(color.new(color.blue, 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Polarity (Rolling Smoothed)', color: POLARITY_COLOR, lineWidth: 1 },
  { id: 'plot1', title: 'EMA', color: color.orange, lineWidth: 1 },
];

export const metadata = {
  title: 'CVD Polarity Indicator (Rolling Smoothed)',
  shortTitle: 'CVD Polarity Indicator (Rolling Smoothed)',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

export function calculate(bars: Bar[], inputs: Partial<CvdPolarityIndicatorInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const vol = bars.map((b) => b.volume ?? NaN);
  // nz(x[len], 0): 0 before bar len (and for an na value)
  const nzBack = (a: number[], i: number, len: number) => (i - len >= 0 && !isNaN(a[i - len]) ? a[i - len] : 0);

  // volDelta = close - open >= 0 ? volume : -volume; cvd = cum(volDelta) - nz(cum(volDelta)[cumulationLength], 0)
  const volDelta = bars.map((b, i) => (ge(b.close - b.open, 0) ? vol[i] : -vol[i]));
  const cvdCum = A(ta.cum(S(volDelta)));
  const cvd = cvdCum.map((v, i) => v - nzBack(cvdCum, i, cfg.cumulationLength));

  // Per-bar polarity
  const polarity: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const cvdChange = i > 0 ? cvd[i] - cvd[i - 1] : NaN;
    const barDir = bars[i].close - bars[i].open;
    if (gt(barDir, 0) && gt(cvdChange, 0)) polarity[i] = vol[i];
    else if (lt(barDir, 0) && lt(cvdChange, 0)) polarity[i] = -vol[i];
    else if (gt(barDir, 0) && lt(cvdChange, 0)) polarity[i] = -vol[i];
    else if (lt(barDir, 0) && gt(cvdChange, 0)) polarity[i] = vol[i];
    else polarity[i] = 0.0;
  }

  // polaritySmoothed = cum(polarity) - nz(cum(polarity)[polarityLength], 0); EMA of it
  const polarityCum = A(ta.cum(S(polarity)));
  const smoothed = polarityCum.map((v, i) => v - nzBack(polarityCum, i, cfg.polarityLength));
  const emaLine = A(ta.ema(S(smoothed), cfg.emaLength));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: smoothed[i], color: POLARITY_COLOR })),
      plot1: bars.map((b, i) => ({ time: b.time, value: emaLine[i], color: color.orange })),
    },
  };
}

export const CvdPolarityIndicator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
