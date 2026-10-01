/**
 * Profit Nomad Testing 2 - with Buy and Sell (WaveTrend)
 *
 * WaveTrend of hlc3: esa = EMA(ap, n1), d = EMA(|ap - esa|, n1), ci = (ap - esa) / (0.015 * d),
 * WT1 = EMA(ci, n2), WT2 = SMA(WT1, 4). WT1, WT2 and WT1 - WT2 are drawn as areas with a zero line and two
 * overbought / oversold levels. Crosses of WT1 and WT2 are marked at WT2 by a thick line point and a circle, red when
 * WT2 is above WT1, lime otherwise.
 *
 * Reference: "Profit Nomad Testing 2 - with Buy and Sell" by ProfitNomad
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface DynamicTestingInputs {
  /** Channel length (EMA of hlc3 and of the distance) */
  n1: number;
  /** Average length (EMA of the CI) */
  n2: number;
  obLevel1: number;
  obLevel2: number;
  osLevel1: number;
  osLevel2: number;
}

export const defaultInputs: DynamicTestingInputs = {
  n1: 10,
  n2: 21,
  obLevel1: 60.0,
  obLevel2: 53.0,
  osLevel1: -60.0,
  osLevel2: -53.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'n1', type: 'int', title: 'Channel Length', defval: 10 },
  { id: 'n2', type: 'int', title: 'Average Length', defval: 21 },
  { id: 'obLevel1', type: 'float', title: 'Over Bought Level 1', defval: 60.0 },
  { id: 'obLevel2', type: 'float', title: 'Over Bought Level 2', defval: 53.0 },
  { id: 'osLevel1', type: 'float', title: 'Over Sold Level 1', defval: -60.0 },
  { id: 'osLevel2', type: 'float', title: 'Over Sold Level 2', defval: -53.0 },
];

const WT_COL = String(color.new(color.blue, 90));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Zero Line', color: color.gray, lineWidth: 1 },
  { id: 'plot1', title: 'Overbought Level 1', color: color.red, lineWidth: 1 },
  { id: 'plot2', title: 'Oversold Level 1', color: color.green, lineWidth: 1 },
  { id: 'plot3', title: 'Overbought Level 2', color: color.red, lineWidth: 1 },
  { id: 'plot4', title: 'Oversold Level 2', color: color.green, lineWidth: 1 },
  { id: 'plot5', title: 'WT1', color: WT_COL, lineWidth: 1, style: 'area' },
  { id: 'plot6', title: 'WT2', color: WT_COL, lineWidth: 1, style: 'area' },
  { id: 'plot7', title: 'WT1 - WT2', color: color.yellow, lineWidth: 1, style: 'area' },
  { id: 'plot8', title: 'Cross Line', color: color.black, lineWidth: 5 },
  { id: 'plot9', title: 'Cross Circles', color: color.lime, lineWidth: 6, style: 'circles' },
];

export const metadata = {
  title: 'Profit Nomad Testing 2 - with Buy and Sell',
  shortTitle: 'Profit Nomad Buy and Sell',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
/** Non-finite values (na, +-infinity) are na for the averages and the plots */
const fin = (x: number) => (Number.isFinite(x) ? x : NaN);

export function calculate(bars: Bar[], inputs: Partial<DynamicTestingInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  const ap = bars.map((b) => (b.high + b.low + b.close) / 3);
  const esa = A(ta.ema(S(ap), cfg.n1));
  const d = A(ta.ema(S(ap.map((x, i) => Math.abs(x - esa[i]))), cfg.n1));
  // ci = (ap - esa) / (0.015 * d): x / 0 is +-infinity, 0 / 0 na; ta.ema skips both
  const ci = ap.map((x, i) => (x - esa[i]) / (0.015 * d[i]));
  const wt1 = A(ta.ema(S(ci.map(fin)), cfg.n2));
  const wt2 = A(ta.sma(S(wt1), 4));

  // ta.cross(wt1, wt2): compared with the last bar where both values were not na; a tie there counts; exact
  // comparisons (no tolerance)
  const cross: boolean[] = new Array(n).fill(false);
  let p1 = NaN;
  let p2 = NaN;
  for (let i = 0; i < n; i++) {
    const a = wt1[i];
    const b = wt2[i];
    cross[i] = (a > b && p1 <= p2) || (a < b && p1 >= p2);
    if (!isNaN(a) && !isNaN(b)) {
      p1 = a;
      p2 = b;
    }
  }

  const t = (i: number) => bars[i].time;
  const line = (v: number) => bars.map((b) => ({ time: b.time, value: v }));
  const plots = {
    plot0: line(0),
    plot1: line(cfg.obLevel1),
    plot2: line(cfg.osLevel1),
    plot3: line(cfg.obLevel2),
    plot4: line(cfg.osLevel2),
    plot5: wt1.map((v, i) => ({ time: t(i), value: v })),
    plot6: wt2.map((v, i) => ({ time: t(i), value: v })),
    plot7: wt1.map((v, i) => ({ time: t(i), value: v - wt2[i] })),
    plot8: wt2.map((v, i) => ({ time: t(i), value: cross[i] ? v : NaN })),
    // color = wt2 - wt1 > 0 ? color.red : color.lime
    plot9: wt2.map((v, i) => ({ time: t(i), value: cross[i] ? v : NaN, color: gt(v - wt1[i], 0) ? color.red : color.lime })),
  };

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
  };
}

export const DynamicTesting = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
