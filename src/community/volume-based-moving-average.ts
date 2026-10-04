/**
 * Volume-Based Moving Average
 *
 * A moving average whose length follows the volume: from the current bar back, bars are added until their volume sum
 * reaches the target volume (or the first bar is reached); the average is the mean of the source over these bars.
 * The 'High & Low' source draws two lines (the average of the highs and of the lows), the other sources one line.
 * A line turns green after the given number of rising bars in a row, red after the same number of falling bars in a
 * row, and keeps its colour otherwise (gray at the start).
 *
 * Reference: "Volume-Based Moving Average" by The_Forex_Steward
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © The_Forex_Steward
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface VolumeBasedMovingAverageInputs {
  /** Volume sum that sets the averaging window */
  targetVolume: number;
  /** Source of the average */
  sourceOpt: 'Close' | 'HL2' | 'HLC3' | 'OHLC4' | 'High & Low';
  /** Rising / falling bars in a row that change the line colour */
  slopeConfirmBars: number;
}

export const defaultInputs: VolumeBasedMovingAverageInputs = {
  targetVolume: 250000,
  sourceOpt: 'High & Low',
  slopeConfirmBars: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'targetVolume', type: 'float', title: 'Target Volume', defval: 250000 },
  { id: 'sourceOpt', type: 'string', title: 'Source', defval: 'High & Low', options: ['Close', 'HL2', 'HLC3', 'OHLC4', 'High & Low'] },
  { id: 'slopeConfirmBars', type: 'int', title: 'Slope Confirmation Bars', defval: 3, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume MA', color: color.gray, lineWidth: 2 },
  { id: 'plot1', title: 'Volume MA High', color: color.gray, lineWidth: 2 },
  { id: 'plot2', title: 'Volume MA Low', color: color.gray, lineWidth: 2 },
];

export const metadata = {
  title: 'Volume-Based Moving Average',
  shortTitle: 'Volume-Based Moving Average',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;

export function calculate(bars: Bar[], inputs: Partial<VolumeBasedMovingAverageInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const vol = bars.map((b) => b.volume ?? NaN);

  // f_volumeMA(_src): sum volume[k] and _src[k] from k = 0 while volSum < targetVolume and k < bar_index + 1
  const volumeMA = (src: number[]): number[] => {
    const out: number[] = new Array(n);
    for (let i = 0; i < n; i++) {
      let volSum = 0;
      let priceSum = 0;
      let barsUsed = 0;
      const totalBars = i + 1;
      while (gt(cfg.targetVolume, volSum) && barsUsed < totalBars) {
        volSum += vol[i - barsUsed];
        priceSum += src[i - barsUsed];
        barsUsed += 1;
      }
      out[i] = barsUsed > 0 ? priceSum / barsUsed : NaN;
    }
    return out;
  };
  const na = new Array<number>(n).fill(NaN);
  const srcOf: Record<string, (b: Bar) => number> = {
    Close: (b) => b.close,
    HL2: (b) => (b.high + b.low) / 2,
    HLC3: (b) => (b.high + b.low + b.close) / 3,
    OHLC4: (b) => (b.open + b.high + b.low + b.close) / 4,
  };
  const single = srcOf[cfg.sourceOpt] ? volumeMA(bars.map(srcOf[cfg.sourceOpt])) : na;
  const hl = cfg.sourceOpt === 'High & Low';
  const vmaHigh = hl ? volumeMA(bars.map((b) => b.high)) : na;
  const vmaLow = hl ? volumeMA(bars.map((b) => b.low)) : na;

  // f_slopeColor(_vma): one set of var counters per call
  const slopeColor = (vma: number[]): string[] => {
    let upCount = 0;
    let downCount = 0;
    let curColor: string = color.gray;
    return vma.map((v, i) => {
      const prev = i > 0 ? vma[i - 1] : NaN;
      if (!isNaN(v) && !isNaN(prev)) {
        if (gt(v, prev)) {
          upCount += 1;
          downCount = 0;
        } else if (gt(prev, v)) {
          downCount += 1;
          upCount = 0;
        }
        if (upCount >= cfg.slopeConfirmBars) curColor = color.green;
        else if (downCount >= cfg.slopeConfirmBars) curColor = color.red;
      }
      return curColor;
    });
  };

  const line = (vma: number[]) => {
    const cols = slopeColor(vma);
    return bars.map((b, i) => ({ time: b.time as number, value: Number.isFinite(vma[i]) ? vma[i] : NaN, color: cols[i] }));
  };

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: line(single), plot1: line(vmaHigh), plot2: line(vmaLow) },
  };
}

export const VolumeBasedMovingAverage = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
