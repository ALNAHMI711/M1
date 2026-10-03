/**
 * BTC Logarithmic Regression Quantile Bands
 *
 * From the anchor date on, a linear regression of log(close) over the bars since the anchor (at most `length`
 * bars) gives the trend; the residual is log(close) - trend. Nearest-rank percentiles of the residual over the same
 * number of bars (1 / 99, qa / 100 - qa and 50) are added to the trend and taken back with exp() to draw five price
 * bands with two fills. The background marks a close outside the inner bands; the candles are coloured by the band
 * zone of the close.
 *
 * Reference: "BTC Logarithmic Regression Quantile Bands | Astral Vision 🌠💠" by AstralVision
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © AstralVision
 */

import { taCore, callsite, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, BgColorData } from '../types';

export interface BtcLogarithmicRegressionQuantileBandsAstralVisionInputs {
  /** Anchor date (UNIX ms, Pine input.time) */
  anchorDate: number;
  /** Regression length (bars) */
  length: number;
  /** Show the fills */
  showFills: boolean;
  /** Inner quantile pair (qa / 100 - qa) */
  qa: number;
  /** Colour theme */
  theme: 'Inferno' | 'Paradiso' | 'Futura' | 'Infinito' | 'Hermes';
  /** Use the custom colours */
  usecustom: boolean;
  customPos: string;
  customNeg: string;
  /** Median colour */
  midCol: string;
}

/** timestamp("2012-01-01"): the Pine input default is the constant 1325376000000 (00:00 UTC) */
const DEFAULT_ANCHOR = 1325376000000;

export const defaultInputs: BtcLogarithmicRegressionQuantileBandsAstralVisionInputs = {
  anchorDate: DEFAULT_ANCHOR,
  length: 1200,
  showFills: true,
  qa: 5,
  theme: 'Futura',
  usecustom: false,
  customPos: 'rgb(255, 255, 255)',
  customNeg: 'rgb(100, 100, 100)',
  midCol: 'rgba(255, 255, 255, 0.8)',
};

const GROUP1 = 'Settings';
const GROUP2 = 'Colors';

export const inputConfig: InputConfig[] = [
  { id: 'anchorDate', type: 'time', title: 'Anchor Date', defval: DEFAULT_ANCHOR, group: GROUP1 },
  { id: 'length', type: 'int', title: 'Regression Length (bars)', defval: 1200, min: 100, group: GROUP1 },
  { id: 'showFills', type: 'bool', title: 'Show Fills', defval: true, group: GROUP1 },
  { id: 'qa', type: 'int', title: 'Inner Quantile Pair', defval: 5, min: 2, max: 48, group: GROUP1 },
  { id: 'theme', type: 'string', title: 'Color Theme', defval: 'Futura', options: ['Inferno', 'Paradiso', 'Futura', 'Infinito', 'Hermes'], group: GROUP2 },
  { id: 'usecustom', type: 'bool', title: 'Use Custom Colors', defval: false, group: GROUP2 },
  { id: 'customPos', type: 'color', title: 'Custom Positive', defval: 'rgb(255, 255, 255)', group: GROUP2 },
  { id: 'customNeg', type: 'color', title: 'Custom Negative', defval: 'rgb(100, 100, 100)', group: GROUP2 },
  { id: 'midCol', type: 'color', title: 'Median Color', defval: 'rgba(255, 255, 255, 0.8)', group: GROUP2 },
];

const POS_DEFAULT = String(color.rgb(0, 255, 180));
const NEG_DEFAULT = String(color.rgb(180, 0, 255));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Q99', color: String(color.new(POS_DEFAULT, 0)), lineWidth: 2 },
  { id: 'plot1', title: 'QHi', color: String(color.new(POS_DEFAULT, 20)), lineWidth: 1 },
  { id: 'plot2', title: 'Q50', color: String(color.new('rgba(255, 255, 255, 0.8)', 50)), lineWidth: 1 },
  { id: 'plot3', title: 'QLo', color: String(color.new(NEG_DEFAULT, 20)), lineWidth: 1 },
  { id: 'plot4', title: 'Q1', color: String(color.new(NEG_DEFAULT, 0)), lineWidth: 2 },
];

