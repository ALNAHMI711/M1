/**
 * Buying & Selling Pressure
 *
 * Candle metrics averaged over a period with a chosen moving average (Gaussian 10-pole filter, linear regression,
 * HMA, RMA, EMA, WMA or SMA): buying pressure = close - min(low, previous close) and selling pressure =
 * max(high, previous close) - close ("Net Move" also takes away the lower / higher wick). The pressure lines are
 * coloured by their direction (growing or falling), with a dark gradient between their average and the highest of
 * the larger pressure over three periods. Optional averages of the true range, body range, wicks (higher / lower,
 * average, total). Bars are coloured when the buying pressure falls on an up close or the selling pressure falls on
 * a down close.
 *
 * Reference: "Buying & Selling Pressure" by fract
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

export type BSPAveragingType = 'Gaussian 10 Polar' | 'Linear Regression' | 'HMA' | 'RMA' | 'EMA' | 'WMA' | 'SMA';

export interface BuyingSellingPressureInputs {
  /** Averaging type */
  typeMA: BSPAveragingType;
  /** Averaging period */
  ln: number;
  /** Colour the price bars */
  bg: boolean;
  /** Range type: 'Pressure', or 'Net Move' (pressure less the wick) */
  typeCM: 'Pressure' | 'Net Move';
  /** Show the average true range */
  trsw: boolean;
  /** Show the average body range */
  brsw: boolean;
  /** Show the average wick range */
  awsw: boolean;
  /** Show the higher and lower wick ranges */
  wksw: boolean;
  /** Show the total wicks range */
  twsw: boolean;
}

export const defaultInputs: BuyingSellingPressureInputs = {
  typeMA: 'HMA',
  ln: 14,
  bg: true,
  typeCM: 'Pressure',
  trsw: false,
  brsw: false,
  awsw: false,
  wksw: false,
  twsw: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'typeMA', type: 'string', title: 'Averaging Type', defval: 'HMA',
    options: ['Gaussian 10 Polar', 'Linear Regression', 'HMA', 'RMA', 'EMA', 'WMA', 'SMA'] },
  { id: 'ln', type: 'int', title: 'Period', defval: 14, min: 1 },
  { id: 'bg', type: 'bool', title: 'Color Bars', defval: true },
  { id: 'typeCM', type: 'string', title: 'Range Type', defval: 'Pressure', options: ['Pressure', 'Net Move'] },
  { id: 'trsw', type: 'bool', title: 'Average True Range', defval: false },
  { id: 'brsw', type: 'bool', title: 'Average Body Range', defval: false },
  { id: 'awsw', type: 'bool', title: 'Average Wick Range', defval: false },
  { id: 'wksw', type: 'bool', title: 'Higher & Lower Wicks Range', defval: false },
  { id: 'twsw', type: 'bool', title: 'Total Wicks Range', defval: false },
];

const BP_GROW = String(color.rgb(0, 206, 0));
const BP_FALL = String(color.rgb(155, 0, 255));
const SP_GROW = String(color.rgb(255, 0, 0));
const SP_FALL = String(color.rgb(245, 127, 33));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ATR', color: '#000000', lineWidth: 2 },
  { id: 'plot1', title: 'Average Body Range', color: '#000000', lineWidth: 1, style: 'stepline' },
  { id: 'plot2', title: 'Awerage Wick', color: '#000000', lineWidth: 2 },
  { id: 'plot3', title: 'Higher Wick', color: '#2a2e39', lineWidth: 1, style: 'circles' },
  { id: 'plot4', title: 'Lower Wick', color: '#2a2e39', lineWidth: 1, style: 'cross' },
  { id: 'plot5', title: 'Total Wicks', color: '#787b86', lineWidth: 1, style: 'stepline' },
  { id: 'plot6', title: 'Buying Pressure', color: BP_GROW, lineWidth: 2 },
  { id: 'plot7', title: 'Selling Pressure', color: SP_GROW, lineWidth: 2 },
];

export const metadata = {
  title: 'Buying & Selling Pressure [Candle Metrics]',
  shortTitle: 'BSP',
  overlay: false,
};

// Pine compares floats with a tolerance of 1e-10; a comparison with na is false.
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const nz = (v: number) => (isNaN(v) ? 0 : v);

