/**
 * IV Rank (tasty-style), VIXFix / HV proxy
 *
 * An implied volatility proxy: VIXFix = max(100 * (highest(high, len) - close) / highest(high, len),
 * mult * stdev(low, len)), or the annualised historical volatility stdev(log(close / close[1]), len) * sqrt(252) * 100.
 * The IV rank is the position of the proxy between its lowest and highest value of `lookbackIVR` bars, in percent
 * (na when that range is 0). Horizontal lines at 0, 50 and 100.
 *
 * Reference: "IV Rank (tasty-style) — VIXFix / HV Proxy" by steveoptionstrade2025
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © steveoptionstrade2025
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';

export interface IvRankVixFixHvProxyInputs {
  /** Volatility proxy */
  ivSource: 'VIXFix' | 'HV(30)';
  /** Length of the highest / lowest proxy value */
  lookbackIVR: number;
  /** Length of the historical volatility (HV mode) */
  hvLen: number;
  /** Length of the VIXFix */
  vixLen: number;
  /** Multiplier of the standard deviation of the low (VIXFix) */
  vixMult: number;
}

export const defaultInputs: IvRankVixFixHvProxyInputs = {
  ivSource: 'VIXFix',
  lookbackIVR: 252,
  hvLen: 30,
  vixLen: 22,
  vixMult: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'ivSource', type: 'string', title: 'IV Source (proxy)', defval: 'VIXFix', options: ['VIXFix', 'HV(30)'] },
  { id: 'lookbackIVR', type: 'int', title: 'IVR Lookback (trading days ~1y)', defval: 252, min: 60 },
  { id: 'hvLen', type: 'int', title: 'HV length (if HV mode)', defval: 30, min: 10 },
  { id: 'vixLen', type: 'int', title: 'VIXFix length', defval: 22, min: 10 },
  { id: 'vixMult', type: 'float', title: 'VIXFix stdev multiplier', defval: 2.0, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'IV Rank %', color: '#2962FF', lineWidth: 2 },
];

/** hline(0), hline(50), hline(100) with the Pine default style */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_0', price: 0, title: '0%', color: '#787B86', linestyle: 'dashed', linewidth: 1 },
  { id: 'hline_50', price: 50, title: '50%', color: '#787B86', linestyle: 'dashed', linewidth: 1 },
  { id: 'hline_100', price: 100, title: '100%', color: '#787B86', linestyle: 'dashed', linewidth: 1 },
];

export const metadata = {
  title: 'IV Rank (tasty-style) — VIXFix / HV Proxy',
  shortTitle: 'IV Rank (tasty-style) — VIXFix / HV Proxy',
  overlay: false,
};

/** Pine `!=`: false when a value is na or when the values are within 1e-10 */
const EPS = 1e-10;
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;

export function calculate(bars: Bar[], inputs: Partial<IvRankVixFixHvProxyInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const close = bars.map((b) => b.close);

  // ivSource is an input: the same branch runs on every bar, so its ta.* calls see every bar
  let iv: number[];
  if (cfg.ivSource === 'VIXFix') {
    const hh = A(ta.highest(S(bars.map((b) => b.high)), cfg.vixLen));
    const st = A(ta.stdev(S(bars.map((b) => b.low)), cfg.vixLen));
    iv = bars.map((_b, i) => {
      const raw = (100 * (hh[i] - close[i])) / hh[i];
      // math.max(raw, st): na when one of them is na
      return Math.max(raw, cfg.vixMult * st[i]);
    });
  } else {
    const r = close.map((c, i) => (i > 0 ? Math.log(c / close[i - 1]) : NaN));
    const sd = A(ta.stdev(S(r), cfg.hvLen));
    iv = sd.map((v) => v * Math.sqrt(252) * 100.0);
  }

  const ivHi = A(ta.highest(S(iv), cfg.lookbackIVR));
  const ivLo = A(ta.lowest(S(iv), cfg.lookbackIVR));
  const plot0 = bars.map((b, i) => {
    const ivRange = ivHi[i] - ivLo[i];
    const ivr = ne(ivRange, 0) ? (100 * (iv[i] - ivLo[i])) / ivRange : NaN;
    return { time: b.time, value: Number.isFinite(ivr) ? ivr : NaN };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
    hlines: hlineConfig.map((h) => ({
      value: h.price,
      options: { title: h.title, color: h.color, linestyle: h.linestyle, linewidth: h.linewidth },
    })),
  };
}

export const IvRankVixFixHvProxy = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
