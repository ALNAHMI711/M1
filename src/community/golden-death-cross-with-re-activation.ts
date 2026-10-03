/**
 * Golden & Death Cross Re-Activation Ribbon BB
 *
 * Two moving averages (SMA, EMA, WMA, HMA or RMA of the close). A golden cross (MA 1 crosses above MA 2) starts a
 * long state and a death cross a short state; the state keeps the extreme distance MA 1 - MA 2 since the cross and
 * ends when the distance falls (long) or rises (short) for 2 bars. An ended state is re-activated when the distance
 * passes its kept extreme by the threshold while moving in the state direction for 2 bars. The state is drawn as a
 * ribbon in the outer 32 % of the Bollinger Bands (short: below the upper band, long: above the lower band); its
 * colour goes from a dark to a light hue and from faint to visible with a strength made of the distance / ATR and
 * the RSI distance from 50 (a faint ribbon while the state cools down). Bollinger lines, MA glow lines and dots on
 * the crosses.
 *
 * Reference: "Golden & Death Cross Re-Activation Ribbon BB [by Oberlunar]" by oberlunar_tr
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

type MaType = 'SMA' | 'EMA' | 'WMA' | 'HMA' | 'RMA';

export interface GoldenDeathCrossWithReActivationInputs {
  /** Type of MA 1 (small) */
  maType1: MaType;
  /** Type of MA 2 (big) */
  maType2: MaType;
  maLen1: number;
  maLen2: number;
  /** Distance threshold for re-activation */
  treshold: number;
  bbLen: number;
  bbMult: number;
  rsiLen: number;
  atrLen: number;
  /** Show the Bollinger ribbon fills */
  showRibbon: boolean;
  /** MA line width (the port keeps the default widths: 2 for the MA lines, 6 for the glow lines) */
  maWidth: number;
  showBBLines: boolean;
  showBasis: boolean;
  /** MA soft glow lines */
  showGlow: boolean;
}

export const defaultInputs: GoldenDeathCrossWithReActivationInputs = {
  maType1: 'HMA',
  maType2: 'HMA',
  maLen1: 21,
  maLen2: 200,
  treshold: 0.5,
  bbLen: 20,
  bbMult: 2.0,
  rsiLen: 14,
  atrLen: 14,
  showRibbon: true,
  maWidth: 2,
  showBBLines: true,
  showBasis: true,
  showGlow: true,
};

const MA_TYPES = ['SMA', 'EMA', 'WMA', 'HMA', 'RMA'];
const G_MA = 'Moving Averages';
const G_RB = 'Ribbon (Bollinger)';
const G_ST = 'Style';

export const inputConfig: InputConfig[] = [
  { id: 'maType1', type: 'string', title: 'Type MA 1 (small)', defval: 'HMA', options: MA_TYPES, group: G_MA },
  { id: 'maType2', type: 'string', title: 'Type MA 2 (big)', defval: 'HMA', options: MA_TYPES, group: G_MA },
  { id: 'maLen1', type: 'int', title: 'Length MA 1', defval: 21, min: 1, group: G_MA },
  { id: 'maLen2', type: 'int', title: 'Length MA 2', defval: 200, min: 1, group: G_MA },
  { id: 'treshold', type: 'float', title: 'Distance threshold for re-activation', defval: 0.5, step: 0.1, group: G_RB },
  { id: 'bbLen', type: 'int', title: 'BB Length', defval: 20, min: 5, group: G_RB },
  { id: 'bbMult', type: 'float', title: 'BB Mult', defval: 2.0, step: 0.1, group: G_RB },
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 2, group: G_RB },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 14, min: 2, group: G_RB },
  { id: 'showRibbon', type: 'bool', title: 'Show BB ribbon', defval: true, group: G_RB },
  { id: 'maWidth', type: 'int', title: 'MA line width', defval: 2, min: 1, max: 6, group: G_ST },
  { id: 'showBBLines', type: 'bool', title: 'Show BB envelope lines', defval: true, group: G_ST },
  { id: 'showBasis', type: 'bool', title: 'Show BB basis (mid)', defval: true, group: G_ST },
  { id: 'showGlow', type: 'bool', title: 'MA soft glow', defval: true, group: G_ST },
];

// Palette
const C_AQUA_LO = color.rgb(64, 168, 181);
const C_AQUA_HI = color.rgb(120, 220, 232);
const C_TIT_LO = color.rgb(190, 92, 80);
const C_TIT_HI = color.rgb(228, 130, 110);
const C_BASIS = color.rgb(160, 160, 170);
const C_BB_EDGE = color.rgb(120, 125, 140);

