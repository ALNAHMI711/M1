/**
 * TradingMoja / SQZMOM ADX
 *
 * Squeeze momentum with ADX in one pane. Bands: SMA of the close +- KC multiplier * standard deviation (the script
 * uses the KC multiplier for the bands, the BB multiplier input is not used); Keltner channel: SMA of the close
 * +- KC multiplier * SMA of the true range (or of high - low). The squeeze is on when the bands are inside the
 * channel, off when they are outside it. The momentum is the linear regression of close minus the average of the
 * channel midpoint (highest high + lowest low) / 2 and the SMA of the close; its colour comes from the raw value
 * (lime / green above 0, red / maroon below 0, by its change). The histogram is scaled so that the highest absolute
 * value of the last `scale_lookback` bars has the target height (scale 1 while that maximum is na or 0). Squeeze
 * dots on the zero line (blue no squeeze, black squeeze on, gray squeeze off), the ADX line, optional DI+ / DI-
 * lines and a dashed ADX threshold line.
 *
 * Reference: "TradingMoja / SQZMOM ADX " by Trading_Moja
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface TradingmojaSqzmomAdxInputs {
  /** BB length */
  sqzLengthBB: number;
  /** BB multiplier (not used by the Pine script) */
  sqzMultBB: number;
  /** KC length */
  sqzLengthKC: number;
  /** KC multiplier (also used for the bands) */
  sqzMultKC: number;
  /** Use the true range for the Keltner channel */
  sqzUseTR: boolean;
  adxLen: number;
  adxTh: number;
  /** Show the DI+ / DI- lines */
  showDi: boolean;
  /** Lookback of the auto-scaling */
  scaleLookback: number;
  /** Target height of the squeeze histogram */
  scaleTarget: number;
}

export const defaultInputs: TradingmojaSqzmomAdxInputs = {
  sqzLengthBB: 20,
  sqzMultBB: 2.0,
  sqzLengthKC: 20,
  sqzMultKC: 1.5,
  sqzUseTR: true,
  adxLen: 14,
  adxTh: 20,
  showDi: false,
  scaleLookback: 200,
  scaleTarget: 45,
};

export const inputConfig: InputConfig[] = [
  { id: 'sqzLengthBB', type: 'int', title: 'BB Length', defval: 20 },
  { id: 'sqzMultBB', type: 'float', title: 'BB MultFactor', defval: 2.0 },
  { id: 'sqzLengthKC', type: 'int', title: 'KC Length', defval: 20 },
  { id: 'sqzMultKC', type: 'float', title: 'KC MultFactor', defval: 1.5 },
  { id: 'sqzUseTR', type: 'bool', title: 'Use TrueRange (KC)', defval: true },
  { id: 'adxLen', type: 'int', title: 'ADX Length', defval: 14 },
  { id: 'adxTh', type: 'int', title: 'ADX Threshold', defval: 20 },
  { id: 'showDi', type: 'bool', title: 'Mostrar lineas DI+ / DI-', defval: false },
  { id: 'scaleLookback', type: 'int', title: 'Periodo Auto-Escala', defval: 200 },
  { id: 'scaleTarget', type: 'int', title: 'Altura Objetivo Squeeze', defval: 45 },
];

const C_LIME = color.rgb(0, 255, 0);
const C_GREEN = color.rgb(0, 128, 0);
const C_RED = color.rgb(255, 0, 0);
const C_MAROON = color.rgb(128, 0, 0);
const DI_PLUS_COLOR = String(color.new(C_LIME, 30));
const DI_MINUS_COLOR = String(color.new(C_RED, 30));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Squeeze Momentum', color: C_LIME, lineWidth: 4, style: 'histogram' },
  { id: 'plot1', title: 'Squeeze Dots', color: color.blue, lineWidth: 2, style: 'cross' },
  { id: 'plot2', title: 'ADX', color: color.white, lineWidth: 2 },
  { id: 'plot3', title: 'DI+', color: DI_PLUS_COLOR, lineWidth: 1 },
  { id: 'plot4', title: 'DI-', color: DI_MINUS_COLOR, lineWidth: 1 },
];

