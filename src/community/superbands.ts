/**
 * SuperBands
 *
 * Two SuperTrend-like trails, one bullish and one bearish, each with its own ATR (Wilder smoothing of the true range)
 * times a multiplier. The bullish trail follows max(low - atr, trail) and the bearish trail min(high + atr, trail),
 * both smoothed by an EMA of period `smoothing`. A trail is reset and starts again from the current bar when the
 * close crosses its previous value (below for the bullish trail, above for the bearish trail). The colour of a trail
 * is a gradient of the slope of the trail, normalised by an EMA of its absolute changes (angle in degrees * 10 / 9:
 * 0..65 for the bullish trail, -65..0 for the bearish trail). The center line is the mean of the two trails, with the
 * colour of the bullish trail when it rises and of the bearish trail when it falls. Gradient fills run from the
 * bullish trail to the high and from the bearish trail to the low.
 *
 * Reference: "SuperBands" by The_Peaceful_Lizard
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © The_Peaceful_Lizard
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface SuperBandsInputs {
  /** Trail smoothing period of the bullish leg */
  bullSmoothing: number;
  /** ATR length of the bullish trail offset */
  bullAtrPeriod: number;
  /** ATR multiplier of the bullish trail */
  bullMultiplier: number;
  /** Bullish colour (top of the gradient) */
  bullUpColor: string;
  /** Bullish colour (bottom of the gradient) */
  bullDownColor: string;
  /** Transparency of the bullish fill at the trail */
  bullStartAlpha: number;
  /** Transparency of the bullish fill at the high */
  bullEndAlpha: number;
  /** Trail smoothing period of the bearish leg */
  bearSmoothing: number;
  /** ATR length of the bearish trail offset */
  bearAtrPeriod: number;
  /** ATR multiplier of the bearish trail */
  bearMultiplier: number;
  /** Bearish colour (bottom of the gradient) */
  bearDownColor: string;
  /** Bearish colour (top of the gradient) */
  bearUpColor: string;
  /** Transparency of the bearish fill at the trail */
  bearStartAlpha: number;
  /** Transparency of the bearish fill at the low */
  bearEndAlpha: number;
}

export const defaultInputs: SuperBandsInputs = {
  bullSmoothing: 18,
  bullAtrPeriod: 12,
  bullMultiplier: 1,
  bullUpColor: '#26A69A',
  bullDownColor: '#B2DFDB',
  bullStartAlpha: 86,
  bullEndAlpha: 98,
  bearSmoothing: 18,
  bearAtrPeriod: 12,
  bearMultiplier: 1,
  bearDownColor: '#FF5252',
  bearUpColor: '#FFCDD2',
  bearStartAlpha: 86,
  bearEndAlpha: 98,
};

const BULL = 'Bullish Settings';
const BEAR = 'Bearish Settings';

