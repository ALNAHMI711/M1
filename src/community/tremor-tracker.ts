/**
 * Tremor Tracker
 *
 * Bar volatility in percent: (high / low - 1) * 100, with a moving average (SMA, EMA or WMA). The volatility line is
 * coloured by its ratio to the SMA of the volatility over a long lookback: lime below the low limit, yellow below the
 * high limit, fuchsia above. A dashed line at 0.
 *
 * Reference: "Tremor Tracker [theUltimator5]" by TheUltimator5
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © TheUltimator5
 */

import { taCore, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';

export type TremorTrackerMAType = 'SMA' | 'EMA' | 'WMA';

export interface TremorTrackerInputs {
  /** Ratio below which the volatility is low (lime) */
  lowLimit: number;
  /** Ratio below which the volatility is medium (yellow); fuchsia above */
  highLimit: number;
  /** Length of the volatility moving average */
  volLength: number;
  /** Lookback of the average volatility (SMA) */
  avgVolLookback: number;
  /** Type of the volatility moving average */
  maType: TremorTrackerMAType;
  showVolMA: boolean;
  showRawVol: boolean;
}

export const defaultInputs: TremorTrackerInputs = {
  lowLimit: 1.0,
  highLimit: 2.0,
  volLength: 20,
  avgVolLookback: 200,
  maType: 'SMA',
  showVolMA: true,
  showRawVol: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'lowLimit', type: 'float', title: 'Low Volatility Limit', defval: 1.0 },
  { id: 'highLimit', type: 'float', title: 'High Volatility Limit', defval: 2.0 },
  { id: 'volLength', type: 'int', title: 'Volatility MA Length', defval: 20, min: 1 },
  { id: 'avgVolLookback', type: 'int', title: 'Average Volatility Lookback', defval: 200, min: 10 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'SMA', options: ['SMA', 'EMA', 'WMA'] },
  { id: 'showVolMA', type: 'bool', title: 'Show Volatility MA Line?', defval: true },
  { id: 'showRawVol', type: 'bool', title: 'Show Raw Volatility Bars?', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Vol MA', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'Vol', color: color.lime, lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_base', price: 0, title: 'Baseline (0)', color: color.gray, linestyle: 'dashed' },
];

export const metadata = {
  title: 'Tremor Tracker [theUltimator5]',
  shortTitle: 'Tremor Tracker [theUltimator5]',
  overlay: false,
};

/** Pine float comparisons: a < b only when b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(bars: Bar[], inputs: Partial<TremorTrackerInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  // volatility = ((high / low) - 1) * 100: a plain division (a low of 0 gives +infinity, as in Pine)
  const volatility = bars.map((b) => (b.high / b.low - 1) * 100);
  const volMA = cfg.maType === 'EMA' ? taCore.ema(volatility, cfg.volLength)
    : cfg.maType === 'WMA' ? taCore.wma(volatility, cfg.volLength)
      : taCore.sma(volatility, cfg.volLength);
  const avgVol = taCore.sma(volatility, cfg.avgVolLookback);
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: cfg.showVolMA ? fin(volMA[i]) : NaN, color: color.blue })),
      plot1: bars.map((b, i) => {
        const volRatio = volatility[i] / avgVol[i];
        const c = lt(volRatio, cfg.lowLimit) ? color.lime : lt(volRatio, cfg.highLimit) ? color.yellow : color.fuchsia;
        return { time: b.time, value: cfg.showRawVol ? fin(volatility[i]) : NaN, color: c };
      }),
    },
    hlines: [{ value: 0, options: { title: 'Baseline (0)', color: color.gray, linestyle: 'dashed' } }],
  };
}

export const TremorTracker = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
