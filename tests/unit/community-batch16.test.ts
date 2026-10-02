/**
 * Unit tests for the community batch 16 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import {
  KalmanEmaCrosses,
  EmaInflectionZonesKorax,
  FisherVolumeTransformAlphanatt,
  EMAOscillator,
  ThreeConfirmationBear,
  TripleGaussianSmoothedRibbon,
  PriceAdvanceDeclineRangeAnalysis,
  FibonacciHhLlTramaBand,
  MslSqueezePulse,
  VolumeAndVolatilityRatioIndicatorWodi,
  BuyingAndSellingVolumePressureSR,
  RsRating,
  MonotonicTrendConsensus,
  BollingerAdaptiveTrendNavigator,
  UptrickMultiMaVolume,
  CrtIndicator,
  StatisticalPriceDeviationIndex,
  TrendDirectionZone,
  Level2SignalfilterLiquidityProtection,
  SqueezeChannel,
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
const ports: Array<[string, Port, string, Record<string, number>?, Record<string, number>?]> = [
  ['kalman-ema-crosses', KalmanEmaCrosses, 'plot0'],
  ['12-26-ema-inflection-zones-by-korax', EmaInflectionZonesKorax, 'plot0'],
  ['fisher-volume-transform-alphanatt', FisherVolumeTransformAlphanatt, 'plot0'],
  ['ema-oscillator', EMAOscillator, 'plot0'],
  ['3-confirmation-bear', ThreeConfirmationBear, 'plot0'],
  ['triple-gaussian-smoothed-ribbon', TripleGaussianSmoothedRibbon, 'plot0'],
  ['price-advance-decline-range-analysis', PriceAdvanceDeclineRangeAnalysis, 'plot0'],
  ['fibonacci-hh-ll-trama-band', FibonacciHhLlTramaBand, 'plot0'],
  ['msl-squeeze-pulse', MslSqueezePulse, 'plot0'],
  ['volume-and-volatility-ratio-indicator-wodi', VolumeAndVolatilityRatioIndicatorWodi, 'plot0'],
  ['buying-and-selling-volume-pressure-s-r', BuyingAndSellingVolumePressureSR, 'plot0'],
  ['rs-rating', RsRating, 'plot0'],
  ['monotonic-trend-consensus', MonotonicTrendConsensus, 'plot0'],
  ['bollinger-adaptive-trend-navigator', BollingerAdaptiveTrendNavigator, 'plot0'],
  ['uptrick-multima-volume', UptrickMultiMaVolume, 'plot0'],
  ['crt-indicator', CrtIndicator, ''],
  ['statistical-price-deviation-index', StatisticalPriceDeviationIndex, 'plot0'],
  ['trend-direction-zone', TrendDirectionZone, 'plot0'],
  ['level2-signalfilter-liquidity-protection', Level2SignalfilterLiquidityProtection, 'plot0'],
  ['squeeze-channel', SqueezeChannel, 'plot0'],
];

describe.each(ports)('%s', (id, port, mainPlot, leftOffsets, rightOffsets) => {
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
    // '': the fixture has no case of the pattern (crt-indicator draws only on CRT setups)
    if (mainPlot === '') return;
    // 'candles': the main output is the plotcandle series
    const vals = mainPlot === 'candles'
      ? (Object.values(result.plotCandles)[0] as Array<{ close: number }>).map((c) => c.close).filter((v) => !isNaN(v))
      : (result.plots[mainPlot] as Array<{ value: number }>).map((p) => p.value).filter((v) => !isNaN(v));
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => expect(isFinite(v)).toBe(true));
  });
});