export const inputConfig: InputConfig[] = [
  { id: 'bullSmoothing', type: 'float', title: 'Smoothing', defval: 18, min: 1, step: 0.125, group: BULL,
    tooltip: 'Trail smoothing period for the bullish leg.\nHigher values smooth more but react slower.' },
  { id: 'bullAtrPeriod', type: 'float', title: 'ATR Period', defval: 12, min: 1, step: 0.125, group: BULL,
    tooltip: 'ATR length used to compute the bullish trail offset.' },
  { id: 'bullMultiplier', type: 'float', title: 'Multiplier', defval: 1, min: 0, step: 0.125, group: BULL,
    tooltip: 'Multiplier applied to ATR to size the bullish trail.\nLarger = wider distance from price.' },
  { id: 'bullUpColor', type: 'color', title: 'Color', defval: '#26A69A', inline: 'bull_color_inline', group: BULL,
    tooltip: 'Primary color for bullish up-trend visual.' },
  { id: 'bullDownColor', type: 'color', title: '', defval: '#B2DFDB', inline: 'bull_color_inline', group: BULL },
  { id: 'bullStartAlpha', type: 'int', title: 'BG Alpha', defval: 86, min: 0, max: 100, inline: 'bull_bg_inline', group: BULL },
  { id: 'bullEndAlpha', type: 'int', title: '', defval: 98, min: 0, max: 100, inline: 'bull_bg_inline', group: BULL },
  { id: 'bearSmoothing', type: 'float', title: 'Smoothing', defval: 18, min: 1, step: 0.125, group: BEAR,
    tooltip: 'Trail smoothing period for the bearish leg.\nHigher values smooth more but react slower.' },
  { id: 'bearAtrPeriod', type: 'float', title: 'ATR Period', defval: 12, min: 1, step: 0.125, group: BEAR,
    tooltip: 'ATR length used to compute the bearish trail offset.' },
  { id: 'bearMultiplier', type: 'float', title: 'Multiplier', defval: 1, min: 0, step: 0.125, group: BEAR,
    tooltip: 'Multiplier applied to ATR to size the bearish trail.\nLarger = wider distance from price.' },
  { id: 'bearDownColor', type: 'color', title: 'Color', defval: '#FF5252', inline: 'bear_color_inline', group: BEAR,
    tooltip: 'Primary color for bearish down-trend visual.' },
  { id: 'bearUpColor', type: 'color', title: '', defval: '#FFCDD2', inline: 'bear_color_inline', group: BEAR },
  { id: 'bearStartAlpha', type: 'int', title: 'BG Alpha', defval: 86, min: 0, max: 100, inline: 'bear_bg_inline', group: BEAR },
  { id: 'bearEndAlpha', type: 'int', title: '', defval: 98, min: 0, max: 100, inline: 'bear_bg_inline', group: BEAR },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Center', color: '#26A69A', lineWidth: 1 },
  { id: 'plot1', title: 'Up Trend', color: String(color.new('#26A69A', 80)), lineWidth: 4, style: 'linebr' },
  { id: 'plot2', title: 'Down Trend', color: String(color.new('#FF5252', 80)), lineWidth: 4, style: 'linebr' },
  { id: 'plot3', title: 'Up Trend', color: String(color.new('#26A69A', 60)), lineWidth: 2, style: 'linebr' },
  { id: 'plot4', title: 'Down Trend', color: String(color.new('#FF5252', 60)), lineWidth: 2, style: 'linebr' },
  { id: 'plot5', title: 'Up Trend', color: String(color.new('#26A69A', 5)), lineWidth: 1, style: 'linebr' },
  { id: 'plot6', title: 'Down Trend', color: String(color.new('#FF5252', 5)), lineWidth: 1, style: 'linebr' },
  { id: 'plot7', title: 'High', color: '#0000001a', lineWidth: 1, style: 'linebr', display: 'pane' },
  { id: 'plot8', title: 'Low', color: '#0000001a', lineWidth: 1, style: 'linebr', display: 'pane' },
];