const COL_EDGE = String(color.new(C_BB_EDGE, 70));
const COL_BASIS = String(color.new(C_BASIS, 60));
const COL_GLOW1 = String(color.new(C_AQUA_LO, 86));
const COL_GLOW2 = String(color.new(C_TIT_LO, 86));
const COL_MA1 = String(color.new(C_AQUA_HI, 10));
const COL_MA2 = String(color.new(C_TIT_HI, 10));
const COL_GOLDEN = String(color.new(C_AQUA_HI, 0));
const COL_DEATH = String(color.new(C_TIT_HI, 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Ribbon Short Top', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot1', title: 'Ribbon Short Bottom', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Ribbon Long Bottom', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Ribbon Long Top', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'BB Upper', color: COL_EDGE, lineWidth: 1 },
  { id: 'plot5', title: 'BB Lower', color: COL_EDGE, lineWidth: 1 },
  { id: 'plot6', title: 'BB Basis', color: COL_BASIS, lineWidth: 1 },
  { id: 'plot7', title: 'MA1 glow', color: COL_GLOW1, lineWidth: 6 },
  { id: 'plot8', title: 'MA2 glow', color: COL_GLOW2, lineWidth: 6 },
  { id: 'plot9', title: 'MA 1', color: COL_MA1, lineWidth: 2 },
  { id: 'plot10', title: 'MA 2', color: COL_MA2, lineWidth: 2 },
];

