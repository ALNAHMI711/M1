/**
 * Institutional Composite Moving Average (ICMA)
 *
 * Four composite moving averages. Each one is the mean of four averages of its source over its length: SMA, EMA,
 * WMA and a Hull average wma(2 * wma(src, len / 2) - wma(src, len), round(sqrt(len))). Each line has its own source,
 * length, colour and show switch.
 *
 * Reference: "Institutional Composite Moving Average (ICMA) [Volume Vigilante]" by VolumeVigilante
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © VolumeVigilante
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface InstitutionalCompositeMovingAverageInputs {
  showMa1: boolean;
  ma1Source: SourceType;
  ma1Length: number;
  ma1Color: string;
  showMa2: boolean;
  ma2Source: SourceType;
  ma2Length: number;
  ma2Color: string;
  showMa3: boolean;
  ma3Source: SourceType;
  ma3Length: number;
  ma3Color: string;
  showMa4: boolean;
  ma4Source: SourceType;
  ma4Length: number;
  ma4Color: string;
}

export const defaultInputs: InstitutionalCompositeMovingAverageInputs = {
  showMa1: true,
  ma1Source: 'close',
  ma1Length: 20,
  ma1Color: String(color.new(color.gray, 0)),
  showMa2: true,
  ma2Source: 'close',
  ma2Length: 50,
  ma2Color: String(color.new(color.green, 0)),
  showMa3: true,
  ma3Source: 'close',
  ma3Length: 100,
  ma3Color: String(color.new(color.red, 0)),
  showMa4: true,
  ma4Source: 'close',
  ma4Length: 200,
  ma4Color: String(color.new(color.purple, 0)),
};

export const inputConfig: InputConfig[] = [
  { id: 'showMa1', type: 'bool', title: 'Show MA #1', defval: true, inline: 'MA #1', group: 'MA #1' },
  { id: 'ma1Source', type: 'source', title: 'MA #1 Source', defval: 'close', inline: 'MA #1', group: 'MA #1' },
  { id: 'ma1Length', type: 'int', title: 'MA #1 Length', defval: 20, min: 1, inline: 'MA #1', group: 'MA #1' },
  { id: 'ma1Color', type: 'color', title: 'MA #1 Color', defval: defaultInputs.ma1Color, inline: 'MA #1', group: 'MA #1' },
  { id: 'showMa2', type: 'bool', title: 'Show MA #2', defval: true, inline: 'MA #2', group: 'MA #2' },
  { id: 'ma2Source', type: 'source', title: 'MA #2 Source', defval: 'close', inline: 'MA #2', group: 'MA #2' },
  { id: 'ma2Length', type: 'int', title: 'MA #2 Length', defval: 50, min: 1, inline: 'MA #2', group: 'MA #2' },
  { id: 'ma2Color', type: 'color', title: 'MA #2 Color', defval: defaultInputs.ma2Color, inline: 'MA #2', group: 'MA #2' },
  { id: 'showMa3', type: 'bool', title: 'Show MA #3', defval: true, inline: 'MA #3', group: 'MA #3' },
  { id: 'ma3Source', type: 'source', title: 'MA #3 Source', defval: 'close', inline: 'MA #3', group: 'MA #3' },
  { id: 'ma3Length', type: 'int', title: 'MA #3 Length', defval: 100, min: 1, inline: 'MA #3', group: 'MA #3' },
  { id: 'ma3Color', type: 'color', title: 'MA #3 Color', defval: defaultInputs.ma3Color, inline: 'MA #3', group: 'MA #3' },
  { id: 'showMa4', type: 'bool', title: 'Show MA #4', defval: true, inline: 'MA #4', group: 'MA #4' },
  { id: 'ma4Source', type: 'source', title: 'MA #4 Source', defval: 'close', inline: 'MA #4', group: 'MA #4' },
  { id: 'ma4Length', type: 'int', title: 'MA #4 Length', defval: 200, min: 1, inline: 'MA #4', group: 'MA #4' },
  { id: 'ma4Color', type: 'color', title: 'MA #4 Color', defval: defaultInputs.ma4Color, inline: 'MA #4', group: 'MA #4' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Composite MA #1', color: defaultInputs.ma1Color, lineWidth: 1 },
  { id: 'plot1', title: 'Composite MA #2', color: defaultInputs.ma2Color, lineWidth: 1 },
  { id: 'plot2', title: 'Composite MA #3', color: defaultInputs.ma3Color, lineWidth: 1 },
  { id: 'plot3', title: 'Composite MA #4', color: defaultInputs.ma4Color, lineWidth: 1 },
];

export const metadata = {
  title: 'Institutional Composite Moving Average (ICMA) [Volume Vigilante]',
  shortTitle: 'ICMA [Volume Vigilante]',
  overlay: true,
};

/** compositeMA(src, len): (sma + ema + hma + wma) / 4 */
function compositeMA(bars: Bar[], source: SourceType, len: number): number[] {
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const src = getSourceSeries(bars, source);
  const sma = A(ta.sma(src, len));
  const ema = A(ta.ema(src, len));
  const wma = A(ta.wma(src, len));
  // hma = ta.wma(2 * ta.wma(src, len / 2) - ta.wma(src, len), math.round(math.sqrt(len)))
  const wmaHalf = A(ta.wma(src, len / 2));
  const diff = wmaHalf.map((v, i) => 2 * v - wma[i]);
  const hma = A(ta.wma(Series.fromArray(bars, diff), Math.round(Math.sqrt(len))));
  return sma.map((v, i) => (v + ema[i] + hma[i] + wma[i]) / 4);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<InstitutionalCompositeMovingAverageInputs> = {},
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const line = (show: boolean, source: SourceType, len: number, col: string) => {
    const ma = compositeMA(bars, source, len);
    // plot(show_ma ? ma : na, color = ma_color)
    return bars.map((b, i) => ({ time: b.time, value: show ? ma[i] : NaN, color: col }));
  };

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: line(cfg.showMa1, cfg.ma1Source, cfg.ma1Length, cfg.ma1Color),
      plot1: line(cfg.showMa2, cfg.ma2Source, cfg.ma2Length, cfg.ma2Color),
      plot2: line(cfg.showMa3, cfg.ma3Source, cfg.ma3Length, cfg.ma3Color),
      plot3: line(cfg.showMa4, cfg.ma4Source, cfg.ma4Length, cfg.ma4Color),
    },
  };
}

export const InstitutionalCompositeMovingAverage = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
