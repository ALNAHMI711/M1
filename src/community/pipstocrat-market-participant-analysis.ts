/**
 * Pipstocrat Market Participant Analysis
 *
 * Two smoothed RSI lines clamped to 0..20: "Hot Money" = ema(0.7 * (rsi(close, 40) - 30), 3) and "Smart Money" =
 * ema(1.5 * (rsi(close, 50) - 50), 3) (sensitivity, period and base are inputs). They are drawn as columns over a
 * constant "Retail Activity" column at 20, with fills between the retail and hot money plots and between the hot
 * money and smart money plots, a light background and dashed reference lines at 5, 10 and 15.
 *
 * Reference: "Pipstocrat Market Participant Analysis" by Delast2
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';

export interface PipstocratMarketParticipantAnalysisInputs {
  hotMoneySensitivity: number;
  hotMoneyPeriod: number;
  hotMoneyBase: number;
  bankerSensitivity: number;
  bankerPeriod: number;
  bankerBase: number;
  /** Not used by the script */
  showLabels: boolean;
  /** Transparency of the column colours */
  transparency: number;
  colorBankerBull: string;
  /** Not used by the script */
  colorBankerBear: string;
  colorHotMoneyBull: string;
  /** Not used by the script */
  colorHotMoneyBear: string;
  colorRetail: string;
  colorReferenceLine: string;
}

export const defaultInputs: PipstocratMarketParticipantAnalysisInputs = {
  hotMoneySensitivity: 0.7,
  hotMoneyPeriod: 40,
  hotMoneyBase: 30,
  bankerSensitivity: 1.5,
  bankerPeriod: 50,
  bankerBase: 50,
  showLabels: true,
  transparency: 40,
  colorBankerBull: 'rgb(23, 173, 28)',
  colorBankerBear: 'rgb(202, 196, 196)',
  colorHotMoneyBull: '#000000',
  colorHotMoneyBear: '#ff0000',
  colorRetail: 'rgb(232, 144, 21)',
  colorReferenceLine: '#757575',
};

export const inputConfig: InputConfig[] = [
  { id: 'hotMoneySensitivity', type: 'float', title: 'Sensitivity', defval: 0.7, group: 'Hot Money Settings' },
  { id: 'hotMoneyPeriod', type: 'int', title: 'Period', defval: 40, group: 'Hot Money Settings' },
  { id: 'hotMoneyBase', type: 'float', title: 'Base', defval: 30, group: 'Hot Money Settings' },
  { id: 'bankerSensitivity', type: 'float', title: 'Sensitivity', defval: 1.5, group: 'Banker Settings' },
  { id: 'bankerPeriod', type: 'int', title: 'Period', defval: 50, group: 'Banker Settings' },
  { id: 'bankerBase', type: 'float', title: 'Base', defval: 50, group: 'Banker Settings' },
  { id: 'showLabels', type: 'bool', title: 'Show Labels', defval: true, group: 'Visual Settings' },
  { id: 'transparency', type: 'int', title: 'Transparency', defval: 40, min: 0, max: 100, group: 'Visual Settings' },
  { id: 'colorBankerBull', type: 'color', title: 'Banker Bullish Color', defval: 'rgb(23, 173, 28)', group: 'Color Settings' },
  { id: 'colorBankerBear', type: 'color', title: 'Banker Bearish Color', defval: 'rgb(202, 196, 196)', group: 'Color Settings' },
  { id: 'colorHotMoneyBull', type: 'color', title: 'Hot Money Bullish Color', defval: '#000000', group: 'Color Settings' },
  { id: 'colorHotMoneyBear', type: 'color', title: 'Hot Money Bearish Color', defval: '#ff0000', group: 'Color Settings' },
  { id: 'colorRetail', type: 'color', title: 'Retail Color', defval: 'rgb(232, 144, 21)', group: 'Color Settings' },
  { id: 'colorReferenceLine', type: 'color', title: 'Reference Line Color', defval: '#757575', group: 'Color Settings' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Retail Activity', color: String(color.new('rgb(232, 144, 21)', 40)), lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Hot Money', color: String(color.new('#000000', 40)), lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'Smart Money', color: String(color.new('rgb(23, 173, 28)', 40)), lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'Pipstocrat Market Participant Analysis',
  shortTitle: 'PMPA',
  overlay: false,
};

export function calculate(
  bars: Bar[],
  inputs: Partial<PipstocratMarketParticipantAnalysisInputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const close = S(bars.map((b) => b.close));

  // ta.ema(sensitivity * (ta.rsi(close, period) - base), 3), then math.max(0, math.min(20, x))
  const smoothRsi = (sensitivity: number, period: number, base: number) => {
    const rsi = A(ta.rsi(close, period));
    const ema = A(ta.ema(S(rsi.map((r) => sensitivity * (r - base))), 3));
    return ema.map((v) => Math.max(0, Math.min(20, v)));
  };
  const hotMoney = smoothRsi(cfg.hotMoneySensitivity, cfg.hotMoneyPeriod, cfg.hotMoneyBase);
  const banker = smoothRsi(cfg.bankerSensitivity, cfg.bankerPeriod, cfg.bankerBase);
  const retailer = 20;

  const retailCol = String(color.new(cfg.colorRetail, cfg.transparency));
  const hotCol = String(color.new(cfg.colorHotMoneyBull, cfg.transparency));
  const bankerCol = String(color.new(cfg.colorBankerBull, cfg.transparency));
  const bg = String(color.new('#000000', 95));
  const refCol = String(color.new(cfg.colorReferenceLine, 85));
  const fill0 = String(color.new(cfg.colorRetail, 60));
  const fill1 = String(color.new(cfg.colorHotMoneyBull, 60));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b) => ({ time: b.time, value: retailer, color: retailCol })),
      plot1: bars.map((b, i) => ({ time: b.time, value: hotMoney[i], color: hotCol })),
      plot2: bars.map((b, i) => ({ time: b.time, value: banker[i], color: bankerCol })),
    },
    hlines: [
      { value: 5, options: { title: 'Support', color: refCol, linestyle: 'dashed' } },
      { value: 10, options: { title: 'Neutral', color: refCol, linestyle: 'dashed' } },
      { value: 15, options: { title: 'Resistance', color: refCol, linestyle: 'dashed' } },
    ],
    fills: [
      // fill(p_retail, p_hot, color = color.new(color_retail, 60))
      { plot1: 'plot0', plot2: 'plot1', options: { title: 'Plots Background', color: fill0 }, colors: bars.map(() => fill0) },
      // fill(p_hot, p_banker, color = color.new(color_hot_money_bull, 60))
      { plot1: 'plot1', plot2: 'plot2', options: { title: 'Plots Background', color: fill1 }, colors: bars.map(() => fill1) },
    ],
    // bgcolor(color.new(#000000, 95))
    bgColors: bars.map((b) => ({ time: b.time, color: bg })),
  };
}

export const PipstocratMarketParticipantAnalysis = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
