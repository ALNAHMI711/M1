/**
 * [Pandora] Laguerre Ultimate Explorations Multicator (LUEM)
 *
 * Each filter is an Ehlers Ultimate Smoother of the source (period P), then a modified four-stage Laguerre low-pass
 * of the smoother with the lag factor; the Laguerre mode picks the binomial weights of the output (mode 0 = the
 * smoother itself, mode 4 = Ehlers' original weights). The oscillator in the pane is the difference between the
 * smoother and a Laguerre-style one-pole filter of it, divided by the RMS of that difference over `periodRMS` bars.
 * On the price pane: a ribbon of the Laguerre filters with periods 2 to 59, the Ultimate Smoother and the Laguerre
 * filter of the main period.
 *
 * The fourth Laguerre stage uses lerp1[1] (not lerp3[1]) in its difference term, as the Pine script.
 *
 * Reference: "[Pandora] Laguerre Ultimate Explorations Multicator" by ImmortalFreedom
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Use and reuse of this code is governed by the terms of the Attribution-NonCommercial-ShareAlike
 * 4.0 International License. https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode.txt
 */

import { ta, math, Series, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface LaguerreUltimateExplorationsMulticatorInputs {
  /** Source series */
  source: SourceType;
  /** Laguerre period of the main filter */
  period: number;
  /** Laguerre lag factor */
  lag: number;
  /** Laguerre mode (0 to 4): weights of the Laguerre output */
  laguerreMode: number;
  /** RMS period of the oscillator */
  periodRMS: number;
}

export const defaultInputs: LaguerreUltimateExplorationsMulticatorInputs = {
  source: 'close',
  period: 20.0,
  lag: 0.5,
  laguerreMode: 3,
  periodRMS: 100,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source Series', defval: 'close' },
  { id: 'period', type: 'float', title: 'Laguerre Period', defval: 20.0, min: 1.0, step: 2.0, group: 'Laguerre options' },
  { id: 'lag', type: 'float', title: 'Laguerre Lag', defval: 0.5, min: -0.5, max: 0.95, step: 0.05, group: 'Laguerre options' },
  { id: 'laguerreMode', type: 'int', title: 'Laguerre Mode', defval: 3, min: 0, max: 4, step: 1, tooltip: 'This option determines the lag mode', group: 'Laguerre options' },
  { id: 'periodRMS', type: 'int', title: 'RMS Period', defval: 100, min: 5, step: 5, group: 'Oscillator Only Option' },
];

const RIBBON_COL = '#8080FF';
const RIBBON_PERIODS = Array.from({ length: 58 }, (_v, k) => k + 2); // 2 .. 59

// display = display.all - display.status_line - display.price_scale on the price pane plots (drawn in the pane)
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Laguerre Oscillator', color: RIBBON_COL, lineWidth: 1 },
  ...RIBBON_PERIODS.map((p, k): PlotConfig => (
    { id: `plot${k + 1}`, title: `Laguerre ${p}`, color: RIBBON_COL, lineWidth: 1, forceOverlay: true })),
  { id: 'plot59', title: 'Ultimate Smoother', color: '#FFCC00', lineWidth: 1, forceOverlay: true },
  { id: 'plot60', title: 'Laguerre Filter', color: '#990099', lineWidth: 2, forceOverlay: true },
];

export const metadata = {
  title: '[Pandora] Laguerre Ultimate Explorations Multicator',
  shortTitle: 'LUEM',
  overlay: false,
};

const nz = (x: number, y = 0) => (isNaN(x) ? y : x);

