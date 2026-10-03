/**
 * Ask-Weighted Averages
 *
 * The ask volume of a bar is its volume on an up close, 0 on a down close and half the volume otherwise. The
 * ask-weighted average price is sum(askVol * hl2) / sum(askVol) over the last `length` bars (sums taken as the
 * difference of two cumulative sums; hl2 when the volume sum is 0 or na). The continuous line is drawn on every bar;
 * the conditional line only on the bars where the rounded dollar volume (hl2 * volume / 10000) is above the
 * threshold.
 *
 * Reference: "Ask-Weighted Averages (No Labels)" by DinoTradez
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © DinoTradez
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface AskWeightedAveragesInputs {
  /** Length of the conditional line */
  lengthConditional: number;
  /** Width of the conditional line (the port keeps the default width) */
  lineWeightConditional: number;
  /** The conditional line is drawn when round(hl2 * volume / 10000) is above this threshold */
  dollarVolumeThreshold: number;
  /** Length of the continuous line */
  lengthContinuous: number;
  /** Width of the continuous line (the port keeps the default width) */
  lineWeightContinuous: number;
}

export const defaultInputs: AskWeightedAveragesInputs = {
  lengthConditional: 20,
  lineWeightConditional: 2,
  dollarVolumeThreshold: 1.0,
  lengthContinuous: 20,
  lineWeightContinuous: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'lengthConditional', type: 'int', title: 'Conditional Length', defval: 20 },
  { id: 'lineWeightConditional', type: 'int', title: 'Conditional Line Weight', defval: 2 },
  { id: 'dollarVolumeThreshold', type: 'float', title: 'Dollar Volume Threshold', defval: 1.0 },
  { id: 'lengthContinuous', type: 'int', title: 'Continuous Length', defval: 20 },
  { id: 'lineWeightContinuous', type: 'int', title: 'Continuous Line Weight', defval: 2 },
];

const CYAN = String(color.new(color.rgb(0, 255, 255), 0));
const GREEN = String(color.new(color.rgb(0, 255, 0), 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Conditional Weighted Avg', color: CYAN, lineWidth: 2 },
  { id: 'plot1', title: 'Continuous Weighted Avg', color: GREEN, lineWidth: 2 },
];

export const metadata = {
  title: 'Ask-Weighted Averages (No Labels)',
  shortTitle: 'Ask-Weighted Averages (No Labels)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
/** Pine `!=`: false when a value is na */
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;

export function calculate(bars: Bar[], inputs: Partial<AskWeightedAveragesInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const hl2 = bars.map((b) => (b.high + b.low) / 2.0);
  const vol = bars.map((b) => b.volume ?? NaN);

  // askVol = priceChange > 0 ? volume : priceChange < 0 ? 0 : volume / 2 (priceChange na on bar 0: volume / 2)
  const askVol = bars.map((b, i) => {
    const pc = i > 0 ? b.close - bars[i - 1].close : NaN;
    return gt(pc, 0) ? vol[i] : gt(0, pc) ? 0 : vol[i] / 2;
  });
  const askVolHl2 = askVol.map((v, i) => v * hl2[i]);

  // ta.cum(src): running sum (na adds nothing)
  const cum = (src: number[]) => {
    const out: number[] = new Array(n);
    let s = 0;
    for (let i = 0; i < n; i++) {
      if (!isNaN(src[i])) s += src[i];
      out[i] = s;
    }
    return out;
  };
  const cumAsk = cum(askVol);
  const cumAskHl2 = cum(askVolHl2);
  // f_sum(src, length) = cum - cum[length] (na before bar `length`)
  const fSum = (c: number[], length: number, i: number) => (i - length >= 0 ? c[i] - c[i - length] : NaN);
  const avg = (length: number, i: number) => {
    const sAsk = fSum(cumAsk, length, i);
    return ne(sAsk, 0) ? fSum(cumAskHl2, length, i) / sAsk : hl2[i];
  };

  const plot0 = bars.map((b, i) => {
    const dollarVolume = Math.round((hl2[i] * vol[i]) / 10000.0);
    const condition = gt(dollarVolume, cfg.dollarVolumeThreshold);
    const v = condition ? avg(cfg.lengthConditional, i) : NaN;
    return { time: b.time, value: Number.isFinite(v) ? v : NaN, color: CYAN };
  });
  const plot1 = bars.map((b, i) => {
    const v = avg(cfg.lengthContinuous, i);
    return { time: b.time, value: Number.isFinite(v) ? v : NaN, color: GREEN };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1 },
  };
}

export const AskWeightedAverages = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
