/**
 * Bitcoin Bull/Bear Market Support/Resistance Bands
 *
 * Up to four moving averages (SMA, EMA, SMMA (RMA), WMA or VWMA, each with its own source and length); by default
 * a 20 SMA and a 21 EMA of the close. The area between MA #1 and MA #2 is filled red when MA #1 >= MA #2, else green.
 *
 * Reference: "Bitcoin Bull/Bear Market Support/Resistance Bands" by JoeSTM
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export type BtcMsrMAType = 'SMA' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';

export interface BitcoinBullBearMarketBandsInputs {
  showMa1: boolean;
  ma1Type: BtcMsrMAType;
  ma1Source: SourceType;
  ma1Length: number;
  ma1Color: string;
  showMa2: boolean;
  ma2Type: BtcMsrMAType;
  ma2Source: SourceType;
  ma2Length: number;
  ma2Color: string;
  showMa3: boolean;
  ma3Type: BtcMsrMAType;
  ma3Source: SourceType;
  ma3Length: number;
  ma3Color: string;
  showMa4: boolean;
  ma4Type: BtcMsrMAType;
  ma4Source: SourceType;
  ma4Length: number;
  ma4Color: string;
  /** Fill between MA #1 and MA #2 */
  showFill: boolean;
  /** Fill transparency (0-100) */
  fillOpacity: number;
}

export const defaultInputs: BitcoinBullBearMarketBandsInputs = {
  showMa1: true,
  ma1Type: 'SMA',
  ma1Source: 'close',
  ma1Length: 20,
  ma1Color: '#ff3347',
  showMa2: true,
  ma2Type: 'EMA',
  ma2Source: 'close',
  ma2Length: 21,
  ma2Color: '#4caf50',
  showMa3: false,
  ma3Type: 'SMA',
  ma3Source: 'close',
  ma3Length: 100,
  ma3Color: '#b4602a',
  showMa4: false,
  ma4Type: 'SMA',
  ma4Source: 'close',
  ma4Length: 200,
  ma4Color: '#b52b24',
  showFill: true,
  fillOpacity: 75,
};

const MA_TYPES = ['SMA', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'];
const maInputs = (k: number): InputConfig[] => {
  const d = defaultInputs as unknown as Record<string, unknown>;
  return [
    { id: `showMa${k}`, type: 'bool', title: `MA #${k}`, defval: d[`showMa${k}`] as boolean, inline: `MA #${k}` },
    { id: `ma${k}Type`, type: 'string', title: `MA #${k} Type`, defval: d[`ma${k}Type`] as string, options: MA_TYPES, inline: `MA #${k}` },
    { id: `ma${k}Source`, type: 'source', title: `MA #${k} Source`, defval: 'close', inline: `MA #${k}` },
    { id: `ma${k}Length`, type: 'int', title: `MA #${k} Length`, defval: d[`ma${k}Length`] as number, min: 1, inline: `MA #${k}` },
    { id: `ma${k}Color`, type: 'color', title: `MA #${k} Color`, defval: d[`ma${k}Color`] as string, inline: `MA #${k}` },
  ];
};

export const inputConfig: InputConfig[] = [
  ...maInputs(1),
  ...maInputs(2),
  ...maInputs(3),
  ...maInputs(4),
  { id: 'showFill', type: 'bool', title: 'Fill MA #1 ↔ MA #2', defval: true },
  { id: 'fillOpacity', type: 'int', title: 'Fill Transparency', defval: 75, min: 0, max: 100 },
];

// plot(maK, "MA #K", maK_color, display = show_maK ? display.all - display.status_line : display.none):
// PlotConfig `visible` = the input id (drawn in the pane, not in the status line)
export const plotConfig: PlotConfig[] = [1, 2, 3, 4].map((k) => ({
  id: `plot${k - 1}`,
  title: `MA #${k}`,
  color: (defaultInputs as unknown as Record<string, string>)[`ma${k}Color`],
  lineWidth: 1,
  visible: `showMa${k}`,
}));

export const metadata = {
  title: 'Bitcoin Bull/Bear Market Support/Resistance Bands',
  shortTitle: 'BTC MSR',
  overlay: true,
};

/** Pine float comparisons: a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

export function calculate(bars: Bar[], inputs: Partial<BitcoinBullBearMarketBandsInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const volume = Series.fromArray(bars, bars.map((b) => b.volume ?? NaN));

  const ma = (source: Series, length: number, type: BtcMsrMAType): number[] => {
    switch (type) {
      case 'SMA': return A(ta.sma(source, length));
      case 'EMA': return A(ta.ema(source, length));
      case 'SMMA (RMA)': return A(ta.rma(source, length));
      case 'WMA': return A(ta.wma(source, length));
      case 'VWMA': return A(ta.vwma(source, length, volume));
      default: return new Array(n).fill(NaN);
    }
  };
  const c = cfg as unknown as Record<string, unknown>;
  const mas = [1, 2, 3, 4].map((k) => (c[`showMa${k}`]
    ? ma(getSourceSeries(bars, c[`ma${k}Source`] as SourceType), c[`ma${k}Length`] as number, c[`ma${k}Type`] as BtcMsrMAType)
    : new Array(n).fill(NaN)));

  const plots: IndicatorResult['plots'] = {};
  [1, 2, 3, 4].forEach((k) => {
    const col = c[`ma${k}Color`] as string;
    plots[`plot${k - 1}`] = bars.map((b, i) => ({ time: b.time, value: mas[k - 1][i], color: col }));
  });

  // fillColor = ma1 >= ma2 ? color.new(color.red, fill_opacity) : color.new(color.green, fill_opacity)
  // fill(p1, p2, color = show_fill and show_ma1 and show_ma2 ? fillColor : na)
  const red = String(color.new(color.red, cfg.fillOpacity));
  const green = String(color.new(color.green, cfg.fillOpacity));
  const on = cfg.showFill && cfg.showMa1 && cfg.showMa2;
  const colors = bars.map((_b, i) => (on ? (ge(mas[0][i], mas[1][i]) ? red : green) : 'transparent'));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills: [{ plot1: 'plot0', plot2: 'plot1', colors }],
  };
}

export const BitcoinBullBearMarketBands = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
