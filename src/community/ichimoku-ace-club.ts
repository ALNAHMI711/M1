/**
 * Ichimoku ACE Club
 *
 * Donchian midlines (average of the lowest low and the highest high) over the Tenkan, Kijun, Knife1 and Knife2
 * lengths. Span A (average of Tenkan and Kijun) and Span B (Donchian midline over the Displacement length) are drawn
 * `Chikou` bars forward with a green / pink cloud fill (green when Span A > Span B), and the close is drawn `Chikou`
 * bars back. Projection circles: for k = 1..8 (Tenkan) and k = 1..12 (Kijun, Knife1, Knife2), the Donchian midline
 * over length - k bars of the last bar, drawn k bars after the last bar (only the last point of each, Pine
 * show_last = 1).
 *
 * Reference: "Ichimoku ACE Club" by binhmyco
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taCore, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { barInterval, barTime } from '../bar-time';

export interface IchimokuAceClubInputs {
  /** Tenkan length */
  TS: number;
  /** Kijun length */
  KJ: number;
  /** Knife1 length */
  K1: number;
  /** Knife2 length */
  K2: number;
  /** Chikou displacement (also the forward offset of the spans) */
  chikouDisp: number;
  /** Displacement: Donchian length of Span B */
  disp: number;
}

export const defaultInputs: IchimokuAceClubInputs = {
  TS: 9,
  KJ: 17,
  K1: 65,
  K2: 129,
  chikouDisp: 26,
  disp: 26,
};

export const inputConfig: InputConfig[] = [
  { id: 'TS', type: 'int', title: 'Tenkan', defval: 9, min: 1 },
  { id: 'KJ', type: 'int', title: 'Kijun', defval: 17, min: 1 },
  { id: 'K1', type: 'int', title: 'Knife1', defval: 65, min: 1 },
  { id: 'K2', type: 'int', title: 'Knife2', defval: 129, min: 1 },
  { id: 'chikouDisp', type: 'int', title: 'Chikou', defval: 26, min: 1 },
  { id: 'disp', type: 'int', title: 'Displacement', defval: 26, min: 1 },
];

/** Projection plots: (line name, length input, colour, number of offsets) in the Pine order */
const PROJECTIONS: { name: string; len: keyof IchimokuAceClubInputs; color: string; count: number }[] = [
  { name: 'Tenkan', len: 'TS', color: String(color.new(color.blue, 0)), count: 8 },
  { name: 'Kijun', len: 'KJ', color: String(color.new(color.red, 0)), count: 12 },
  { name: 'Knife1', len: 'K1', color: String(color.new(color.yellow, 0)), count: 12 },
  { name: 'Knife2', len: 'K2', color: String(color.new(color.orange, 0)), count: 12 },
];

const projectionConfig: PlotConfig[] = [];
for (const p of PROJECTIONS) {
  for (let k = 1; k <= p.count; k++) {
    projectionConfig.push({
      id: `plot${7 + projectionConfig.length}`, title: `${p.name} Projection ${k}`, color: p.color, lineWidth: 1,
      style: 'circles',
    });
  }
}

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Tenkan', color: String(color.new(color.blue, 0)), lineWidth: 1 },
  { id: 'plot1', title: 'Kijun', color: String(color.new(color.red, 0)), lineWidth: 2 },
  { id: 'plot2', title: 'Knife1', color: String(color.new(color.yellow, 0)), lineWidth: 2 },
  { id: 'plot3', title: 'Knife2', color: String(color.new(color.orange, 0)), lineWidth: 2 },
  { id: 'plot4', title: 'Chikou', color: String(color.rgb(196, 73, 218)), lineWidth: 2 },
  { id: 'plot5', title: 'Span A', color: String(color.new('#88e97b', 80)), lineWidth: 1 },
  { id: 'plot6', title: 'Span B', color: String(color.new('#ad45a5', 80)), lineWidth: 1 },
  ...projectionConfig,
];

export const metadata = {
  title: 'Ichimoku ACE Club',
  shortTitle: 'Ichimoku ACE Club',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number; color?: string };

export function calculate(bars: Bar[], inputs: Partial<IchimokuAceClubInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  const interval = barInterval(bars);

  // ta.highest / ta.lowest with a length below 1 are a Pine runtime error
  const checkLength = (len: number, fn: string) => {
    if (len < 1 && n > 0) {
      throw new Error(`Error on bar 0: Invalid value of the 'length' argument (${len.toFixed(1)}) in the '${fn}' function. It must be > 0.`);
    }
  };
  // donchian(len) = math.avg(ta.lowest(len), ta.highest(len))
  const donchian = (len: number) => {
    checkLength(len, 'lowest');
    const lo = taCore.lowest(low, len);
    const hi = taCore.highest(high, len);
    return lo.map((l, i) => (l + hi[i]) / 2);
  };

  const tenkan = donchian(cfg.TS);
  const kijun = donchian(cfg.KJ);
  const knife1 = donchian(cfg.K1);
  const knife2 = donchian(cfg.K2);
  const kumoA = tenkan.map((t, i) => (t + kijun[i]) / 2);
  const kumoB = donchian(cfg.disp);

  const P = (vals: number[], col: string, shift = 0): Point[] => {
    const out: Point[] = [];
    for (let i = 0; i < n; i++) {
      if (i + shift < 0) continue;
      out.push({ time: barTime(bars, i + shift, interval), value: vals[i], color: col });
    }
    return out;
  };
  const d = cfg.chikouDisp;
  const plots: Record<string, Point[]> = {
    plot0: P(tenkan, plotConfig[0].color),
    plot1: P(kijun, plotConfig[1].color),
    plot2: P(knife1, plotConfig[2].color),
    plot3: P(knife2, plotConfig[3].color),
    // plot(close, offset = -Chikou_Disp): the close of bar i is drawn on bar i - Chikou_Disp
    plot4: P(bars.map((b) => b.close), plotConfig[4].color, -d),
    // plot(..., offset = Chikou_Disp): the value of bar i is drawn on bar i + Chikou_Disp (future bars with barTime)
    plot5: P(kumoA, plotConfig[5].color, d),
    plot6: P(kumoB, plotConfig[6].color, d),
  };
  // fill colour of bar i goes with the plot points of bar i
  const green = String(color.new('#3db92d', 50));
  const pink = String(color.new('#df4ad2', 50));
  const fills = [{ plot1: 'plot5', plot2: 'plot6', options: { title: 'Kumo Cloud' }, colors: kumoA.map((a, i) => (gt(a, kumoB[i]) ? green : pink)) }];

  // mf(len, offset) = math.avg(ta.highest(len - offset), ta.lowest(len - offset)), plotted with offset = offset and
  // show_last = 1: only the value of the last bar is drawn, `offset` bars after it
  let id = 7;
  for (const p of PROJECTIONS) {
    const len = cfg[p.len];
    for (let k = 1; k <= p.count; k++) {
      const l = len - k;
      checkLength(l, 'highest');
      let value = NaN;
      if (n > 0) {
        const hi = taCore.highest(high.slice(Math.max(0, n - l)), l);
        const lo = taCore.lowest(low.slice(Math.max(0, n - l)), l);
        value = (hi[hi.length - 1] + lo[lo.length - 1]) / 2;
      }
      plots[`plot${id++}`] = n > 0 ? [{ time: barTime(bars, n - 1 + k, interval), value, color: p.color }] : [];
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills,
  };
}

export const IchimokuAceClub = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
