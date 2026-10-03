/**
 * FlowShift Oscillator
 *
 * Dislocation of hl2 from a baseline moving average (SMA / EMA / RMA / WMA / VWMA). Its 14-bar change is divided
 * by an EMA (24) of its standard deviation (24), the EMA (24) drift of that ratio is removed, the result is squashed
 * to -1..1 with x / (1 + |x|) and smoothed by two EMAs (5). Guides at +- the 88th percentile (linear interpolation)
 * of |oscillator| over 500 bars. BUY / SELL triangles mark a cross of the oscillator over / under its value 2 bars
 * earlier below the lower guide / above the upper guide. The baseline is drawn on the price chart and the candles
 * are tinted by the oscillator sign.
 *
 * Reference: "FlowShift Oscillator" by BOSWaves
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BOSWaves
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, MarkerData } from '../types';

export interface FlowshiftOscillatorInputs {
  /** Baseline moving average type */
  maType: 'SMA' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';
  /** Baseline moving average length */
  maLen: number;
  upFill: string;
  dnFill: string;
  upLine: string;
  dnLine: string;
  maCore: string;
  maGlow: string;
  /** Show the baseline moving average */
  showMA: boolean;
  /** Show the cross signals */
  showSig: boolean;
  /** Tint the candles by the oscillator sign */
  paintBars: boolean;
}

export const defaultInputs: FlowshiftOscillatorInputs = {
  maType: 'SMA',
  maLen: 40,
  upFill: '#4ADE80',
  dnFill: '#FB7185',
  upLine: '#166534',
  dnLine: '#7F1D1D',
  maCore: '#1D4ED8',
  maGlow: '#60A5FA',
  showMA: true,
  showSig: true,
  paintBars: true,
};

const GRP_MA = 'Baseline MA';
const GRP_VIS = 'Visuals';

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'Type', defval: 'SMA', options: ['SMA', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'], group: GRP_MA },
  { id: 'maLen', type: 'int', title: 'Length', defval: 40, min: 10, max: 100, group: GRP_MA },
  { id: 'upFill', type: 'color', title: 'Up Area', defval: '#4ADE80', group: GRP_VIS },
  { id: 'dnFill', type: 'color', title: 'Down Area', defval: '#FB7185', group: GRP_VIS },
  { id: 'upLine', type: 'color', title: 'Up Line', defval: '#166534', group: GRP_VIS },
  { id: 'dnLine', type: 'color', title: 'Down Line', defval: '#7F1D1D', group: GRP_VIS },
  { id: 'maCore', type: 'color', title: 'MA Core', defval: '#1D4ED8', group: GRP_VIS },
  { id: 'maGlow', type: 'color', title: 'MA Glow', defval: '#60A5FA', group: GRP_VIS },
  { id: 'showMA', type: 'bool', title: 'Show Baseline MA', defval: true, group: GRP_VIS },
  { id: 'showSig', type: 'bool', title: 'Show Cross Signals', defval: true, group: GRP_VIS },
  { id: 'paintBars', type: 'bool', title: 'Tint Candles by MA Bias', defval: true, group: GRP_VIS },
];

const GUIDE = String(color.new(color.gray, 40));
const GUIDE_FILL = String(color.new(color.gray, 88));

// plot(baseMA, ..., force_overlay = true, display = showMA ? display.all : display.none): `visible` = the input id
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Baseline MA Glow', color: String(color.new('#60A5FA', 75)), lineWidth: 8, forceOverlay: true, visible: 'showMA' },
  { id: 'plot1', title: 'Baseline MA', color: '#1D4ED8', lineWidth: 2, forceOverlay: true, visible: 'showMA' },
  { id: 'plot2', title: 'FlowShift Area', color: String(color.new('#4ADE80', 35)), lineWidth: 1, style: 'area' },
  { id: 'plot3', title: 'FlowShift Line', color: '#166534', lineWidth: 2 },
  { id: 'plot4', title: 'Zero', color: String(color.new(color.gray, 0)), lineWidth: 1 },
  { id: 'plot5', title: 'Top Guide', color: GUIDE, lineWidth: 1 },
  { id: 'plot6', title: 'Bottom Guide', color: GUIDE, lineWidth: 1 },
];