export const metadata = {
  title: 'Golden & Death Cross Re-Activation Ribbon BB [by Oberlunar]',
  shortTitle: 'Golden & Death Cross Re-Activation Ribbon BB [by Oberlunar]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const nz = (x: number, y: number) => (Number.isFinite(x) ? x : y);

/** f_clamp01(x): x below 0 -> 0, above 1 -> 1 (na stays na) */
const clamp01 = (x: number) => {
  let y = x;
  if (lt(y, 0.0)) y = 0.0;
  if (gt(y, 1.0)) y = 1.0;
  return y;
};

/** f_alpha_from_strength(s, isCooling): transparency 92 (faint) .. 55, + 6 while cooling, clamped to 40..95 */
const alphaFromStrength = (s: number, isCooling: boolean) => {
  let a = 92 - Math.trunc(Math.round(37.0 * nz(s, 0.0)));
  if (isCooling) a += 6;
  return Math.max(40, Math.min(95, a));
};

export function calculate(
  bars: Bar[],
  inputs: Partial<GoldenDeathCrossWithReActivationInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const close = S(bars.map((b) => b.close));

  // calc_ma(type, close, len): the type is a constant input, so one branch runs on every bar
  const calcMa = (type: MaType, len: number) => {
    switch (type) {
      case 'SMA': return A(ta.sma(close, len));
      case 'EMA': return A(ta.ema(close, len));
      case 'WMA': return A(ta.wma(close, len));
      case 'HMA':
        // ta.hma(x, 1) calls ta.wma(x, 0): a Pine runtime error
        if (Math.floor(len / 2) < 1 && n > 0) {
          throw new Error("Invalid value of the 'length' argument (0.0) in the 'wma' function. It must be > 0.");
        }
        return A(ta.hma(close, len));
      default: return A(ta.rma(close, len));
    }
  };
  const ma1 = calcMa(cfg.maType1, cfg.maLen1);
  const ma2 = calcMa(cfg.maType2, cfg.maLen2);
  const distanza = ma1.map((v, i) => v - ma2[i]);
  const distS = S(distanza);

  const atr = A(ta.atr(bars, cfg.atrLen));
  const rsi = A(ta.rsi(close, cfg.rsiLen));
  const B = (s: Series) => s.toArray().map((v) => v === 1);
  const distFalling2 = B(ta.falling(distS, 2));
  const distRising2 = B(ta.rising(distS, 2));
  const goldenCross = B(ta.crossover(S(ma1), S(ma2)));
  const deathCross = B(ta.crossunder(S(ma1), S(ma2)));

  // Bollinger ribbon anchors
  const basis = A(ta.sma(close, cfg.bbLen));
  const dev = A(ta.stdev(close, cfg.bbLen)).map((v) => cfg.bbMult * v);
  const bbUpper = basis.map((v, i) => v + dev[i]);
  const bbLower = basis.map((v, i) => v - dev[i]);
  const laneFrac = 0.32;
  const ribShortTop = bbUpper;
  const ribShortBot = bbUpper.map((v, i) => v - (v - basis[i]) * laneFrac);
  const ribLongBot = bbLower;
  const ribLongTop = bbLower.map((v, i) => v + (basis[i] - v) * laneFrac);

  const colLong: string[] = new Array(n);
  const colShort: string[] = new Array(n);
  const markers: MarkerData[] = [];
  const t = cfg.treshold;

  let longAttivo = false;
  let shortAttivo = false;
  let massimoLocaleLong = NaN;
  let minimoLocaleShort = NaN;
  for (let i = 0; i < n; i++) {
    const d = distanza[i];
    if (goldenCross[i]) {
      longAttivo = true;
      shortAttivo = false;
      massimoLocaleLong = d;
    }
    if (deathCross[i]) {
      shortAttivo = true;
      longAttivo = false;
      minimoLocaleShort = d;
    }
    // Pine math.max / math.min: na when an argument is na
    if (longAttivo) massimoLocaleLong = Math.max(nz(massimoLocaleLong, d), d);
    if (shortAttivo) minimoLocaleShort = Math.min(nz(minimoLocaleShort, d), d);
    if (longAttivo && distFalling2[i]) longAttivo = false;
    if (shortAttivo && distRising2[i]) shortAttivo = false;

    const coolingLong = !longAttivo && distFalling2[i];
    const coolingShort = !shortAttivo && distRising2[i];
    const canReactivateLong = !longAttivo && gt(d, nz(massimoLocaleLong, d) + t) && distRising2[i];
    const canReactivateShort = !shortAttivo && lt(d, nz(minimoLocaleShort, d) - t) && distFalling2[i];
    let justReactLong = false;
    let justReactShort = false;
    if (canReactivateLong) {
      longAttivo = true;
      justReactLong = true;
    }
    if (canReactivateShort) {
      shortAttivo = true;
      justReactShort = true;
    }

    // Strength
    const atrVal = atr[i];
    let distNorm = 0.0;
    if (gt(atrVal, 0.0)) distNorm = clamp01(Math.abs(d) / atrVal);
    const rsiLong = clamp01((50.0 - rsi[i]) / 20.0);
    const rsiShort = clamp01((rsi[i] - 50.0) / 20.0);
    const baseLong = clamp01(0.65 * distNorm + 0.35 * rsiLong);
    const baseShort = clamp01(0.65 * distNorm + 0.35 * rsiShort);
    let reactEdgeLong = 0.0;
    let reactEdgeShort = 0.0;
    if (gt(atrVal, 0.0)) {
      reactEdgeLong = clamp01((d - (nz(massimoLocaleLong, d) + t)) / atrVal);
      reactEdgeShort = clamp01((nz(minimoLocaleShort, d) - t - d) / atrVal);
    }
    const reactLong = clamp01(0.55 * reactEdgeLong + 0.45 * rsiLong);
    const reactShort = clamp01(0.55 * reactEdgeShort + 0.45 * rsiShort);

    let sLong = NaN;
    let sShort = NaN;
    if (justReactLong) sLong = reactLong;
    else if (longAttivo) sLong = baseLong;
    else if (coolingLong) sLong = 0.35 * baseLong;
    if (justReactShort) sShort = reactShort;
    else if (shortAttivo) sShort = baseShort;
    else if (coolingShort) sShort = 0.35 * baseShort;

    // Colours
    const hueLong = color.from_gradient(nz(sLong, 0.0), 0.0, 1.0, C_AQUA_LO, C_AQUA_HI);
    const hueShort = color.from_gradient(nz(sShort, 0.0), 0.0, 1.0, C_TIT_LO, C_TIT_HI);
    const aLong = alphaFromStrength(sLong, coolingLong && !longAttivo && !justReactLong);
    const aShort = alphaFromStrength(sShort, coolingShort && !shortAttivo && !justReactShort);
    colLong[i] = cfg.showRibbon && !isNaN(sLong) ? String(color.new(hueLong, aLong)) : 'transparent';
    colShort[i] = cfg.showRibbon && !isNaN(sShort) ? String(color.new(hueShort, aShort)) : 'transparent';

    // Cross dots
    if (goldenCross[i]) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'circle', color: COL_GOLDEN, size: 'tiny' });
    }
    if (deathCross[i]) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'circle', color: COL_DEATH, size: 'tiny' });
    }
  }

  const P = (vals: number[], show: boolean, c?: string) => bars.map((b, i) => {
    const v = show ? vals[i] : NaN;
    return c === undefined
      ? { time: b.time, value: Number.isFinite(v) ? v : NaN }
      : { time: b.time, value: Number.isFinite(v) ? v : NaN, color: c };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: P(ribShortTop, cfg.showRibbon),
      plot1: P(ribShortBot, cfg.showRibbon),
      plot2: P(ribLongBot, cfg.showRibbon),
      plot3: P(ribLongTop, cfg.showRibbon),
      plot4: P(bbUpper, cfg.showBBLines, COL_EDGE),
      plot5: P(bbLower, cfg.showBBLines, COL_EDGE),
      plot6: P(basis, cfg.showBasis, COL_BASIS),
      plot7: P(ma1, cfg.showGlow, COL_GLOW1),
      plot8: P(ma2, cfg.showGlow, COL_GLOW2),
      plot9: P(ma1, true, COL_MA1),
      plot10: P(ma2, true, COL_MA2),
    },
    fills: [
      { plot1: 'plot0', plot2: 'plot1', colors: colShort, options: { title: 'BB Upper Ribbon (SHORT)' } },
      { plot1: 'plot3', plot2: 'plot2', colors: colLong, options: { title: 'BB Lower Ribbon (LONG)' } },
    ],
    markers,
  };
}

export const GoldenDeathCrossWithReActivation = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