export const metadata = {
  title: 'BTC Logarithmic Regression Quantile Bands | Astral Vision 🌠💠',
  shortTitle: 'BTC Logarithmic Regression Quantile Bands | Astral Vision 🌠💠',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<BtcLogarithmicRegressionQuantileBandsAstralVisionInputs> = {},
): IndicatorResult & { barColors: BarColorData[]; bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const nBars = bars.length;
  const length = cfg.length;

  const themePos: Record<string, string> = {
    Paradiso: String(color.rgb(0, 210, 255)), Futura: String(color.rgb(0, 255, 180)),
    Infinito: String(color.rgb(180, 120, 255)), Hermes: String(color.rgb(255, 160, 0)),
  };
  const themeNeg: Record<string, string> = {
    Paradiso: String(color.rgb(0, 80, 160)), Futura: String(color.rgb(180, 0, 255)),
    Infinito: String(color.rgb(255, 220, 80)), Hermes: String(color.rgb(0, 180, 120)),
  };
  const poscol = cfg.usecustom ? cfg.customPos : (themePos[cfg.theme] ?? String(color.rgb(255, 0, 0)));
  const negcol = cfg.usecustom ? cfg.customNeg : (themeNeg[cfg.theme] ?? String(color.rgb(120, 0, 0)));

  // after_anchor = time >= anchor_date (Pine time = bar time in ms); var int n counts the bars since the anchor
  const afterAnchor = bars.map((b) => b.time * 1000 >= cfg.anchorDate);
  const lp = bars.map((b) => Math.log(b.close));
  const nCount: number[] = new Array(nBars);
  let cnt = 0;
  for (let i = 0; i < nBars; i++) {
    if (afterAnchor[i]) cnt += 1;
    nCount[i] = cnt;
  }

  // trend = after_anchor and active_len > 0 ? ta.linreg(lp, active_len, 0) : na, active_len = min(n, length).
  // The call runs on every bar from the anchor bar on (after_anchor stays true), and its window of active_len bars
  // only holds bars where it ran: the linreg of the last active_len values of lp.
  const trend: number[] = new Array(nBars).fill(NaN);
  for (let i = 0; i < nBars; i++) {
    const activeLen = Math.min(nCount[i], length);
    if (!(afterAnchor[i] && activeLen > 0)) continue;
    const win = lp.slice(i - activeLen + 1, i + 1);
    trend[i] = taCore.linreg(win, activeLen, 0)[activeLen - 1];
  }
  const resid = trend.map((t, i) => (!isNaN(t) ? lp[i] - t : NaN));

  // q = n >= 2 ? ta.percentile_nearest_rank(resid, active_len, p) : na. The call keeps the history of its own
  // calls (from n = 2): with active_len = n it has n - 1 values, fewer than active_len, so it is na until
  // active_len stops at `length` (n > length); from then on the length is the constant `length`.
  const called = nCount.map((c) => c >= 2);
  const pct = (p: number) => callsite.whenCalled(called, (r) => taCore.percentile_nearest_rank(r, length, p), resid) as number[];
  const qoLoR = pct(1);
  const qoHiR = pct(99);
  const qiLoR = pct(cfg.qa);
  const qiHiR = pct(100 - cfg.qa);
  const q50R = pct(50);

  const v = (r: number[]) => r.map((x, i) => Math.exp(trend[i] + x));
  const qoLoV = v(qoLoR);
  const qoHiV = v(qoHiR);
  const qiLoV = v(qiLoR);
  const qiHiV = v(qiHiR);
  const q50V = v(q50R);

  const plot = (vals: number[], c: string) => bars.map((b, i) => ({ time: b.time, value: afterAnchor[i] ? vals[i] : NaN, color: c }));
  const posFill = cfg.showFills ? String(color.new(poscol, 50)) : 'transparent';
  const negFill = cfg.showFills ? String(color.new(negcol, 40)) : 'transparent';

  // bgcolor(close < qi_lo_v ? color.new(negcol, 50) : close > qi_hi_v ? color.new(poscol, 50) : na)
  const bgNeg = String(color.new(negcol, 50));
  const bgPos = String(color.new(poscol, 50));
  const bgColors: BgColorData[] = [];
  // barcolor(close > qo_hi_v ? poscol : close > qi_hi_v ? poscol 40 : close > q50_v ? poscol 70 :
  //          close > qi_lo_v ? negcol 70 : close > qo_lo_v ? negcol 40 : negcol)
  const bc = [
    String(color.new(poscol, 0)), String(color.new(poscol, 40)), String(color.new(poscol, 70)),
    String(color.new(negcol, 70)), String(color.new(negcol, 40)), String(color.new(negcol, 0)),
  ];
  const barColors: BarColorData[] = [];
  for (let i = 0; i < nBars; i++) {
    const c = bars[i].close;
    if (lt(c, qiLoV[i])) bgColors.push({ time: bars[i].time, color: bgNeg });
    else if (gt(c, qiHiV[i])) bgColors.push({ time: bars[i].time, color: bgPos });
    const k = gt(c, qoHiV[i]) ? 0 : gt(c, qiHiV[i]) ? 1 : gt(c, q50V[i]) ? 2 : gt(c, qiLoV[i]) ? 3 : gt(c, qoLoV[i]) ? 4 : 5;
    barColors.push({ time: bars[i].time, color: bc[k] });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: plot(qoHiV, String(color.new(poscol, 0))),
      plot1: plot(qiHiV, String(color.new(poscol, 20))),
      plot2: plot(q50V, String(color.new(cfg.midCol, 50))),
      plot3: plot(qiLoV, String(color.new(negcol, 20))),
      plot4: plot(qoLoV, String(color.new(negcol, 0))),
    },
    fills: [
      // fill(p_o_hi, p_i_hi, show_fills ? color.new(poscol, 50) : na); fill(p_i_lo, p_o_lo, show_fills ? color.new(negcol, 40) : na)
      { plot1: 'plot0', plot2: 'plot1', colors: new Array<string>(nBars).fill(posFill) },
      { plot1: 'plot3', plot2: 'plot4', colors: new Array<string>(nBars).fill(negFill) },
    ],
    bgColors,
    barColors,
  };
}

export const BtcLogarithmicRegressionQuantileBandsAstralVision = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