export const metadata = {
  title: 'FlowShift Oscillator',
  shortTitle: 'FlowShift Oscillator',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

export function calculate(
  bars: Bar[],
  inputs: Partial<FlowshiftOscillatorInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  // baseMA = f_ma(hl2, maLen, maType)
  const maSrc = bars.map((b) => (b.high + b.low) / 2);
  const srcS = S(maSrc);
  let baseMA: number[];
  switch (cfg.maType) {
    case 'EMA': baseMA = A(ta.ema(srcS, cfg.maLen)); break;
    case 'SMMA (RMA)': baseMA = A(ta.rma(srcS, cfg.maLen)); break;
    case 'WMA': baseMA = A(ta.wma(srcS, cfg.maLen)); break;
    case 'VWMA': baseMA = A(ta.vwma(srcS, cfg.maLen, S(bars.map((b) => b.volume ?? NaN)))); break;
    default: baseMA = A(ta.sma(srcS, cfg.maLen));
  }
  const disloc = maSrc.map((v, i) => v - baseMA[i]);

  // Fixed parameters
  const winLen = 14;
  const scaleLen = 24;
  const smoothA = 5;
  const smoothB = 5;
  const thrPct = 88;

  // momWin = disloc - nz(disloc[winLen])
  const nz = (v: number) => (Number.isFinite(v) ? v : 0);
  const momWin = disloc.map((d, i) => d - (i >= winLen ? nz(disloc[i - winLen]) : 0));
  const volEWMA = A(ta.ema(ta.stdev(S(disloc), scaleLen), scaleLen));
  const normRaw = momWin.map((m, i) => m / (volEWMA[i] + 1e-10));
  const drift = A(ta.ema(S(normRaw), Math.max(2, scaleLen)));
  // f_squash(x) = x / (1 + |x|)
  const squ = normRaw.map((x, i) => {
    const d = x - drift[i];
    return d / (1.0 + Math.abs(d));
  });
  const lev1 = ta.ema(S(squ), smoothA);
  const flowOsc = A(ta.ema(lev1, smoothB));
  const flowS = S(flowOsc);

  const thrDyn = A(ta.percentile_linear_interpolation(S(flowOsc.map((v) => Math.abs(v))), 500, thrPct));
  const top = thrDyn;
  const bot = thrDyn.map((v) => -v);

  const isUp = flowOsc.map((v) => ge(v, 0));
  const oscFillUp = String(color.new(cfg.upFill, 35));
  const oscFillDn = String(color.new(cfg.dnFill, 35));
  const oscLineUp = String(color.new(cfg.upLine, 0));
  const oscLineDn = String(color.new(cfg.dnLine, 0));

  // sigUp = showSig and ta.crossover(flowOsc, nz(flowOsc[2])) and flowOsc < bot (lazy `and`: the crossings only
  // run when showSig is true, an input constant, so on every bar or on none)
  const prev2 = S(flowOsc.map((_v, i) => (i >= 2 ? nz(flowOsc[i - 2]) : 0)));
  const crossUp = cfg.showSig ? A(ta.crossover(flowS, prev2)) : [];
  const crossDn = cfg.showSig ? A(ta.crossunder(flowS, prev2)) : [];
  const markers: MarkerData[] = [];
  if (cfg.showSig) {
    for (let i = 0; i < n; i++) {
      const sigUp = Boolean(crossUp[i]) && lt(flowOsc[i], bot[i]);
      const sigDn = Boolean(crossDn[i]) && gt(flowOsc[i], top[i]);
      // plotshape(sigUp, "FS Up", shape.triangleup, size.tiny, upLine, location.belowbar, text = "BUY",
      //   textcolor = color.white, force_overlay = true)
      if (sigUp) {
        markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: cfg.upLine, size: 'tiny',
          text: 'BUY', textColor: color.white, forceOverlay: true });
      }
      if (sigDn) {
        markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: cfg.dnLine, size: 'tiny',
          text: 'SELL', textColor: color.white, forceOverlay: true });
      }
    }
  }

  const glow = String(color.new(cfg.maGlow, 75));
  const biasUp = String(color.new(cfg.upLine, 65));
  const biasDn = String(color.new(cfg.dnLine, 65));
  const zeroCol = String(color.new(color.gray, 0));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: baseMA[i], color: glow })),
      plot1: bars.map((b, i) => ({ time: b.time, value: baseMA[i], color: cfg.maCore })),
      plot2: bars.map((b, i) => ({ time: b.time, value: flowOsc[i], color: isUp[i] ? oscFillUp : oscFillDn })),
      plot3: bars.map((b, i) => ({ time: b.time, value: flowOsc[i], color: isUp[i] ? oscLineUp : oscLineDn })),
      plot4: bars.map((b) => ({ time: b.time, value: 0, color: zeroCol })),
      plot5: bars.map((b, i) => ({ time: b.time, value: top[i], color: GUIDE })),
      plot6: bars.map((b, i) => ({ time: b.time, value: bot[i], color: GUIDE })),
    },
    fills: [
      // fill(tL, mid, color = color.new(color.gray, 88)); fill(bL, mid, ...)
      { plot1: 'plot5', plot2: 'plot4', colors: new Array<string>(n).fill(GUIDE_FILL) },
      { plot1: 'plot6', plot2: 'plot4', colors: new Array<string>(n).fill(GUIDE_FILL) },
    ],
    // barcolor(paintBars ? (isUp ? color.new(upLine, 65) : color.new(dnLine, 65)) : na)
    barColors: cfg.paintBars ? bars.map((b, i) => ({ time: b.time, color: isUp[i] ? biasUp : biasDn })) : [],
    markers,
  };
}

export const FlowshiftOscillator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
