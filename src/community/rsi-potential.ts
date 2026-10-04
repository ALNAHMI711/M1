/**
 * RSI Potential
 *
 * For a target RSI level, the close that would bring the RSI of the next bar to that level (inverse RSI with the
 * RMA averages of the up and down moves). Upside potential = distance in % from the close up to the overbought
 * price; downside potential = distance in % from the close down to the oversold price; net potential = upside -
 * downside, drawn as columns (green above zero, red otherwise).
 *
 * Reference: "RSI Potential" by nasu_is_gaji
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © nasu_is_gaji
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface RsiPotentialInputs {
  /** RSI length */
  rsiLength: number;
  /** Overbought RSI level */
  obLevel: number;
  /** Oversold RSI level */
  osLevel: number;
}

export const defaultInputs: RsiPotentialInputs = {
  rsiLength: 14,
  obLevel: 75,
  osLevel: 25,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'obLevel', type: 'int', title: 'Overbought Level', defval: 75 },
  { id: 'osLevel', type: 'int', title: 'Oversold Level', defval: 25 },
];

const NET_UP = String(color.new(color.green, 30));
const NET_DOWN = String(color.new(color.red, 30));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upside Potential', color: color.green, lineWidth: 1 },
  { id: 'plot1', title: 'Downside Potential', color: color.red, lineWidth: 1 },
  { id: 'plot2', title: 'Net Potential', color: NET_UP, lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'RSI Potential',
  shortTitle: 'RSI Potential',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(bars: Bar[], inputs: Partial<RsiPotentialInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const len = cfg.rsiLength;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const close = bars.map((b) => b.close);

  // up = math.max(close - close[1], 0), down = math.max(close[1] - close, 0) (na on the first bar)
  const up = close.map((c, i) => (i > 0 ? Math.max(c - close[i - 1], 0) : NaN));
  const down = close.map((c, i) => (i > 0 ? Math.max(close[i - 1] - c, 0) : NaN));
  // The three invRSI calls compute the same ta.rma / ta.rsi series (same arguments on every bar)
  const avgUp = A(ta.rma(Series.fromArray(bars, up), len));
  const avgDown = A(ta.rma(Series.fromArray(bars, down), len));
  const rsi = A(ta.rsi(Series.fromBars(bars, 'close'), len));

  const invRsi = (target: number, i: number) => {
    const targetRs = target / (100 - target);
    const priceUp = targetRs * (avgDown[i] * (len - 1)) - avgUp[i] * (len - 1) + close[i];
    const priceDown = avgDown[i] * (len - 1) - (avgUp[i] * (len - 1)) / targetRs + close[i];
    return gt(target, rsi[i]) ? priceUp : priceDown;
  };

  const plot0 = [];
  const plot1 = [];
  const plot2 = [];
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    const priceOb = invRsi(cfg.obLevel, i);
    const priceOs = invRsi(cfg.osLevel, i);
    const upside = ((priceOb - close[i]) / close[i]) * 100;
    const downside = ((close[i] - priceOs) / close[i]) * 100;
    const net = upside - downside;
    const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
    plot0.push({ time: t, value: fin(upside), color: color.green });
    plot1.push({ time: t, value: fin(downside), color: color.red });
    plot2.push({ time: t, value: fin(net), color: gt(net, 0) ? NET_UP : NET_DOWN });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2 },
    hlines: [{ value: 0, options: { title: 'Zero Line', color: '#787B86', linestyle: 'dashed' } }],
  };
}

export const RsiPotential = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
