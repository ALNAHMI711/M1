/**
 * Dynamic Support & Resistance
 *
 * Three EMAs of the close (200, 50 and 20 by default).
 * Bearish trend: EMA 200 > EMA 50 > EMA 20. Bullish trend: EMA 200 < EMA 50 < EMA 20.
 * The zone between the EMA 20 and the EMA 50 (two plots with an na colour, so the lines are not drawn) is filled
 * red in a bearish trend and lime in a bullish trend. The EMA 200 is drawn twice: red in a bearish trend and green
 * in a bullish trend (na colour otherwise), so it is visible only while a trend is present.
 *
 * Reference: "Dynamic Support & Resistance" by ZenAndTheArtOfTrading
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, taCore, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface DynamicSupportResistanceInputs {
  /** Longterm EMA length */
  emaMainLength: number;
  /** DSR 1 EMA length */
  emaDSR1Length: number;
  /** DSR 2 EMA length */
  emaDSR2Length: number;
}

export const defaultInputs: DynamicSupportResistanceInputs = {
  emaMainLength: 200,
  emaDSR1Length: 50,
  emaDSR2Length: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaMainLength', type: 'int', title: 'Longterm EMA Length', defval: 200, min: 1 },
  { id: 'emaDSR1Length', type: 'int', title: 'DSR 1 EMA Length', defval: 50, min: 1 },
  { id: 'emaDSR2Length', type: 'int', title: 'DSR 2 EMA Length', defval: 20, min: 1 },
];

// Pine: plot(ema20, color = na), plot(ema50, color = na), plot(ema200, color = bearTrend ? color.red : na,
// linewidth = 2), plot(ema200, color = bullTrend ? color.green : na, linewidth = 2)
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Plot', color: 'transparent', lineWidth: 1 },
  { id: 'plot1', title: 'Plot', color: 'transparent', lineWidth: 1 },
  { id: 'plot2', title: 'Plot', color: color.red, lineWidth: 2 },
  { id: 'plot3', title: 'Plot', color: color.green, lineWidth: 2 },
];

export const metadata = {
  title: 'Dynamic Support & Resistance',
  shortTitle: 'DSR',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<DynamicSupportResistanceInputs> = {}): IndicatorResult {
  const { emaMainLength, emaDSR1Length, emaDSR2Length } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const close = bars.map((b) => b.close);

  const ema200 = taCore.ema(close, emaMainLength);
  const ema50 = taCore.ema(close, emaDSR1Length);
  const ema20 = taCore.ema(close, emaDSR2Length);

  const plot0: { time: number; value: number }[] = new Array(n);
  const plot1: { time: number; value: number }[] = new Array(n);
  const plot2: { time: number; value: number; color: string }[] = new Array(n);
  const plot3: { time: number; value: number; color: string }[] = new Array(n);
  const bearFill: string[] = new Array(n);
  const bullFill: string[] = new Array(n);
  const bearFillColor = String(color.new(color.red, 75));
  const bullFillColor = String(color.new(color.lime, 75));

  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    // A comparison with na (EMA warm-up) is false
    const bearTrend = ema200[i] > ema50[i] && ema50[i] > ema20[i];
    const bullTrend = ema200[i] < ema50[i] && ema50[i] < ema20[i];

    plot0[i] = { time: t, value: ema20[i] };
    plot1[i] = { time: t, value: ema50[i] };
    plot2[i] = { time: t, value: ema200[i], color: bearTrend ? color.red : 'transparent' };
    plot3[i] = { time: t, value: ema200[i], color: bullTrend ? color.green : 'transparent' };
    // fill(z1, z2, color = bearTrend ? color.new(color.red, 75) : na)
    bearFill[i] = bearTrend ? bearFillColor : 'transparent';
    // fill(z1, z2, color = bullTrend ? color.new(color.lime, 75) : na)
    bullFill[i] = bullTrend ? bullFillColor : 'transparent';
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2, plot3 },
    fills: [
      { plot1: 'plot0', plot2: 'plot1', options: { color: bearFillColor }, colors: bearFill },
      { plot1: 'plot0', plot2: 'plot1', options: { color: bullFillColor }, colors: bullFill },
    ],
  };
}

export const DynamicSupportResistance = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
