/**
 * Unit tests for the community batch 26 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import {
  TradingGaul,
  RsiStochBandOscillator,
  AlmaBands,
  EllipticCurveSar,
  PerfectRsi,
  PercentileRankOscillator,
  AggressiveVolume,
  GoldenDeathCrossWithReActivation,
  TfoAdxWithHistogramSignal,
  VolVol,
  AiTradingAssistantV2,
  VolumeBuySellSplit,
  SpiraAlligator,
  Tasc202601TheReversionIndex,
  IchimokuAceClub,
  TrendDoublePullbackV10,
  RsiAdxAtrCombo,
  MacdAdxProByEternyworld,
  CabalDevIndicator,
  VolumeComparisonWithBuyerSellerPressure,
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
  ['trading-gaul', TradingGaul, 'plot0'],
  ['rsi-stoch-band-oscillator', RsiStochBandOscillator, 'plot0'],
  ['alma-bands', AlmaBands, 'plot0'],
  ['elliptic-curve-sar', EllipticCurveSar, 'plot0'],
  ['perfect-rsi', PerfectRsi, 'plot0'],
  ['percentile-rank-oscillator', PercentileRankOscillator, 'plot0'],
  ['aggressive-volume', AggressiveVolume, 'plot0'],
  ['golden-death-cross-with-re-activation', GoldenDeathCrossWithReActivation, 'plot0'],
  ['tfo-adx-with-histogram-signal', TfoAdxWithHistogramSignal, 'plot0'],
  ['volvol', VolVol, 'plot0'],
  ['ai-trading-assistant-v2', AiTradingAssistantV2, 'plot0'],
  ['volume-buy-sell-split', VolumeBuySellSplit, 'plot0'],
  ['spira-alligator', SpiraAlligator, 'plot0', undefined, { plot1: 3, plot2: 5, plot3: 8 }],
  ['tasc-2026-01-the-reversion-index', Tasc202601TheReversionIndex, 'plot0'],
  ['ichimoku-ace-club', IchimokuAceClub, 'plot0', { plot4: 26 }, { plot5: 26, plot6: 26 }, ['plot7', 'plot8', 'plot9', 'plot10', 'plot11', 'plot12', 'plot13', 'plot14', 'plot15', 'plot16', 'plot17', 'plot18', 'plot19', 'plot20', 'plot21', 'plot22', 'plot23', 'plot24', 'plot25', 'plot26', 'plot27', 'plot28', 'plot29', 'plot30', 'plot31', 'plot32', 'plot33', 'plot34', 'plot35', 'plot36', 'plot37', 'plot38', 'plot39', 'plot40', 'plot41', 'plot42', 'plot43', 'plot44', 'plot45', 'plot46', 'plot47', 'plot48', 'plot49', 'plot50']],
  ['trend-double-pullback-v1-0', TrendDoublePullbackV10, 'plot0'],
  ['rsi-adx-atr-combo', RsiAdxAtrCombo, 'plot0'],
  ['macd-adx-pro-by-eternyworld', MacdAdxProByEternyworld, 'plot0'],
  ['cabal-dev-indicator', CabalDevIndicator, 'plot0'],
  ['volume-comparison-with-buyer-seller-pressure', VolumeComparisonWithBuyerSellerPressure, 'plot0'],
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





