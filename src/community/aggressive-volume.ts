/**
 * Aggressive Volume
 *
 * Estimated aggressive volume of each bar: the volume times the body / range ratio (|close - open| / (high - low),
 * a range of 0 counts as 0.0001), signed by the bar direction (+1 for close > open, -1 for close < open, 0 for a
 * doji). Columns show the volume (grey), the buy part (estimate >= 0, green) and the sell part (estimate < 0, as a
 * positive value, red). A moving average (SMA, EMA, WMA, VWMA, SMMA = SMA, or HMA) of the buy part is drawn as a line.
 *
 * Reference: "Aggressive Volume" by oDouglasAlex
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface AggressiveVolumeInputs {
  /** Moving average length */
  periodoMedia: number;
  /** Moving average type (SMMA is computed as an SMA, as in the original script) */
  tipoMedia: 'SMA' | 'EMA' | 'WMA' | 'VWMA' | 'SMMA' | 'HMA';
  /** Show the moving average */
  mostrarMedia: boolean;
}

export const defaultInputs: AggressiveVolumeInputs = {
  periodoMedia: 14,
  tipoMedia: 'SMA',
  mostrarMedia: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'periodoMedia', type: 'int', title: 'Período da Média Móvel', defval: 14, min: 1 },
  { id: 'tipoMedia', type: 'string', title: 'Tipo de Média Móvel', defval: 'SMA', options: ['SMA', 'EMA', 'WMA', 'VWMA', 'SMMA', 'HMA'] },
  { id: 'mostrarMedia', type: 'bool', title: 'Mostrar Média Móvel?', defval: true },
];

const COMMON = String(color.new(color.gray, 70));
const BUY = String(color.new(color.green, 0));
const SELL = String(color.new(color.red, 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume Comum', color: COMMON, lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Volume de Compra (Agressão)', color: BUY, lineWidth: 2, style: 'columns' },
  { id: 'plot2', title: 'Volume de Venda (Agressão)', color: SELL, lineWidth: 2, style: 'columns' },
  { id: 'plot3', title: 'Média Móvel do Volume de Agressão', color: color.orange, lineWidth: 2 },
];

export const metadata = {
  title: 'Aggressive Volume',
  shortTitle: 'Aggressive Volume',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

export function calculate(bars: Bar[], inputs: Partial<AggressiveVolumeInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const len = cfg.periodoMedia;
  const vol = bars.map((b) => b.volume ?? NaN);

  const delta = bars.map((b, i) => {
    const corpo = Math.abs(b.close - b.open);
    let amplitude = b.high - b.low;
    // amplitude := amplitude == 0 ? 0.0001 : amplitude
    amplitude = eq(amplitude, 0) ? 0.0001 : amplitude;
    const proporcao = corpo / amplitude;
    const direcao = gt(b.close, b.open) ? 1 : lt(b.close, b.open) ? -1 : 0;
    return direcao * vol[i] * proporcao;
  });
  // deltaEstimadoPositivo = deltaEstimado >= 0 ? deltaEstimado : na; deltaEstimadoNegativo = deltaEstimado < 0 ? -deltaEstimado : na
  const pos = delta.map((d) => (ge(d, 0) ? d : NaN));
  const neg = delta.map((d) => (lt(d, 0) ? -d : NaN));

  // mediaDeltaEstimado(): the moving average of the buy part, chosen by type (a constant input: one branch runs on
  // every bar)
  const posS = S(pos);
  let media: number[];
  switch (cfg.tipoMedia) {
    case 'SMA':
    case 'SMMA':
      media = A(ta.sma(posS, len));
      break;
    case 'EMA':
      media = A(ta.ema(posS, len));
      break;
    case 'WMA':
      media = A(ta.wma(posS, len));
      break;
    case 'VWMA':
      media = A(ta.vwma(posS, len, S(vol)));
      break;
    default:
      // ta.hma(x, 1) calls ta.wma(x, 0): a Pine runtime error
      if (Math.floor(len / 2) < 1 && bars.length > 0) {
        throw new Error("Invalid value of the 'length' argument (0.0) in the 'wma' function. It must be > 0.");
      }
      media = A(ta.hma(posS, len));
  }

  const P = (vals: number[], c: string) => bars.map((b, i) => ({
    time: b.time, value: Number.isFinite(vals[i]) ? vals[i] : NaN, color: c,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: P(vol, COMMON),
      plot1: P(pos, BUY),
      plot2: P(neg, SELL),
      plot3: P(cfg.mostrarMedia ? media : media.map(() => NaN), color.orange),
    },
  };
}

export const AggressiveVolume = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
