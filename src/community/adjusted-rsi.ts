/**
 * Adjusted RSI
 *
 * RSI(close, rsiLen) - 50, smoothed by an SMA(rsiSmoothLen) and clamped to -10..10. The value is normalised to
 * 0..100 in its lowest / highest range over `len` bars (the previous value is kept when the range is 0), smoothed
 * with s += factor * (x - s), normalised and smoothed a second time, then re-centred by -50. The line is blue when it
 * rises or holds, purple when it falls; a glow line and a gradient fill to zero use the same colour.
 *
 * Reference: "Adjusted RSI - [JTCAPITAL]" by JTCapitalNL
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © JTCapitalNL
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface AdjustedRsiInputs {
  /** RSI length */
  rsiLen: number;
  /** SMA length of the RSI smoothing */
  rsiSmoothLen: number;
  /** Lookback of the two normalisations */
  len: number;
  /** Factor of the two exponential smoothings */
  smoothFact: number;
}

export const defaultInputs: AdjustedRsiInputs = {
  rsiLen: 42,
  rsiSmoothLen: 34,
  len: 34,
  smoothFact: 0.2,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 42 },
  { id: 'rsiSmoothLen', type: 'int', title: 'RSI Smoothing Length', defval: 34 },
  { id: 'len', type: 'int', title: 'Smoothing Length', defval: 34 },
  { id: 'smoothFact', type: 'float', title: 'Smoothing Factor', defval: 0.2, min: 0.1, max: 1.0, step: 0.05 },
];

const BULL = color.rgb(49, 133, 228);
const BEAR = color.rgb(132, 3, 158);

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Adjusted RSI', color: BULL, lineWidth: 2 },
  { id: 'plot1', title: 'Adjusted RSI Thin', color: BULL, lineWidth: 1 },
  { id: 'plot2', title: 'Adjusted RSI Glow', color: String(color.new(BULL, 80)), lineWidth: 8 },
  { id: 'plot3', title: 'Adjusted RSI Fill Line', color: BULL, lineWidth: 3 },
  { id: 'plot4', title: 'Zero', color: BULL, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Adjusted RSI - [JTCAPITAL]',
  shortTitle: 'Adjusted RSI - [JTCAPITAL]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

export function calculate(bars: Bar[], inputs: Partial<AdjustedRsiInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const f = cfg.smoothFact;

  // adjRSI = sma(rsi(close, rsiLen) - 50, rsismlen), clamped to -10..10 (math.max / min give na with na)
  const close = S(bars.map((b) => b.close));
  const rsiC = A(ta.rsi(close, cfg.rsiLen)).map((v) => v - 50);
  const adjRSI = A(ta.sma(S(rsiC), cfg.rsiSmoothLen)).map((v) => Math.min(Math.max(v, -10), 10));

  // First normalisation and smoothing
  const lowRSI = A(ta.lowest(S(adjRSI), cfg.len));
  const highRSI = A(ta.highest(S(adjRSI), cfg.len));
  const smooth1: number[] = new Array(n);
  let normRSI = NaN; // var float normRSI = na
  let s1 = NaN; // var float smooth1 = na
  for (let i = 0; i < n; i++) {
    const range = highRSI[i] - lowRSI[i];
    // rangeRSI > 0 ? ... : nz(normRSI[1])
    normRSI = gt(range, 0) ? ((adjRSI[i] - lowRSI[i]) / range) * 100 : isNaN(normRSI) ? 0 : normRSI;
    s1 = isNaN(s1) ? normRSI : s1 + f * (normRSI - s1);
    smooth1[i] = s1;
  }

  // Second normalisation and smoothing, re-centred
  const lowS = A(ta.lowest(S(smooth1), cfg.len));
  const highS = A(ta.highest(S(smooth1), cfg.len));
  const finalLine: number[] = new Array(n);
  let norm = NaN; // var float norm = na
  let s2 = NaN; // var float smooth2 = na
  for (let i = 0; i < n; i++) {
    const range = highS[i] - lowS[i];
    norm = gt(range, 0) ? ((smooth1[i] - lowS[i]) / range) * 100 : isNaN(norm) ? 0 : norm;
    s2 = isNaN(s2) ? norm : s2 + f * (norm - s2);
    finalLine[i] = s2 - 50;
  }

  // lineColor = finalLine >= finalLine[1] ? BullColor : BearColor
  const up = finalLine.map((v, i) => i > 0 && ge(v, finalLine[i - 1]));
  const lineColor = up.map((u) => (u ? BULL : BEAR));
  const glowColor = up.map((u) => String(color.new(u ? BULL : BEAR, 80)));
  const line = (c: string[]) => bars.map((b, i) => ({ time: b.time, value: finalLine[i], color: c[i] }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: line(lineColor),
      plot1: line(lineColor),
      plot2: line(glowColor),
      plot3: line(lineColor),
      // plot12 = plot(0, color = lineColor, display = display.none)
      plot4: bars.map((b, i) => ({ time: b.time, value: 0, color: lineColor[i] })),
    },
    fills: [
      // fill(plot1, plot12, top_value = finalLine, bottom_value = 0, top_color = lineColor,
      //      bottom_color = color.new(color.black, 100))
      { plot1: 'plot3', plot2: 'plot4', options: { title: 'Adjusted RSI Fill' },
        gradient: {
          topValue: finalLine.slice(),
          bottomValue: new Array<number>(n).fill(0),
          topColor: lineColor.slice(),
          bottomColor: new Array<string | null>(n).fill(String(color.new(color.black, 100))),
        } },
    ],
  };
}

export const AdjustedRsi = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
