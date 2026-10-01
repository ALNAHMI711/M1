/**
 * Unit tests for the community batch 8 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import {
  VossPredictiveFilter,
  AggregatedScoresOscillator,
  Sweep2TradePro,
  ButterworthFilteredMedian,
  PolyFilter,
  QuantVwapSystem38,
  AdMoneyFlow,
  DualRsiSmoother,
  AsianLondonSessionHighLow,
  XauusdBuySellAlertsWithSlTp,
  XauusdFamilyScalping,
  SmoothRSI,
  MarketPressureOscillator,
  TascAutoTuneFilter,
  MedianMacdMattes,
  MesaAdaptiveEhlersFlow,
  MacdXd,
  RsiBbStddevSignal,
  DynamicScorePsar,
  RsiMulticolorEditable,
  indicatorRegistry,
} from '../../src/index';

/** 3200 daily bars (seeded random walk with up and down phases) */
function makeFixture() {
  const bars: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }> = [];
  let seed = 7;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  let price = 100;
  for (let i = 0; i < 3200; i++) {
    const drift = Math.sin(i / 150) * 0.4;
    const open = price;
    const close = Math.max(1, price + drift + (rand() - 0.5) * 4);
    const high = Math.max(open, close) + rand() * 2;
    const low = Math.max(0.5, Math.min(open, close) - rand() * 2);
    bars.push({ time: 1262304000 + i * 86400, open, high, low, close, volume: 500 + Math.floor(rand() * 1000) });
    price = close;
  }
  return bars;
}

const bars = makeFixture();

type Port = { calculate: (b: typeof bars, inputs?: any) => any; metadata: { overlay: boolean } };
/** id, port, main plot, plots drawn with a negative offset (first bars left out) */
const ports: Array<[string, Port, string, Record<string, number>?]> = [
  ['voss-predictive-filter', VossPredictiveFilter, 'plot0'],
  ['aggregated-scores-oscillator', AggregatedScoresOscillator, 'plot0'],
  ['sweep2trade-pro', Sweep2TradePro, 'plot0'],
  ['butterworth-filtered-median', ButterworthFilteredMedian, 'plot0'],
  ['polyfilter', PolyFilter, 'plot0'],
  ['quant-vwap-system-3-8', QuantVwapSystem38, 'plot0'],
  ['ad-money-flow', AdMoneyFlow, 'plot1'],
  ['dual-rsi-smoother', DualRsiSmoother, 'plot0'],
  ['asian-london-session-high-low', AsianLondonSessionHighLow, 'plot0'],
  ['xauusd-buy-sell-alerts-with-sl-tp', XauusdBuySellAlertsWithSlTp, 'plot0'],
  ['xauusd-family-scalping', XauusdFamilyScalping, 'plot0'],
  ['smooth-rsi', SmoothRSI, 'plot0'],
  ['market-pressure-oscillator', MarketPressureOscillator, 'plot0', { plot12: 2, plot13: 2 }],
  ['tasc-2026-05-the-autotune-filter', TascAutoTuneFilter, 'plot0'],
  ['median-macd-mattes', MedianMacdMattes, 'plot0'],
  ['mesa-adaptive-ehlers-flow', MesaAdaptiveEhlersFlow, 'plot0'],
  ['macd-xd', MacdXd, 'plot0'],
  ['rsi-bb-stddev-signal', RsiBbStddevSignal, 'plot0', { plot4: 1, plot5: 1 }],
  ['dynamic-score-psar', DynamicScorePsar, 'plot0'],
  ['rsi-multicolor-editable', RsiMulticolorEditable, 'plot0'],
];

describe.each(ports)('%s', (id, port, mainPlot, leftOffsets) => {
  const result = port.calculate(bars, {});

  it('is in the registry with the same overlay', () => {
    const entry = indicatorRegistry.find((e) => e.id === id);
    expect(entry).toBeDefined();
    expect(entry!.group).toBe('community');
    expect(entry!.overlay).toBe(port.metadata.overlay);
    expect(result.metadata.overlay).toBe(port.metadata.overlay);
  });

  it('returns one point per bar in every plot (bars left out only for negative offsets)', () => {
    for (const [key, points] of Object.entries(result.plots as Record<string, Array<{ time: number }>>)) {
      const skip = leftOffsets?.[key] ?? 0;
      expect(points).toHaveLength(bars.length - skip);
      points.forEach((p, i) => expect(p.time).toBe(bars[i].time));
    }
  });

  it('produces finite values in its main output', () => {
    // 'candles': the main output is the plotcandle series
    const vals = mainPlot === 'candles'
      ? (Object.values(result.plotCandles)[0] as Array<{ close: number }>).map((c) => c.close).filter((v) => !isNaN(v))
      : (result.plots[mainPlot] as Array<{ value: number }>).map((p) => p.value).filter((v) => !isNaN(v));
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => expect(isFinite(v)).toBe(true));
  });
});