export const metadata = {
  title: 'TradingMoja / SQZMOM ADX ',
  shortTitle: 'TradingMoja',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const nz = (v: number) => (Number.isFinite(v) ? v : 0);

export function calculate(bars: Bar[], inputs: Partial<TradingmojaSqzmomAdxInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const closeArr = bars.map((b) => b.close);
  const close = S(closeArr);

  // Bands: basis +- sqz_multKC * stdev (the Pine script uses the KC multiplier here)
  const basis = A(ta.sma(close, cfg.sqzLengthBB));
  const sd = A(ta.stdev(close, cfg.sqzLengthBB));
  const ma = A(ta.sma(close, cfg.sqzLengthKC));
  const rangeVal = cfg.sqzUseTR ? A(ta.tr(bars)) : bars.map((b) => b.high - b.low);
  const rangeMa = A(ta.sma(S(rangeVal), cfg.sqzLengthKC));

  const hh = A(ta.highest(S(bars.map((b) => b.high)), cfg.sqzLengthKC));
  const ll = A(ta.lowest(S(bars.map((b) => b.low)), cfg.sqzLengthKC));
  const smaKC = A(ta.sma(close, cfg.sqzLengthKC));
  const x = closeArr.map((c, i) => c - ((hh[i] + ll[i]) / 2 + smaKC[i]) / 2);
  const valRaw = A(ta.linreg(S(x), cfg.sqzLengthKC, 0));

  // max_val_recent = ta.highest(math.abs(val_raw), scale_lookback)
  const maxRecent = A(ta.highest(S(valRaw.map((v) => Math.abs(v))), cfg.scaleLookback));
  const [diPlus, diMinus, adx] = ta.dmi(bars, cfg.adxLen, cfg.adxLen).map(A);

  const plot0 = [];
  const plot1 = [];
  for (let i = 0; i < bars.length; i++) {
    const t = bars[i].time;
    const dev = cfg.sqzMultKC * sd[i];
    const upperBB = basis[i] + dev;
    const lowerBB = basis[i] - dev;
    const upperKC = ma[i] + rangeMa[i] * cfg.sqzMultKC;
    const lowerKC = ma[i] - rangeMa[i] * cfg.sqzMultKC;
    const sqzOn = gt(lowerBB, lowerKC) && lt(upperBB, upperKC);
    const sqzOff = lt(lowerBB, lowerKC) && gt(upperBB, upperKC);
    const noSqz = !sqzOn && !sqzOff;

    const v = valRaw[i];
    const prev = nz(i > 0 ? valRaw[i - 1] : NaN);
    const bcolor = gt(v, 0) ? (gt(v, prev) ? C_LIME : C_GREEN) : (lt(v, prev) ? C_RED : C_MAROON);
    const scolor = noSqz ? color.blue : sqzOn ? color.black : color.gray;

    // scaler = max_val_recent != 0 ? scale_target / max_val_recent : 1 (na != 0 is false: 1)
    const m = maxRecent[i];
    const scaler = Number.isFinite(m) && Math.abs(m) > EPS ? cfg.scaleTarget / m : 1;
    const plotted = v * scaler;
    plot0.push({ time: t, value: Number.isFinite(plotted) ? plotted : NaN, color: bcolor });
    plot1.push({ time: t, value: 0, color: scolor });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0,
      plot1,
      plot2: bars.map((b, i) => ({ time: b.time, value: adx[i], color: color.white })),
      plot3: bars.map((b, i) => ({ time: b.time, value: cfg.showDi ? diPlus[i] : NaN, color: DI_PLUS_COLOR })),
      plot4: bars.map((b, i) => ({ time: b.time, value: cfg.showDi ? diMinus[i] : NaN, color: DI_MINUS_COLOR })),
    },
    hlines: [
      { value: cfg.adxTh, options: { title: 'ADX Threshold', color: String(color.new(color.white, 70)), linestyle: 'dashed' } },
    ],
  };
}

export const TradingmojaSqzmomAdx = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
