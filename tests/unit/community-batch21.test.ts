/**
 * Unit tests for the community batch 21 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import {
  IntradayVsOvernightObv,
  EuclideanRange,
  NeighboringPriceBands,
  HeikenAshiRibbon,
  IctRtmPriceActionIndicator,
  LorentzianLengthAdaptiveMovingAverage,
  DynamicFractalFlow,
  Blacklab84Panel,
  RrrEmaIgnitionBuySell,
  PeakReversalV3,
  ZScore,
  AdaptiveConvergenceDivergence,
  RobbyDssBressertColoredDots,
  BuysellVolumeBarChart,
  AlPoSArithmeticMean,
  SmaAngleAlerts,
  AssetRiskMetrics,
  SmartTrend,
  ThreeConfirmationBull,
  BuyOnVolume,
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
  ['intraday-vs-overnight-obv', IntradayVsOvernightObv, 'plot0'],
  ['euclidean-range', EuclideanRange, 'plot1'],
  ['neighboring-price-bands', NeighboringPriceBands, 'plot0'],
  ['heiken-ashi-ribbon', HeikenAshiRibbon, 'plot0'],
  ['ict-rtm-price-action-indicator', IctRtmPriceActionIndicator, 'plot0'],
  ['lorentzian-length-adaptive-moving-average', LorentzianLengthAdaptiveMovingAverage, 'plot0'],
  ['dynamic-fractal-flow', DynamicFractalFlow, 'plot0'],
  ['blacklab84-panel', Blacklab84Panel, 'plot0', { plot4: 10, plot5: 10, plot6: 10, plot7: 10 }],
  ['rrr-ema-ignition-buy-sell', RrrEmaIgnitionBuySell, 'plot0'],
  ['peak-reversal-v3', PeakReversalV3, 'plot0'],
  ['z-score', ZScore, 'plot0'],
  ['adaptive-convergence-divergence', AdaptiveConvergenceDivergence, 'plot0'],
  ['robby-dss-bressert-colored-dots', RobbyDssBressertColoredDots, 'plot0'],
  ['buysell-volume-bar-chart', BuysellVolumeBarChart, 'plot0'],
  ['al-po-s-arithmetic-mean', AlPoSArithmeticMean, 'plot0'],
  ['sma-angle-alerts', SmaAngleAlerts, 'plot0'],
  ['asset-risk-metrics', AssetRiskMetrics, ''],
  ['smart-trend', SmartTrend, 'plot0'],
  ['3-confirmation-bull', ThreeConfirmationBull, 'plot0'],
  ['buy-on-volume', BuyOnVolume, 'plot0'],
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
    // '': no value on the fixture with default inputs (asset-risk-metrics: the output is markers; the ATH line is off by default)
    if (mainPlot === '') return;
    // 'candles': the main output is the plotcandle series
    const vals = mainPlot === 'candles'
      ? (Object.values(result.plotCandles)[0] as Array<{ close: number }>).map((c) => c.close).filter((v) => !isNaN(v))
      : (result.plots[mainPlot] as Array<{ value: number }>).map((p) => p.value).filter((v) => !isNaN(v));
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => expect(isFinite(v)).toBe(true));
  });
});




describe('asset-risk-metrics timeframe limit', () => {
  it('throws on intraday bars (ta.vwap needs the exchange session there)', () => {
    const hourly = bars.slice(0, 200).map((b, i) => ({ ...b, time: 1262304000 + i * 3600 }));
    expect(() => AssetRiskMetrics.calculate(hourly, {})).toThrow();
  });

  it('accepts weekly bars', () => {
    const weekly = bars.slice(0, 200).map((b, i) => ({ ...b, time: 1262304000 + i * 7 * 86400 }));
    expect(() => AssetRiskMetrics.calculate(weekly, {})).not.toThrow();
  });
});
