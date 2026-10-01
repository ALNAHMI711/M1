/**
 * Dan's Ironclad OB - Simple
 *
 * Pivot highs / lows (`pivotLen` bars on each side) set the last structure high / low. When the close crosses above
 * the last high, the last down candle of the 50 bars before becomes the buy zone (its high and low) and the high is
 * cleared until the next pivot; a cross under the last low takes the last up candle as the sell zone. A close below
 * the buy zone or above the sell zone removes the zone. The zones are drawn as fills between hidden plots.
 *
 * Reference: "Dan's Ironclad OB - Simple" by hynaxiii
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface DanSIroncladObSimpleInputs {
  /** Pivot length (bars on each side) */
  pivotLen: number;
  /** Buy zone fill colour */
  obColorBull: string;
  /** Sell zone fill colour */
  obColorBear: string;
}

export const defaultInputs: DanSIroncladObSimpleInputs = {
  pivotLen: 5,
  obColorBull: String(color.new('#388e3c', 60)),
  obColorBear: String(color.new('#d32f2f', 60)),
};

export const inputConfig: InputConfig[] = [
  { id: 'pivotLen', type: 'int', title: 'Structure Lookback', defval: 5 },
  { id: 'obColorBull', type: 'color', title: 'Buy Zone Color', defval: String(color.new('#388e3c', 60)) },
  { id: 'obColorBear', type: 'color', title: 'Sell Zone Color', defval: String(color.new('#d32f2f', 60)) },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Buy Top', color: 'transparent', lineWidth: 1, style: 'linebr' },
  { id: 'plot1', title: 'Buy Btm', color: 'transparent', lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'Sell Top', color: 'transparent', lineWidth: 1, style: 'linebr' },
  { id: 'plot3', title: 'Sell Btm', color: 'transparent', lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: "Dan's Ironclad OB - Simple",
  shortTitle: "Dan's Ironclad OB - Simple",
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

export function calculate(bars: Bar[], inputs: Partial<DanSIroncladObSimpleInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const pH = A(ta.pivothigh(S(bars.map((b) => b.high)), cfg.pivotLen, cfg.pivotLen));
  const pL = A(ta.pivotlow(S(bars.map((b) => b.low)), cfg.pivotLen, cfg.pivotLen));

  const buyTop = new Array<number>(n);
  const buyBtm = new Array<number>(n);
  const sellTop = new Array<number>(n);
  const sellBtm = new Array<number>(n);
  let lastHigh = NaN;
  let lastLow = NaN;
  let buyZoneTop = NaN;
  let buyZoneBtm = NaN;
  let sellZoneTop = NaN;
  let sellZoneBtm = NaN;
  // ta.crossover / ta.crossunder: compared with the last bar where both values were not na; a tie there counts
  let pcH = NaN;
  let pH1 = NaN;
  let pcL = NaN;
  let pL1 = NaN;
  for (let i = 0; i < n; i++) {
    const close = bars[i].close;
    if (!isNaN(pH[i])) lastHigh = pH[i];
    if (!isNaN(pL[i])) lastLow = pL[i];

    const bullBreak = gt(close, lastHigh) && le(pcH, pH1);
    const bearBreak = lt(close, lastLow) && ge(pcL, pL1);
    if (!isNaN(close) && !isNaN(lastHigh)) {
      pcH = close;
      pH1 = lastHigh;
    }
    if (!isNaN(close) && !isNaN(lastLow)) {
      pcL = close;
      pL1 = lastLow;
    }

    // Buy zone: the last down candle of the 50 bars before the break
    if (bullBreak && !isNaN(lastHigh)) {
      for (let k = 1; k <= 50 && i - k >= 0; k++) {
        if (lt(bars[i - k].close, bars[i - k].open)) {
          buyZoneTop = bars[i - k].high;
          buyZoneBtm = bars[i - k].low;
          break;
        }
      }
      lastHigh = NaN;
    }
    // Sell zone: the last up candle of the 50 bars before the break
    if (bearBreak && !isNaN(lastLow)) {
      for (let k = 1; k <= 50 && i - k >= 0; k++) {
        if (gt(bars[i - k].close, bars[i - k].open)) {
          sellZoneTop = bars[i - k].high;
          sellZoneBtm = bars[i - k].low;
          break;
        }
      }
      lastLow = NaN;
    }

    // Mitigation
    if (lt(close, buyZoneBtm)) {
      buyZoneTop = NaN;
      buyZoneBtm = NaN;
    }
    if (gt(close, sellZoneTop)) {
      sellZoneTop = NaN;
      sellZoneBtm = NaN;
    }
    buyTop[i] = buyZoneTop;
    buyBtm[i] = buyZoneBtm;
    sellTop[i] = sellZoneTop;
    sellBtm[i] = sellZoneBtm;
  }

  const P = (v: number[]) => bars.map((b, i) => ({ time: b.time, value: v[i], color: 'transparent' }));
  // fill(p1, p2, buyZoneTop > 0 ? obColorBull : na, "Buy Zone"); fill(p3, p4, sellZoneTop > 0 ? obColorBear : na, "Sell Zone")
  const buyColors = buyTop.map((v) => (gt(v, 0) ? cfg.obColorBull : 'transparent'));
  const sellColors = sellTop.map((v) => (gt(v, 0) ? cfg.obColorBear : 'transparent'));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: P(buyTop), plot1: P(buyBtm), plot2: P(sellTop), plot3: P(sellBtm) },
    fills: [
      { plot1: 'plot0', plot2: 'plot1', options: { title: 'Buy Zone', color: cfg.obColorBull }, colors: buyColors },
      { plot1: 'plot2', plot2: 'plot3', options: { title: 'Sell Zone', color: cfg.obColorBear }, colors: sellColors },
    ],
  };
}

export const DanSIroncladObSimple = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
