/**
 * Q Wave
 *
 * Two adaptive EMA-like waves of hlc3. The smoothing factor of each wave is the EMA alpha of its length, raised by
 * the bar pressure: |close - open| / ATR, times the volume ratio volume / SMA(volume) (capped at 3, optional).
 * The structure direction is +1 when the latest structLen-bar high is more recent than the latest structLen-bar low,
 * -1 in the other case. A counter (capped at +-2 * inertia) moves with the structure direction and sets the
 * confirmed regime when it reaches +-inertia. The fast wave is coloured by the structure, the slow wave by the
 * regime, and the zone between them by their agreement.
 *
 * Reference: "Q Wave" by Quantora
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Quantora
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface QWaveInputs {
  /** Bars used to detect the dominant price structure */
  structLen: number;
  /** Fast wave sensitivity (EMA length) */
  fastLen: number;
  /** Slow wave sensitivity (EMA length) */
  slowLen: number;
  /** Regime inertia: counter value that confirms the regime */
  regimeInertia: number;
  /** ATR and volume average length */
  baseLen: number;
  /** Use volume weighting */
  useVol: boolean;
  bullColor: string;
  bearColor: string;
  neutralColor: string;
  /** Zone fill transparency */
  zoneTransp: number;
  /** Line width (the plot widths of the config stay at the default 2 / 1) */
  lineW: number;
}

export const defaultInputs: QWaveInputs = {
  structLen: 20,
  fastLen: 10,
  slowLen: 35,
  regimeInertia: 6,
  baseLen: 14,
  useVol: true,
  bullColor: '#00c8ff',
  bearColor: '#ff3060',
  neutralColor: '#b0bec5',
  zoneTransp: 86,
  lineW: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'structLen', type: 'int', title: 'Structure Period', defval: 20, min: 2 },
  { id: 'fastLen', type: 'int', title: 'Fast Wave Sensitivity', defval: 10, min: 1 },
  { id: 'slowLen', type: 'int', title: 'Slow Wave Sensitivity', defval: 35, min: 2 },
  { id: 'regimeInertia', type: 'int', title: 'Regime Inertia', defval: 6, min: 1 },
  { id: 'baseLen', type: 'int', title: 'ATR / Volume Length', defval: 14, min: 1 },
  { id: 'useVol', type: 'bool', title: 'Use Volume Weighting', defval: true },
  { id: 'bullColor', type: 'color', title: 'Bull', defval: '#00c8ff' },
  { id: 'bearColor', type: 'color', title: 'Bear', defval: '#ff3060' },
  { id: 'neutralColor', type: 'color', title: 'Transition', defval: '#b0bec5' },
  { id: 'zoneTransp', type: 'int', title: 'Zone Transparency', defval: 86, min: 50, max: 95 },
  { id: 'lineW', type: 'int', title: 'Line Width', defval: 2, min: 1, max: 4 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast Wave', color: '#00c8ff', lineWidth: 2 },
  { id: 'plot1', title: 'Slow Wave', color: '#00c8ff', lineWidth: 1 },
];

export const metadata = {
  title: 'Q Wave',
  shortTitle: 'Q Wave',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(bars: Bar[], inputs: Partial<QWaveInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const { structLen, fastLen, slowLen, regimeInertia, baseLen, useVol } = cfg;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  const hiBars = A(ta.highestbars(S(bars.map((b) => b.high)), structLen));
  const loBars = A(ta.lowestbars(S(bars.map((b) => b.low)), structLen));
  const atrArr = A(ta.atr(bars, baseLen));
  const volArr = bars.map((b) => b.volume ?? NaN);
  const volSma = A(ta.sma(S(volArr), baseLen));

  const fast: number[] = new Array(n);
  const slow: number[] = new Array(n);
  const structDirs: number[] = new Array(n);
  const slowDirs: number[] = new Array(n);

  // var int lastHighBar = bar_index / lastLowBar = bar_index: equal on the first bar (only their order counts)
  let lastHighBar = 0;
  let lastLowBar = 0;
  let wFast = NaN;
  let wSlow = NaN;
  let counter = 0;
  let slowDir = 0;
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    if (hiBars[i] === 0) lastHighBar = i;
    if (loBars[i] === 0) lastLowBar = i;
    const structDir = lastHighBar > lastLowBar ? 1 : lastHighBar < lastLowBar ? -1 : 0;

    const atr = Number.isNaN(atrArr[i]) ? 0.0 : atrArr[i];
    const volMA = Number.isNaN(volSma[i]) ? 0.0 : volSma[i];
    const volRatio = useVol && gt(volMA, 0) ? Math.min(volArr[i] / volMA, 3.0) : 1.0;
    const pressure = gt(atr, 0) ? Math.abs((b.close - b.open) / atr) * volRatio : 1.0;

    const boost = 1.0 + Math.min(pressure * 0.15, 1.0);
    const alphaFast = Math.max(0.05, Math.min(0.60, (2.0 / (fastLen + 1)) * boost));
    const alphaSlow = Math.max(0.02, Math.min(0.30, (2.0 / (slowLen + 1)) * boost * 0.5));

    const hlc3 = (b.high + b.low + b.close) / 3;
    if (i === 0) {
      // var float wFast = hlc3 / wSlow = hlc3
      wFast = hlc3;
      wSlow = hlc3;
    }
    wFast = (1.0 - alphaFast) * wFast + alphaFast * hlc3;
    wSlow = (1.0 - alphaSlow) * wSlow + alphaSlow * hlc3;

    counter = structDir === 1 ? Math.min(counter + 1, regimeInertia * 2)
      : structDir === -1 ? Math.max(counter - 1, -regimeInertia * 2)
        : counter;
    slowDir = counter >= regimeInertia ? 1 : counter <= -regimeInertia ? -1 : slowDir;

    fast[i] = wFast;
    slow[i] = wSlow;
    structDirs[i] = structDir;
    slowDirs[i] = slowDir;
  }

  const dirColor = (d: number) => (d === 1 ? cfg.bullColor : d === -1 ? cfg.bearColor : cfg.neutralColor);
  const neutTransp = Math.min(cfg.zoneTransp + 5, 100);
  const zoneBull = String(color.new(cfg.bullColor, cfg.zoneTransp));
  const zoneBear = String(color.new(cfg.bearColor, cfg.zoneTransp));
  const zoneNeut = String(color.new(cfg.neutralColor, neutTransp));
  const val = (v: number) => (Number.isFinite(v) ? v : NaN);

  const plot0 = bars.map((b, i) => ({ time: b.time, value: val(fast[i]), color: dirColor(structDirs[i]) }));
  const plot1 = bars.map((b, i) => ({ time: b.time, value: val(slow[i]), color: dirColor(slowDirs[i]) }));
  const zoneColors = bars.map((_b, i) => {
    const s = structDirs[i];
    const r = slowDirs[i];
    return s === 1 && r === 1 ? zoneBull : s === -1 && r === -1 ? zoneBear : zoneNeut;
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1 },
    fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'Wave Zone' }, colors: zoneColors }],
  };
}

export const QWave = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
