/**
 * Unit tests for the community batch 37 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import {
  MfiRsiEmaDynamicSignals,
  MarketParticipationRatioMpr,
  TheJewel,
  DemandIndex,
  EvilMacdTradingSystem,
  CleanVolumeBars,
  EurusdSwingHighLowProjection,
  ObvGizmo,
  HighForLoopMisinkomaster,
  NexusSentimentRiskMatrix,
  MedianAtrSdOscillator,
  RsiAdxAtr180125,
  VolumeWithEmaAndColoringRules,
  VolumeCandleColoringV5,
  KissOfDeath,
  BitcoinPiCycleTopBottomIndicatorZScore,
  MovingAveragePercentageDifference,
  PerforanceIntegral,
  MovingVolumeWeightedAvgPriceChannelBbs,
  MacdPseudoSuperSmoother,
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
/** 6th field: plots with Pine show_last = 1 (one point, drawn after the last bar) */
const ports: Array<[string, Port, string, Record<string, number>?, Record<string, number>?, string[]?]> = [
  ['mfi-rsi-ema-dynamic-signals', MfiRsiEmaDynamicSignals, 'plot0'],
  ['market-participation-ratio-mpr', MarketParticipationRatioMpr, 'plot0'],
  ['the-jewel', TheJewel, 'plot0'],
  ['demand-index', DemandIndex, 'plot0'],
  ['evil-macd-trading-system', EvilMacdTradingSystem, 'plot0'],
  ['clean-volume-bars', CleanVolumeBars, 'plot0'],
  ['eurusd-swing-high-low-projection', EurusdSwingHighLowProjection, 'plot0'],
  ['obv-gizmo', ObvGizmo, 'plot0', { plot2: 5, plot3: 5 }],
  ['high-for-loop-misinkomaster', HighForLoopMisinkomaster, 'plot0'],
  ['nexus-sentiment-risk-matrix', NexusSentimentRiskMatrix, 'plot0'],
  ['median-atr-sd-oscillator', MedianAtrSdOscillator, 'plot0'],
  ['rsi-adx-atr-18-01-25', RsiAdxAtr180125, 'plot0'],
  ['volume-with-ema-and-coloring-rules', VolumeWithEmaAndColoringRules, 'plot0'],
  ['volume-candle-coloring-v5', VolumeCandleColoringV5, 'plot0'],
  ['kiss-of-death', KissOfDeath, 'plot0'],
  ['bitcoin-pi-cycle-top-bottom-indicator-z-score', BitcoinPiCycleTopBottomIndicatorZScore, 'plot0'],
  ['moving-average-percentage-difference', MovingAveragePercentageDifference, 'plot0'],
  ['perforance-integral', PerforanceIntegral, 'plot0'],
  ['moving-volume-weighted-avg-price-channel-bbs', MovingVolumeWeightedAvgPriceChannelBbs, 'plot0'],
  ['macd-pseudo-super-smoother', MacdPseudoSuperSmoother, 'plot0'],
];

describe.each(ports)('%s', (id, port, mainPlot, leftOffsets, rightOffsets, singlePoint) => {
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
      if (singlePoint?.includes(key)) {
        expect(points).toHaveLength(1);
        expect(points[0].time).toBeGreaterThan(bars[bars.length - 1].time);
        continue;
      }
      const skip = leftOffsets?.[key] ?? 0;
      // positive Pine offset k: the value of bar i is drawn on bar i + k, the last k points on future bar times
      const ahead = rightOffsets?.[key] ?? 0;
      expect(points).toHaveLength(bars.length - skip);
      points.forEach((p, i) => {
        if (i + ahead < bars.length) expect(p.time).toBe(bars[i + ahead].time);
        else expect(p.time).toBeGreaterThan(points[i - 1].time);
      });
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





