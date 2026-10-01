/**
 * ADX-vALMA (N)
 *
 * ADX and DI lines smoothed with a volume-weighted ALMA (vALMA = alma(x * volume) / alma(volume), volume 1 when
 * missing). The +DM, -DM and true range are smoothed with vALMA ("Fast") or RMA ("Standard"); DI+ / DI- are the
 * smoothed DMs over the smoothed true range (x 100) and the ADX is the vALMA of DX. In "Normalized ADX" mode the ADX
 * is scaled to 0..100 between its lowest and highest values over the normalization lookback. The ADX is green when
 * it is not falling and red when it falls; the area between DI+ and DI- is green when DI+ is above. Triangles on the
 * price chart mark the DI crosses, shifted by the signal visual offset.
 *
 * Reference: "ADX-vALMA (N)" by Zomzi
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { barInterval, barTime } from '../bar-time';

export interface ADXvALMAInputs {
  /** Lookback of the ADX and DI smoothing */
  len: number;
  /** ALMA offset (0..1) */
  offsetValma: number;
  /** ALMA sigma */
  sigma: number;
  /** Trend threshold line */
  th: number;
  /** Smoothing of +DM, -DM and true range: 'Fast' (vALMA) or 'Standard' (RMA) */
  smoothingMode: 'Fast' | 'Standard';
  /** Show the DI cross triangles on the price chart */
  showSignals: boolean;
  /** Bar shift of the signal triangles (negative: to the left) */
  visualOffset: number;
  adxMode: 'Standard ADX' | 'Normalized ADX';
  /** Lookback of the normalization (lowest / highest ADX) */
  normLen: number;
}

export const defaultInputs: ADXvALMAInputs = {
  len: 14,
  offsetValma: 0.7,
  sigma: 4.0,
  th: 22.5,
  smoothingMode: 'Fast',
  showSignals: true,
  visualOffset: -1,
  adxMode: 'Normalized ADX',
  normLen: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Length', defval: 14, min: 1 },
  { id: 'offsetValma', type: 'float', title: 'ALMA Offset', defval: 0.7, step: 0.025 },
  { id: 'sigma', type: 'float', title: 'ALMA Sigma', defval: 4.0, step: 0.25 },
  { id: 'th', type: 'float', title: 'Trend Threshold', defval: 22.5 },
  { id: 'smoothingMode', type: 'string', title: 'DI Smoothing Mode', defval: 'Fast', options: ['Fast', 'Standard'] },
  { id: 'showSignals', type: 'bool', title: 'Show Signals on Main Chart', defval: true },
  { id: 'visualOffset', type: 'int', title: 'Signal Visual Offset', defval: -1, min: -10, max: 10 },
  { id: 'adxMode', type: 'string', title: 'ADX Mode', defval: 'Normalized ADX', options: ['Standard ADX', 'Normalized ADX'] },
  { id: 'normLen', type: 'int', title: 'Normalization Lookback', defval: 50, min: 1 },
];

const DI_PLUS_COL = color.rgb(4, 117, 0);
const DI_MINUS_COL = '#7e0000';
const ADX_UP = '#00ff15';
const ADX_DOWN = '#ff0000';
const FILL_UP = String(color.new('#00ff08', 90));
const FILL_DOWN = String(color.new('#ff0000', 90));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'DI+', color: DI_PLUS_COL, lineWidth: 1 },
  { id: 'plot1', title: 'DI-', color: DI_MINUS_COL, lineWidth: 1 },
  { id: 'plot2', title: 'ADX Final', color: ADX_UP, lineWidth: 2 },
];

export const metadata = {
  title: 'ADX-vALMA (N)',
  shortTitle: 'ADX-vALMA (N)',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
/** Division: a 0 denominator here has a 0 numerator (0 / 0 is NaN in Pine too) or is kept >= 1e-10 by math.max */
const div = (x: number, y: number) => (y === 0 ? NaN : x / y);
/** Pine math.max: na when an argument is na */
const max = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.max(a, b));