export const metadata = {
  title: 'SuperBands',
  shortTitle: 'SuperBands',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Direction = 'up' | 'down' | 'nan';
/** Pine colour; null = na */
type PineColor = string | null;

/** color.from_gradient: na when the value is na */
const gradient = (v: number, lo: number, hi: number, cLo: PineColor, cHi: PineColor): PineColor =>
  (isNaN(v) ? null : color.from_gradient(v, lo, hi, cLo as string, cHi as string));
/** color.new(c, t): color.new(na, t) is black with transparency t */
const withTransp = (c: PineColor, t: number): string => String(color.new((c ?? '#000000') as string, t));

/**
 * superbands(direction, atr_period, multiplier, smoothing, color_lo, color_hi): trail price and colour of one leg
 * (its own `var` SuperTrend object, ATR and trend_atr state).
 */
function superbands(
  bars: Bar[], direction: 'up' | 'down', atrPeriod: number, multiplier: number, smoothing: number,
  colorLo: string, colorHi: string,
): { price: number[]; col: PineColor[] } {
  const n = bars.length;
  const price: number[] = new Array(n);
  const col: PineColor[] = new Array(n);

  // var SuperTrend trend = SuperTrend.new()
  let stDirection: Direction = 'nan';
  let stLastDirection: Direction = 'nan';
  let current = NaN;
  let last = NaN;
  let active = false;

  let trendAtr = 0; // var float trend_atr = 0
  const alphaT = 2 / (smoothing * 2 + 1);
  const betaT = 1 - alphaT;
  // rma(tr(), atr_period): var float rma = nz(source); rma := source * beta + nz(rma[1], rma) * alpha
  const rmaBeta = 1 / atrPeriod;
  const rmaAlpha = 1 - rmaBeta;
  let rma = NaN;
  const gradMin = direction === 'up' ? 0 : -65;
  const gradMax = direction === 'up' ? 65 : 0;
  const stAlpha = 2 / (1 + smoothing);
  const stBeta = 1 - stAlpha;

  for (let i = 0; i < n; i++) {
    const { high, low, open, close } = bars[i];
    const prevClose = i > 0 ? bars[i - 1].close : NaN;
    const tr = Math.max(
      high - low,
      Math.abs(high - (isNaN(prevClose) ? Math.max(open, close) : prevClose)),
      Math.abs(low - (isNaN(prevClose) ? Math.min(open, close) : prevClose)),
    );
    if (i === 0) rma = isNaN(tr) ? 0 : tr;
    rma = tr * rmaBeta + rma * rmaAlpha;
    const legAtr = rma * multiplier;

    // update_state(direction)
    if (active && stDirection === direction) {
      const ref = isNaN(last) ? close : last;
      active = direction === 'up' ? !lt(close, ref) : !gt(close, ref);
      if (!active) {
        // reset()
        stDirection = 'nan';
        last = NaN;
        current = NaN;
      }
    }
    // update_last_direction()
    stLastDirection = stDirection;
    // update_direction(direction)
    if (!active) stDirection = direction;
    // check_new()
    if (stLastDirection !== stDirection && !active) active = true;
    // add_new_point(atr, period)
    if (active) {
      let trend = stDirection === 'up'
        ? Math.max(low - legAtr, isNaN(current) ? low - legAtr : current)
        : stDirection === 'down'
          ? Math.min(high + legAtr, isNaN(current) ? high + legAtr : current)
          : NaN;
      trend = trend * stAlpha + (isNaN(current) ? trend : current) * stBeta;
      last = isNaN(current) ? trend : current;
      current = trend;
    }

    const delta = current - last;
    if (!isNaN(delta)) trendAtr = Math.abs(delta) * alphaT + trendAtr * betaT;
    // to_oscilator(fixnan(nz(delta)), trend_atr): x / 0 is na
    const d = isNaN(delta) ? 0 : delta;
    const angle = trendAtr === 0 ? NaN : ((Math.atan(d / trendAtr) * 180) / Math.PI) * (10 / 9);
    col[i] = gradient(angle, gradMin, gradMax, colorLo, colorHi);
    price[i] = current;
  }
  return { price, col };
}

export function calculate(bars: Bar[], inputs: Partial<SuperBandsInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const up = superbands(bars, 'up', cfg.bullAtrPeriod, cfg.bullMultiplier, cfg.bullSmoothing,
    cfg.bullDownColor, cfg.bullUpColor);
  const down = superbands(bars, 'down', cfg.bearAtrPeriod, cfg.bearMultiplier, cfg.bearSmoothing,
    cfg.bearDownColor, cfg.bearUpColor);

  const center: number[] = new Array(n);
  const centerColor: PineColor[] = new Array(n);
  for (let i = 0; i < n; i++) {
    center[i] = (up.price[i] + down.price[i]) / 2;
    const prev = i > 0 && !isNaN(center[i - 1]) ? center[i - 1] : center[i];
    const centerDelta = center[i] - prev;
    centerColor[i] = gt(centerDelta, 0) ? up.col[i]
      : lt(centerDelta, 0) ? down.col[i]
        : gradient(0.5, 0, 1, down.col[i], up.col[i]);
  }

  const t = (i: number) => bars[i].time;
  const line = (v: number[], c: (i: number) => string) => bars.map((_b, i) => ({ time: t(i), value: v[i], color: c(i) }));
  const hl2 = bars.map((b) => (b.high + b.low) / 2);
  const shadow = '#0000001a';

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: line(center, (i) => centerColor[i] ?? 'transparent'),
      plot1: line(up.price, (i) => withTransp(up.col[i], 80)),
      plot2: line(down.price, (i) => withTransp(down.col[i], 80)),
      plot3: line(up.price, (i) => withTransp(up.col[i], 60)),
      plot4: line(down.price, (i) => withTransp(down.col[i], 60)),
      plot5: line(up.price, (i) => withTransp(up.col[i], 5)),
      plot6: line(down.price, (i) => withTransp(down.col[i], 5)),
      // plot(not na(down_price) ? hl2 : na, "High", ...), plot(not na(up_price) ? hl2 : na, "Low", ...)
      plot7: line(down.price.map((p, i) => (isNaN(p) ? NaN : hl2[i])), () => shadow),
      plot8: line(up.price.map((p, i) => (isNaN(p) ? NaN : hl2[i])), () => shadow),
    },
    fills: [
      // fill(up_p, low_p, high, up_price, color.new(bull_up_color, bull_end_alpha), color.new(up_trend_color, bull_start_alpha))
      {
        plot1: 'plot5', plot2: 'plot8',
        gradient: {
          topValue: bars.map((b) => b.high),
          bottomValue: up.price.slice(),
          topColor: bars.map(() => withTransp(cfg.bullUpColor, cfg.bullEndAlpha)),
          bottomColor: up.col.map((c) => withTransp(c, cfg.bullStartAlpha)),
        },
      },
      // fill(down_p, high_p, down_price, low, color.new(down_trend_color, bear_start_alpha), color.new(bear_down_color, bear_end_alpha))
      {
        plot1: 'plot6', plot2: 'plot7',
        gradient: {
          topValue: down.price.slice(),
          bottomValue: bars.map((b) => b.low),
          topColor: down.col.map((c) => withTransp(c, cfg.bearStartAlpha)),
          bottomColor: bars.map(() => withTransp(cfg.bearDownColor, cfg.bearEndAlpha)),
        },
      },
    ],
  };
}

export const SuperBands = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
