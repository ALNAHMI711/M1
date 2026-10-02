/**
 * Weierstrass Function (Fractal Cycles)
 *
 * A Weierstrass function of the bar index: osc = sum over n = 0 .. terms - 1 of
 * a^n * cos(b^n * bar_index * pi * scale), multiplied by -1 when "Invert" is on. The line is blue when it rises
 * from the previous bar, else yellow. The value depends only on the bar index (counted from the first bar given).
 *
 * Reference: "Weierstrass Function (Fractal Cycles)" by fract
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface WeierstrassFunctionInputs {
  /** Multiply the oscillator by -1 */
  invert: boolean;
  /** Amplitude factor a (weight a^n of term n) */
  amplitude: number;
  /** Frequency factor b (frequency b^n of term n) */
  frequency: number;
  /** Scale of the bar index */
  scaleFactor: number;
  /** Number of terms of the sum */
  terms: number;
}

export const defaultInputs: WeierstrassFunctionInputs = {
  invert: true,
  amplitude: 0.5,
  frequency: 3,
  scaleFactor: 0.0001,
  terms: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'invert', type: 'bool', title: 'Invert', defval: true },
  { id: 'amplitude', type: 'float', title: 'Amplitude Factor', defval: 0.5, min: 0.01, max: 1, step: 0.05 },
  { id: 'frequency', type: 'int', title: 'Frequency Factor', defval: 3, min: 1 },
  { id: 'scaleFactor', type: 'float', title: 'Scale Factor', defval: 0.0001, min: 0.0001, max: 1.0, step: 0.0001 },
  { id: 'terms', type: 'int', title: 'Number of Terms', defval: 20, min: 1, max: 50 },
];

const UP_COLOR = '#00c3ff';
const DOWN_COLOR = '#fbc02d';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fractal Oscillator', color: UP_COLOR, lineWidth: 2 },
];

export const metadata = {
  title: 'Weierstrass Function',
  shortTitle: 'Fractal Cycles',
  overlay: false,
};

/** Pine float comparison: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(bars: Bar[], inputs: Partial<WeierstrassFunctionInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const { amplitude: a, frequency: b, scaleFactor, terms } = cfg;
  const sign = cfg.invert ? -1 : 1;

  const osc = bars.map((_bar, indx) => {
    let fractalOsc = 0.0;
    // for n = 0 to n_terms - 1: fractal_osc += math.pow(a, n) * math.cos(math.pow(b, n) * indx * math.pi * scale_factor)
    // (n_terms >= 1, so the loop never counts down)
    for (let n = 0; n <= terms - 1; n++) {
      fractalOsc += Math.pow(a, n) * Math.cos(Math.pow(b, n) * indx * Math.PI * scaleFactor);
    }
    return fractalOsc * sign;
  });

  // color = ta.change(fractal_osc) > 0 ? #00c3ff : #fbc02d
  const plot0 = bars.map((bar, i) => ({
    time: bar.time,
    value: osc[i],
    color: i > 0 && gt(osc[i] - osc[i - 1], 0) ? UP_COLOR : DOWN_COLOR,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
  };
}

export const WeierstrassFunction = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