/** laguerreMulti(Series, Period, Lag, LaguerreMode): [ultis, lagFilt, filt] per bar (one call site) */
function laguerreMulti(src: number[], period: number, lag: number, mode: number) {
  const n = src.length;
  const SQRT2 = math.sqrt(2.0) as number;
  const omega = (Math.PI * SQRT2) / Math.max(1, period);
  const alpha = math.exp(-omega) as number;
  const coef1 = (math.cos(omega) as number) * 2.0 * alpha;
  const coef2 = math.pow(alpha, 2) as number;
  const coef0 = (1.0 + coef1 + coef2) * 0.25;
  const ultis: number[] = new Array(n);
  const lerp1: number[] = new Array(n);
  const lerp2: number[] = new Array(n);
  const lerp3: number[] = new Array(n);
  const lerp4: number[] = new Array(n);
  const lagFilt: number[] = new Array(n);
  const filt: number[] = new Array(n);
  const at = (a: number[], i: number) => (i >= 0 ? a[i] : NaN);
  for (let i = 0; i < n; i++) {
    const s = src[i];
    const s1 = at(src, i - 1);
    const s2 = at(src, i - 2);
    const u1 = at(ultis, i - 1);
    const u2 = at(ultis, i - 2);
    const u = (1.0 - coef0) * s
      + (2.0 * coef0 - coef1) * nz(s1, s)
      - (coef0 - coef2) * nz(s2, nz(s1, s))
      + coef1 * nz(u1, s)
      - coef2 * nz(u2, nz(u1, s));
    ultis[i] = u;
    // Modified Laguerre low-pass filter
    const l1p = at(lerp1, i - 1);
    const l2p = at(lerp2, i - 1);
    const l3p = at(lerp3, i - 1);
    const l4p = at(lerp4, i - 1);
    const l1 = nz(u1, u) + lag * (nz(l1p, u) - nz(u1, u));
    const l2 = nz(l1p, l1) + lag * (nz(l2p, l1) - nz(l1p, l1));
    const l3 = nz(l2p, l2) + lag * (nz(l3p, l2) - nz(l2p, l2));
    const l4 = nz(l3p, l3) + lag * (nz(l4p, l3) - nz(l1p, l1));
    lerp1[i] = l1;
    lerp2[i] = l2;
    lerp3[i] = l3;
    lerp4[i] = l4;
    lagFilt[i] = mode === 4 ? 0.0625 * (u + l1 * 4.0 + l2 * 6.0 + l3 * 4.0 + l4)
      : mode === 3 ? 0.125 * (u + l1 * 3.0 + l2 * 3.0 + l3)
        : mode === 2 ? 0.25 * (u + l1 * 2.0 + l2)
          : mode === 1 ? 0.5 * (u + l1)
            : u;
    // Laguerre oscillator filter: filt := -Lag * ultis + nz(ultis[1]) + Lag * nz(filt[1])
    filt[i] = -lag * u + nz(u1) + lag * nz(at(filt, i - 1));
  }
  return { ultis, lagFilt, filt };
}

export function calculate(
  bars: Bar[],
  inputs: Partial<LaguerreUltimateExplorationsMulticatorInputs> = {},
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const src = A(getSourceSeries(bars, cfg.source));

  const main = laguerreMulti(src, cfg.period, cfg.lag, cfg.laguerreMode);
  // RMS = math.sqrt(ta.sma(math.pow(ultis - filt, 2), RMSperiod)); lOsc = math.sign(RMS) == 0 ? 0 : (ultis - filt) / RMS
  const diff = main.ultis.map((u, i) => u - main.filt[i]);
  const ms = A(ta.sma(Series.fromArray(bars, diff.map((d) => math.pow(d, 2) as number)), cfg.periodRMS));
  const osc = diff.map((d, i) => {
    const rms = math.sqrt(ms[i]) as number;
    const v = (math.sign(rms) as number) === 0 ? 0.0 : d / rms;
    return Number.isFinite(v) ? v : NaN;
  });

  const line = (vals: number[]) => bars.map((b, i) => ({ time: b.time as number, value: Number.isFinite(vals[i]) ? vals[i] : NaN }));
  const plots: Record<string, { time: number; value: number }[]> = { plot0: line(osc) };
  RIBBON_PERIODS.forEach((p, k) => {
    plots[`plot${k + 1}`] = line(laguerreMulti(src, p, cfg.lag, cfg.laguerreMode).lagFilt);
  });
  plots.plot59 = line(main.ultis);
  plots.plot60 = line(main.lagFilt);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    hlines: [
      { value: 1.0, options: { title: 'Upper Level', color: '#FF000080', linestyle: 'dotted' } },
      { value: 0.0, options: { title: 'Zero Level', color: '#EEEEEE', linestyle: 'dashed' } },
      { value: -1.0, options: { title: 'Lower Level', color: '#00FF0080', linestyle: 'dotted' } },
    ],
  };
}

export const LaguerreUltimateExplorationsMulticator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