/** gaus(source, length) of the script: 10-pole Gaussian filter with `var float filter`, then (filter + nz(filter[1])) / 2 */
function gaus(source: number[], length: number): number[] {
  const n = source.length;
  const beta = (1 - Math.cos((2 * Math.PI) / length)) / (Math.pow(2, 0.1) - 1);
  const alpha = -beta + Math.sqrt(Math.pow(beta, 2) + 2 * beta);
  const filter: number[] = new Array(n);
  const out: number[] = new Array(n);
  const f = (i: number, k: number) => nz(i - k >= 0 ? filter[i - k] : NaN);
  const p = (k: number) => Math.pow(1 - alpha, k);
  for (let i = 0; i < n; i++) {
    filter[i] = Math.pow(alpha, 10) * source[i]
      + 10 * (1 - alpha) * f(i, 1)
      - 45 * p(2) * f(i, 2)
      + 120 * p(3) * f(i, 3)
      - 210 * p(4) * f(i, 4)
      + 252 * p(5) * f(i, 5)
      - 210 * p(6) * f(i, 6)
      + 120 * p(7) * f(i, 7)
      - 45 * p(8) * f(i, 8)
      + 10 * p(9) * f(i, 9)
      - p(10) * f(i, 10);
    // fShift = (filter + nz(filter[1])) / 2
    out[i] = (filter[i] + f(i, 1)) / 2;
  }
  return out;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<BuyingSellingPressureInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const { typeMA, ln, typeCM } = cfg;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const close = bars.map((b) => b.close);
  const prevClose = (i: number) => (i > 0 ? close[i - 1] : NaN);

  // Candle metrics
  const tr = A(ta.tr(bars, false)); // ta.tr: na on the first bar
  const br = bars.map((b) => Math.abs(b.close - b.open));
  const hw = bars.map((b) => b.high - Math.max(b.open, b.close));
  const lw = bars.map((b) => Math.min(b.open, b.close) - b.low);
  const tw = bars.map((b, i) => b.high - b.low - br[i]);
  const aw = hw.map((h, i) => (h + lw[i]) / 2);
  // bp = close - math.min(low, close[1]) - (typeCM == 'Pressure' ? 0 : lw) (math.min with na is na)
  const bp = bars.map((b, i) => b.close - Math.min(b.low, prevClose(i)) - (typeCM === 'Pressure' ? 0 : lw[i]));
  // sp = math.max(high, close[1]) - close - (typeCM == 'Pressure' ? 0 : hw)
  const sp = bars.map((b, i) => Math.max(b.high, prevClose(i)) - b.close - (typeCM === 'Pressure' ? 0 : hw[i]));

  const ma = (source: number[], length: number): number[] => {
    switch (typeMA) {
      case 'Gaussian 10 Polar': return gaus(source, length);
      case 'Linear Regression': return A(ta.linreg(S(source), length, 0));
      case 'SMA': return A(ta.sma(S(source), length));
      case 'EMA': return A(ta.ema(S(source), length));
      case 'HMA': return A(ta.hma(S(source), length));
      case 'RMA': return A(ta.rma(S(source), length));
      case 'WMA': return A(ta.wma(S(source), length));
      default: return new Array(n).fill(NaN);
    }
  };
  const none = new Array(n).fill(NaN);
  const atr = cfg.trsw ? ma(tr, ln) : none;
  const brma = cfg.brsw ? ma(br, ln) : none;
  const bpma = ma(bp, ln);
  const spma = ma(sp, ln);
  const awma = cfg.awsw ? ma(aw, ln) : none;
  const lwma = cfg.wksw ? ma(lw, ln) : none;
  const hwma = cfg.wksw ? ma(hw, ln) : none;
  const twma = cfg.twsw ? ma(tw, ln) : none;

  // bsmx = math.max(bpma, spma); bsmax = ta.highest(bsmx, ln * 3)
  const bsmx = bpma.map((b, i) => Math.max(b, spma[i]));
  const bsmax = A(ta.highest(S(bsmx), ln * 3));
  const avg = bpma.map((b, i) => (b + spma[i]) / 2);

  const bpPlot: { time: number; value: number; color: string }[] = [];
  const spPlot: { time: number; value: number; color: string }[] = [];
  const barColors: BarColorData[] = [];
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    const bpPrev = i > 0 ? bpma[i - 1] : NaN;
    const spPrev = i > 0 ? spma[i - 1] : NaN;
    // color = bpma > bpma[1] ? bpgrow : bpfall; color = spma > spma[1] ? spgrow : spfall
    bpPlot.push({ time: t, value: bpma[i], color: gt(bpma[i], bpPrev) ? BP_GROW : BP_FALL });
    spPlot.push({ time: t, value: spma[i], color: gt(spma[i], spPrev) ? SP_GROW : SP_FALL });
    // barcolor(bg and bpma < bpma[1] and close > close[1] ? color.new(bpfall, 0) : na)
    // barcolor(bg and spma < spma[1] and close < close[1] ? color.new(spfall, 0) : na)  (drawn over the first)
    if (cfg.bg) {
      let c: string | null = null;
      if (gt(bpPrev, bpma[i]) && gt(close[i], prevClose(i))) c = BP_FALL;
      if (gt(spPrev, spma[i]) && gt(prevClose(i), close[i])) c = SP_FALL;
      if (c !== null) barColors.push({ time: t, color: c });
    }
  }

  const line = (v: number[]) => bars.map((b, i) => ({ time: b.time, value: v[i] }));
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: line(atr),
      plot1: line(brma),
      plot2: line(awma),
      plot3: line(hwma),
      plot4: line(lwma),
      plot5: line(twma),
      plot6: bpPlot,
      plot7: spPlot,
    },
    fills: [
      // fill(trp, awmap, color.new(#ffffff, 90), 'ATR AWR ZONE')
      { plot1: 'plot0', plot2: 'plot2', options: { title: 'ATR AWR ZONE', color: String(color.new('#ffffff', 90)) } },
      // fill(lwp, hwp, color.new(#2a2e39, 40), 'LH Wicks ZONE')
      { plot1: 'plot4', plot2: 'plot3', options: { title: 'LH Wicks ZONE', color: String(color.new('#2a2e39', 40)) } },
      // fill(bpp, spp, math.avg(bpma, spma), bsmax, na, color.rgb(0, 0, 0, 25), 'High Shades')
      { plot1: 'plot6', plot2: 'plot7', options: { title: 'High Shades' }, gradient: {
        topValue: avg, bottomValue: bsmax,
        topColor: new Array<string | null>(n).fill(null),
        bottomColor: new Array<string | null>(n).fill(String(color.rgb(0, 0, 0, 25))),
      } },
    ],
    markers: [],
    barColors,
  };
}

export const BuyingSellingPressure = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
