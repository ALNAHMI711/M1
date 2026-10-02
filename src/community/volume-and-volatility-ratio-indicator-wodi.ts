/**
 * Volume and Volatility Ratio Indicator-WODI
 *
 * The volume in percent of its SMA (columns) is multiplied by the bar range in percent of the close
 * ((high - low) / close * 100) to give a volume / volatility index (step line). Short and long SMAs of the index are
 * drawn scaled by a sensitivity factor, with a constant threshold line. The volume columns above the volume SMA are
 * cyan, purple on a bullish reversal pattern and red on a bearish one: the index of the previous bar is above the bar
 * before and above the current index (or the previous volume is above the current one), the closes fell (rose) over
 * the lookback bars before the previous bar and the close then rose (fell), the volume is above its SMA, the index is
 * above the threshold and one of the last two candles has a lower (upper) wick longer than its body.
 *
 * Reference: "Volume and Volatility Ratio Indicator-WODI" by W0DI
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface VolumeAndVolatilityRatioIndicatorWodiInputs {
  /** Volume SMA length */
  volLength: number;
  /** Short SMA length of the index */
  indexShortLength: number;
  /** Long SMA length of the index */
  indexLongLength: number;
  /** Factor of the two index SMAs */
  indexMagnification: number;
  /** Index threshold */
  indexThreshold: number;
  /** Number of bars of the pattern check */
  lookbackBars: number;
}

export const defaultInputs: VolumeAndVolatilityRatioIndicatorWodiInputs = {
  volLength: 48,
  indexShortLength: 13,
  indexLongLength: 26,
  indexMagnification: 2,
  indexThreshold: 200,
  lookbackBars: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'volLength', type: 'int', title: '交易量均线长度', defval: 48 },
  { id: 'indexShortLength', type: 'int', title: '指数短均线长度', defval: 13 },
  { id: 'indexLongLength', type: 'int', title: '指数均线长度', defval: 26 },
  { id: 'indexMagnification', type: 'int', title: '指数均线敏感度', defval: 2 },
  { id: 'indexThreshold', type: 'int', title: '指数阈值', defval: 200 },
  { id: 'lookbackBars', type: 'int', title: 'K线形态检测长度', defval: 3 },
];

const THRESHOLD_COLOR = String(color.rgb(238, 66, 193));
const BULL_COLOR = '#bc2af6';
const BEAR_COLOR = '#f22a2a';
const HIGH_VOLUME_COLOR = String(color.rgb(77, 231, 255, 37));
const LOW_VOLUME_COLOR = String(color.rgb(120, 123, 134, 70));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '指数短均线', color: color.gray, lineWidth: 1 },
  { id: 'plot1', title: '指数长均线', color: '#2ad7f6', lineWidth: 1 },
  { id: 'plot2', title: '波动率阈值', color: THRESHOLD_COLOR, lineWidth: 1 },
  { id: 'plot3', title: '交易量柱状图', color: HIGH_VOLUME_COLOR, lineWidth: 1, style: 'columns' },
  { id: 'plot4', title: '交易量/波动率指数', color: '#000000', lineWidth: 1, style: 'stepline' },
];

export const metadata = {
  title: 'Volume and Volatility Ratio Indicator-WODI',
  shortTitle: 'Volume and Volatility Ratio Indicator-WODI',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(bars: Bar[], inputs: Partial<VolumeAndVolatilityRatioIndicatorWodiInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  const volume = bars.map((b) => b.volume ?? NaN);
  const volMa = A(ta.sma(S(volume), cfg.volLength));
  // Plain divisions: x / 0 is +-infinity (0 / 0 na); comparisons use the infinite value, plots show na
  const volPercent = volume.map((v, i) => (v / volMa[i]) * 100);
  const volatility = bars.map((b) => ((b.high - b.low) / b.close) * 100);
  const vi = volPercent.map((v, i) => v * volatility[i]);
  const shortMa = A(ta.sma(S(vi), cfg.indexShortLength));
  const longMa = A(ta.sma(S(vi), cfg.indexLongLength));

  const get = (a: number[], i: number, k: number) => (i - k >= 0 ? a[i - k] : NaN);
  const close = bars.map((b) => b.close);
  const open = bars.map((b) => b.open);
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  const L = cfg.lookbackBars;

  const isRev: boolean[] = new Array(n).fill(false);
  const isRevS: boolean[] = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    const common = gt(get(vi, i, 1), get(vi, i, 2))
      && (gt(get(vi, i, 1), vi[i]) || gt(get(volume, i, 1), volume[i]))
      && gt(volume[i], volMa[i]) && gt(vi[i], cfg.indexThreshold);
    // Pine `for i = 1 to lookback_bars` (counts down when lookback_bars < 1)
    const step = L >= 1 ? 1 : -1;
    for (let k = 1; step > 0 ? k <= L : k >= L; k += step) {
      const cond = common && gt(get(close, i, k + 1), get(close, i, k)) && lt(get(close, i, 1), close[i])
        && (lt(get(open, i, 1) - get(close, i, 1), get(close, i, 1) - get(low, i, 1)) || lt(open[i] - close[i], close[i] - low[i]));
      if (cond) {
        if (k >= L) isRev[i] = true;
      } else if (k < L) break;
    }
    for (let k = 1; step > 0 ? k <= L : k >= L; k += step) {
      const cond = common && lt(get(close, i, k + 1), get(close, i, k)) && gt(get(close, i, 1), close[i])
        && (lt(get(close, i, 1) - get(open, i, 1), get(high, i, 1) - get(close, i, 1)) || lt(close[i] - open[i], high[i] - close[i]));
      if (cond) {
        if (k >= L) isRevS[i] = true;
      } else if (k < L) break;
    }
  }

  const fin = (x: number) => (Number.isFinite(x) ? x : NaN);
  const t = (i: number) => bars[i].time;
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((_b, i) => ({ time: t(i), value: fin(shortMa[i] * cfg.indexMagnification), color: color.gray })),
      plot1: bars.map((_b, i) => ({ time: t(i), value: fin(longMa[i] * cfg.indexMagnification), color: '#2ad7f6' })),
      plot2: bars.map((_b, i) => ({ time: t(i), value: cfg.indexThreshold, color: THRESHOLD_COLOR })),
      // bar_color = volume > vol_ma ? (is_reversal_pattern ? #bc2af6 : (is_reversal_pattern_s ? #f22a2a : rgb(77, 231, 255, 37))) : rgb(120, 123, 134, 70)
      plot3: bars.map((_b, i) => ({
        time: t(i),
        value: fin(volPercent[i]),
        color: gt(volume[i], volMa[i]) ? (isRev[i] ? BULL_COLOR : isRevS[i] ? BEAR_COLOR : HIGH_VOLUME_COLOR) : LOW_VOLUME_COLOR,
      })),
      plot4: bars.map((_b, i) => ({ time: t(i), value: fin(vi[i]), color: '#000000' })),
    },
  };
}

export const VolumeAndVolatilityRatioIndicatorWodi = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
