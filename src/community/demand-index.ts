/**
 * Demand Index (Sibbet)
 *
 * HL2C = high + low + 2 * close. The volume is normalised by its EMA (Buy/Sell Power Length). On a falling HL2C the
 * buy power is volNorm / exp(0.375 * (HL2C + HL2C[1]) / |H0 - L0| * (HL2C[1] - HL2C) / HL2C), on a rising HL2C the
 * sell power is volNorm / exp(0.375 * (HL2C + HL2C[1]) / |H0 - L0| * (HL2C - HL2C[1]) / HL2C[1]) (H0 / L0: high
 * and low of the first bar); otherwise each power is volNorm. Both powers are smoothed by an EMA. Q is the smaller
 * power divided by the larger one, and the Demand Index is 100 * (1 - Q) when the buy power is the larger one, else
 * 100 * (Q - 1): green at or above 0, red below, with an SMA line.
 *
 * Reference: "Demand Index (James Sibbet)" by conair
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface DemandIndexInputs {
  /** EMA length of the volume normalisation */
  bsLength: number;
  /** EMA length of the buy / sell powers */
  bsSmooth: number;
  /** SMA length of the Demand Index */
  diSmaLength: number;
  /** Show the SMA line */
  showDiSma: boolean;
}

export const defaultInputs: DemandIndexInputs = {
  bsLength: 10,
  bsSmooth: 10,
  diSmaLength: 10,
  showDiSma: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'bsLength', type: 'int', title: 'Buy/Sell Power Length (EMA)', defval: 10, min: 1 },
  { id: 'bsSmooth', type: 'int', title: 'Smooth Buy/Sell Power (EMA)', defval: 10, min: 1 },
  { id: 'diSmaLength', type: 'int', title: 'Smooth Demand Index (SMA)', defval: 10, min: 1 },
  { id: 'showDiSma', type: 'bool', title: 'Show DI SMA', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Zero Line', color: String(color.new(color.gray, 70)), lineWidth: 1 },
  { id: 'plot1', title: 'Demand Index', color: color.green, lineWidth: 2 },
  { id: 'plot2', title: 'DI SMA', color: color.white, lineWidth: 1 },
];

export const metadata = {
  title: 'Demand Index (Sibbet)',
  shortTitle: 'Demand Index (Sibbet)',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
/** Pine math.max: na when an argument is na */
const max = (a: number, b: number) => Math.max(a, b);

export function calculate(bars: Bar[], inputs: Partial<DemandIndexInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  // HL2C per Sibbet: H + L + 2C
  const hl2c = bars.map((b) => b.high + b.low + 2.0 * b.close);
  // var H0 / L0: high / low of the first bar
  const H0 = n > 0 ? bars[0].high : NaN;
  const L0 = n > 0 ? bars[0].low : NaN;
  const denHL0 = max(Math.abs(H0 - L0), EPS);

  const volume = bars.map((b) => b.volume ?? NaN);
  const emaVol = A(ta.ema(S(volume), cfg.bsLength));

  const bpRaw: number[] = new Array(n);
  const spRaw: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const volNorm = volume[i] / max(emaVol[i], EPS);
    const cur = hl2c[i];
    // hl2cPrev = nz(hl2c[1], hl2c)
    const prev = i > 0 && !isNaN(hl2c[i - 1]) ? hl2c[i - 1] : cur;
    const bpExpArg = 0.375 * ((cur + prev) / denHL0) * ((prev - cur) / max(cur, EPS));
    const spExpArg = 0.375 * ((cur + prev) / denHL0) * ((cur - prev) / max(prev, EPS));
    bpRaw[i] = lt(cur, prev) ? volNorm / Math.exp(bpExpArg) : volNorm;
    spRaw[i] = gt(cur, prev) ? volNorm / Math.exp(spExpArg) : volNorm;
  }

  const bp = A(ta.ema(S(bpRaw), cfg.bsSmooth));
  const sp = A(ta.ema(S(spRaw), cfg.bsSmooth));

  const di: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const greaterBP = gt(bp[i], sp[i]);
    const equalBP = le(Math.abs(bp[i] - sp[i]), EPS);
    const q = greaterBP ? sp[i] / max(bp[i], EPS) : equalBP ? 1.0 : bp[i] / max(sp[i], EPS);
    const d = le(sp[i], bp[i]) ? 100.0 * (1.0 - q) : 100.0 * (q - 1.0);
    di[i] = Number.isFinite(d) ? d : NaN;
  }
  const diSma = A(ta.sma(S(di), cfg.diSmaLength));

  const zeroColor = String(color.new(color.gray, 70));
  const up = String(color.new(color.green, 0));
  const down = String(color.new(color.red, 0));
  const white = String(color.new(color.white, 0));
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b) => ({ time: b.time, value: 0, color: zeroColor })),
      // color = di >= 0 ? green : red
      plot1: bars.map((b, i) => ({ time: b.time, value: di[i], color: ge(di[i], 0) ? up : down })),
      plot2: bars.map((b, i) => ({ time: b.time, value: cfg.showDiSma ? fin(diSma[i]) : NaN, color: white })),
    },
  };
}

export const DemandIndex = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