export function calculate(
  bars: Bar[],
  inputs: Partial<ADXvALMAInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const { len, offsetValma: off, sigma: sig } = cfg;

  // valma(src) = ta.alma(src * vol, len, off, sig) / ta.alma(vol, len, off, sig), vol = nz(volume, 1)
  const vol = bars.map((b) => (b.volume === undefined || b.volume === null || isNaN(b.volume) ? 1 : b.volume));
  const almaVol = A(ta.alma(S(vol), len, off, sig));
  const valma = (src: number[]) => {
    const num = A(ta.alma(S(src.map((x, i) => x * vol[i])), len, off, sig));
    return num.map((x, i) => div(x, almaVol[i]));
  };

  // DM and true range
  const plusDM: number[] = new Array(n);
  const minusDM: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const up = i > 0 ? bars[i].high - bars[i - 1].high : NaN;
    const down = i > 0 ? -(bars[i].low - bars[i - 1].low) : NaN;
    plusDM[i] = isNaN(up) ? NaN : gt(up, down) && gt(up, 0) ? up : 0;
    minusDM[i] = isNaN(down) ? NaN : gt(down, up) && gt(down, 0) ? down : 0;
  }
  const tr = A(ta.tr(bars, true));
  const smooth = (x: number[]) => (cfg.smoothingMode === 'Fast' ? valma(x) : A(ta.rma(S(x), len)));
  const sPlus = smooth(plusDM);
  const sMinus = smooth(minusDM);
  const sTR = smooth(tr);

  const diPlus = sPlus.map((x, i) => div(x, sTR[i]) * 100);
  const diMinus = sMinus.map((x, i) => div(x, sTR[i]) * 100);
  const dx = diPlus.map((p, i) => div(Math.abs(p - diMinus[i]), max(p + diMinus[i], 1e-10)) * 100);
  const adxRaw = valma(dx);
  let adxFinal = adxRaw;
  if (cfg.adxMode === 'Normalized ADX') {
    // normalize(src, length) = 100 * (src - ta.lowest(src, length)) / math.max(highest - lowest, 1e-10)
    const lo = A(ta.lowest(S(adxRaw), cfg.normLen));
    const hi = A(ta.highest(S(adxRaw), cfg.normLen));
    adxFinal = adxRaw.map((x, i) => div(100 * (x - lo[i]), max(hi[i] - lo[i], 1e-10)));
  }

  const markers: MarkerData[] = [];
  if (cfg.showSignals) {
    const interval = barInterval(bars);
    for (let i = 1; i < n; i++) {
      // plotshape(..., offset = visualOffset, force_overlay = true): the signal of bar i is drawn on bar i + offset
      const j = i + cfg.visualOffset;
      if (j < 0) continue;
      const t = barTime(bars, j, interval);
      // ta.crossover(diPlus, diMinus) (exact comparisons, no tolerance): triangle up below the bar, color.green,
      // size.small
      if (diPlus[i] > diMinus[i] && diPlus[i - 1] <= diMinus[i - 1]) {
        markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'small', forceOverlay: true });
      }
      // ta.crossunder(diPlus, diMinus) (exact comparisons): triangle down above the bar, color.red, size.small
      if (diPlus[i] < diMinus[i] && diPlus[i - 1] >= diMinus[i - 1]) {
        markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'small', forceOverlay: true });
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: diPlus[i], color: DI_PLUS_COL })),
      plot1: bars.map((b, i) => ({ time: b.time, value: diMinus[i], color: DI_MINUS_COL })),
      // kolorADX = adx_final >= adx_final[1] ? #00ff15 : #ff0000
      plot2: bars.map((b, i) => ({
        time: b.time, value: adxFinal[i], color: i > 0 && ge(adxFinal[i], adxFinal[i - 1]) ? ADX_UP : ADX_DOWN,
      })),
    },
    hlines: [
      { value: cfg.th, options: { title: 'Threshold Line', color: String(color.new(color.gray, 50)), linestyle: 'dashed' } },
      { value: 100, options: { title: 'Upper Bound', color: String(color.new(color.red, 80)), linestyle: 'dashed' } },
      { value: 0, options: { title: 'Lower Bound', color: String(color.new(color.green, 80)), linestyle: 'dashed' } },
    ],
    // fill(plotPlus, plotMinus, color = diPlus > diMinus ? color.new(#00ff08, 90) : color.new(#ff0000, 90))
    fills: [
      { plot1: 'plot0', plot2: 'plot1', colors: diPlus.map((p, i) => (gt(p, diMinus[i]) ? FILL_UP : FILL_DOWN)) },
    ],
    markers,
  };
}

export const ADXvALMA = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
