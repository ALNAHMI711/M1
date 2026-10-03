/**
 * SMIIOL
 *
 * SMI Ergodic: the indicator is the true strength index of the close (ta.tsi with the short and long periods), the
 * signal is its EMA and the oscillator histogram is indicator - signal. A Buy triangle at the bottom of the pane marks
 * the bar after the indicator crosses over the lower band (-band line) when the HMA of the close is rising.
 * Horizontal lines at -band line and +band line.
 *
 * Reference: "SMIIOL" by iilter
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © iilter
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface SmiiolInputs {
  /** TSI short period */
  shortlength: number;
  /** TSI long period */
  longlength: number;
  /** Signal EMA period */
  signallength: number;
  /** HMA period */
  hmalength: number;
  /** Band line (+/-) */
  bandLine: number;
}

export const defaultInputs: SmiiolInputs = {
  shortlength: 5,
  longlength: 24,
  signallength: 5,
  hmalength: 18,
  bandLine: 0.35,
};

export const inputConfig: InputConfig[] = [
  { id: 'shortlength', type: 'int', title: 'Short Period', defval: 5 },
  { id: 'longlength', type: 'int', title: 'Long Period', defval: 24 },
  { id: 'signallength', type: 'int', title: 'Signal Line Period', defval: 5 },
  { id: 'hmalength', type: 'int', title: 'HMA Period', defval: 18 },
  { id: 'bandLine', type: 'float', title: 'Band Line (+/-)', defval: 0.35 },
];

const IND_COL = String(color.rgb(11, 230, 33));
const SIG_COL = String(color.rgb(236, 25, 25));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Indicator', color: IND_COL, lineWidth: 1 },
  { id: 'plot1', title: 'Signal', color: SIG_COL, lineWidth: 1 },
  { id: 'plot2', title: 'Oscillator', color: color.red, lineWidth: 1, style: 'histogram' },
];

export const metadata = {
  title: 'SMIIOL',
  shortTitle: 'SMIIOL',
  overlay: false,
};

/** Pine a > b: a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;

export function calculate(
  bars: Bar[],
  inputs: Partial<SmiiolInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const close = Series.fromArray(bars, bars.map((b) => b.close));

  // ergonic = ta.tsi(close, shortlength, longlength); signal = ta.ema(ergonic, signallength)
  const ergonicS = ta.tsi(close, cfg.shortlength, cfg.longlength);
  const ergonic = A(ergonicS);
  const signal = A(ta.ema(ergonicS, cfg.signallength));
  const oscillator = ergonic.map((e, i) => e - signal[i]);

  // ta.hma(close, 1) runs ta.wma(close, 0): a Pine runtime error
  if (Math.floor(cfg.hmalength / 2) < 1 && n > 0) {
    throw new Error("Error on bar 0: Invalid value of the 'length' argument (0.0) in the 'wma' function. It must be > 0.");
  }
  const hma = A(ta.hma(close, cfg.hmalength));
  // co97 = ta.crossover(ergonic, -bandLine)
  const co97 = A(ta.crossover(ergonicS, -cfg.bandLine));

  const markers: MarkerData[] = [];
  const buyCol = String(color.rgb(15, 231, 15));
  const buyText = String(color.rgb(227, 236, 229));
  for (let i = 1; i < n; i++) {
    // buy97 = co97[1] and (hma > hma[1])
    if (co97[i - 1] === 1 && gt(hma[i], hma[i - 1])) {
      markers.push({ time: bars[i].time, position: 'bottom', shape: 'triangleUp', color: buyCol, text: '',
        textColor: buyText, size: 'tiny' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: ergonic[i], color: IND_COL })),
      plot1: bars.map((b, i) => ({ time: b.time, value: signal[i], color: SIG_COL })),
      plot2: bars.map((b, i) => ({ time: b.time, value: oscillator[i], color: color.red })),
    },
    hlines: [
      { value: -cfg.bandLine, options: { title: 'SMIIOL Lower Band', color: '#e7350d', linestyle: 'dashed' } },
      { value: cfg.bandLine, options: { title: 'SMIIOL Upper Band', color: '#5cf10c', linestyle: 'dashed' } },
    ],
    markers,
  };
}

export const Smiiol = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
