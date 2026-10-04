/**
 * Unit tests for the community batch 32 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import {
  GorgosHybridOscillatorStrategy,
  VolumeBasedRsiColorIndicatorWithMas,
  SharpeRatioV4,
  NormalizedCandlesRsi,
  AdaptiveAverageSentimentOscilator,
  AdxTrendVisualizerWithDualThresholds,
  IchimokuKinkoHyo,
  DnMacd,
  PullbackSar,
  MarketPulsePro,
  DmiHistogramIndicator,
  ErdEffortResultDiagnostic,
  CandleBuySellSupportResistance,
  MadzMovingAverageDeviationZScore,
  EmergentRaysNovathemachine,
  AuraVortexOscillator,
  TradingmojaSqzmomAdx,
  QuantumRegressionOscillator,
  TrendStrengthDirection,
  HeikinLineTb365,
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
  ['gorgo-s-hybrid-oscillator-strategy', GorgosHybridOscillatorStrategy, 'plot0'],
  ['volume-based-rsi-color-indicator-with-mas', VolumeBasedRsiColorIndicatorWithMas, 'plot0'],
  ['sharpe-ratio-v4', SharpeRatioV4, 'plot0'],
  ['normalized-candles-rsi', NormalizedCandlesRsi, 'plot0', { plot5: 5, plot6: 5 }],
  ['adaptive-average-sentiment-oscilator', AdaptiveAverageSentimentOscilator, 'plot0'],
  ['adx-trend-visualizer-with-dual-thresholds', AdxTrendVisualizerWithDualThresholds, 'plot0'],
  ['ichimoku-kinko-hyo', IchimokuKinkoHyo, 'plot1', { plot21: 25, plot22: 25, plot23: 25, plot24: 25, plot25: 25, plot26: 25, plot27: 25 }, { plot14: 25, plot15: 25, plot16: 25, plot17: 25, plot18: 25, plot19: 25, plot20: 25, plot56: 25, plot57: 25, plot58: 25, plot59: 25, plot61: 25, plot62: 25 }],
  ['dn-macd', DnMacd, 'plot0'],
  ['pullback-sar', PullbackSar, 'plot0'],
  ['market-pulse-pro', MarketPulsePro, 'plot0'],
  ['dmi-histogram-indicator', DmiHistogramIndicator, 'plot0'],
  ['erd-effort-result-diagnostic', ErdEffortResultDiagnostic, 'plot0'],
  ['candle-buy-sell-support-resistance', CandleBuySellSupportResistance, 'plot0'],
  ['madz-moving-average-deviation-z-score', MadzMovingAverageDeviationZScore, 'plot0'],
  ['emergent-rays-novathemachine', EmergentRaysNovathemachine, 'plot0'],
  ['aura-vortex-oscillator', AuraVortexOscillator, 'plot0'],
  ['tradingmoja-sqzmom-adx', TradingmojaSqzmomAdx, 'plot0'],
  ['quantum-regression-oscillator', QuantumRegressionOscillator, 'plot0'],
  ['trend-strength-direction', TrendStrengthDirection, 'plot0'],
  ['heikin-line-tb365', HeikinLineTb365, 'plot0'],
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





