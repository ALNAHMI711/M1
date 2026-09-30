/**
 * Volume Positive Negative (VPN)
 *
 * Over the period, the volume of the bars whose typical price (hlc3) rises by more than a fraction of the ATR is
 * positive volume, the volume of the bars whose typical price falls by more than that fraction is negative volume.
 * VPN = (positive - negative volume) / average volume / period * 100, smoothed by an EMA(3). The line and the cloud
 * to the critical value line are green above the critical value and red below it; an SMA or EMA of VPN is drawn
 * as a moving average. Based on the article "Detecting High-Volume Breakouts" by Markos Katsanos (Technical
 * Analysis of Stocks & Commodities, April 2021).
 *
 * Reference: "Volume Positive Negative (VPN) [LevelUp]" by LevelUpTools
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface VolumePositiveNegativeInputs {
  /** Period length */
  period: number;
  /** Critical value line level */
  criticalValue: number;
  criticalValueColor: string;
  criticalValueWidth: number;
  /** Signal line colour above the critical value */
  upColor: string;
  /** Signal line colour below the critical value */
  downColor: string;
  lineWidth: number;
  /** Cloud (fill) between the critical value line and the VPN line */
  fill: boolean;
  /** Fraction of the ATR a typical price move must exceed */
  atrFraction: number;
  /** Show the moving average */
  maVisible: boolean;
  maLength: number;
  maType: 'SMA' | 'EMA';
  maColor: string;
  maWidth: number;
}

export const defaultInputs: VolumePositiveNegativeInputs = {
  period: 30,
  criticalValue: 10,
  criticalValueColor: '#c5c5c5',
  criticalValueWidth: 1,
  upColor: String(color.rgb(83, 167, 87, 70)),
  downColor: String(color.rgb(247, 90, 90, 70)),
  lineWidth: 2,
  fill: true,
  atrFraction: 0.1,
  maVisible: true,
  maLength: 30,
  maType: 'SMA',
  maColor: String(color.new('#858b94', 44)),
  maWidth: 1,
};

export const inputConfig: InputConfig[] = [
  { id: 'period', type: 'int', title: 'Period Length', defval: 30, min: 10, max: 50 },
  { id: 'criticalValue', type: 'int', title: 'Critical Value Line', defval: 10, min: 0, max: 20 },
  { id: 'criticalValueColor', type: 'color', title: 'Critical Value Line Color', defval: defaultInputs.criticalValueColor },
  { id: 'criticalValueWidth', type: 'int', title: 'Critical Value Line Width', defval: 1, min: 1, max: 4 },
  { id: 'upColor', type: 'color', title: 'Signal Line Up', defval: defaultInputs.upColor },
  { id: 'downColor', type: 'color', title: 'Signal Line Down', defval: defaultInputs.downColor },
  { id: 'lineWidth', type: 'int', title: 'Signal Line Width', defval: 2, min: 1, max: 4 },
  { id: 'fill', type: 'bool', title: 'Cloud', defval: true },
  { id: 'atrFraction', type: 'float', title: 'Fraction of ATR', defval: 0.1, min: 0, max: 0.9, step: 0.1 },
  { id: 'maVisible', type: 'bool', title: 'Show Moving Average', defval: true },
  { id: 'maLength', type: 'int', title: 'Moving Average Length', defval: 30, min: 1, max: 200 },
  { id: 'maType', type: 'string', title: 'Moving Average Type', defval: 'SMA', options: ['SMA', 'EMA'] },
  { id: 'maColor', type: 'color', title: 'Moving Average Color', defval: defaultInputs.maColor },
  { id: 'maWidth', type: 'int', title: 'Moving Average Width', defval: 1, min: 1, max: 4 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Critical Value Line', color: '#c5c5c5', lineWidth: 1 },
  { id: 'plot1', title: 'VPN', color: defaultInputs.upColor, lineWidth: 2 },
  { id: 'plot2', title: 'Moving Average', color: defaultInputs.maColor, lineWidth: 1 },
];

export const metadata = {
  title: 'Volume Positive Negative (VPN)',
  shortTitle: 'VPN v4.0',
  overlay: false,
};

export function calculate(
  bars: Bar[],
  inputs: Partial<VolumePositiveNegativeInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const period = cfg.period;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  const hlc3 = bars.map((b) => (b.high + b.low + b.close) / 3);
  const volume = bars.map((b) => b.volume ?? NaN);
  const at = (a: number[], j: number) => (j >= 0 ? a[j] : NaN);

  // f_VPN(_period): dist = ta.atr(_period) * iATR; for i = 0 to _period - 1:
  //   hlc3[i] > hlc3[i + 1] + dist -> vp += volume[i]; else hlc3[i] < hlc3[i + 1] - dist -> vn += volume[i]
  //   vtot += volume[i]
  // (vp - vn) / (vtot / _period) / _period * 100   (a comparison with na is false; x / 0 is na)
  const atr = A(ta.atr(bars, period));
  const raw: number[] = new Array(n);
  for (let k = 0; k < n; k++) {
    const dist = atr[k] * cfg.atrFraction;
    let vp = 0;
    let vn = 0;
    let vtot = 0;
    for (let i = 0; i <= period - 1; i++) {
      const h0 = at(hlc3, k - i);
      const h1 = at(hlc3, k - i - 1);
      const v = at(volume, k - i);
      if (h0 > h1 + dist) vp = vp + v;
      else if (h0 < h1 - dist) vn = vn + v;
      vtot = vtot + v;
    }
    const avg = vtot / period;
    raw[k] = avg === 0 || isNaN(avg) ? NaN : (vp - vn) / avg / period * 100;
  }

  // vpn = ta.ema(f_VPN(iPeriod), 3)
  const vpn = A(ta.ema(S(raw), 3));
  // movingAverage = iMAType == 'SMA' ? ta.sma(vpn, iMALength) : ta.ema(vpn, iMALength)
  const ma = A(cfg.maType === 'SMA' ? ta.sma(S(vpn), cfg.maLength) : ta.ema(S(vpn), cfg.maLength));

  const critical: { time: number; value: number; color: string }[] = [];
  const line: { time: number; value: number; color: string }[] = [];
  const maPlot: { time: number; value: number; color: string }[] = [];
  const fillColors: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    // lColor = vpn > iCriticalValueLine ? iUpColor : iDownColor
    const lColor = vpn[i] > cfg.criticalValue ? cfg.upColor : cfg.downColor;
    critical.push({ time: t, value: cfg.criticalValue, color: cfg.criticalValueColor });
    line.push({ time: t, value: vpn[i], color: lColor });
    // plot(iMAVisible ? movingAverage : na, color = iMAColor)
    maPlot.push({ time: t, value: cfg.maVisible ? ma[i] : NaN, color: cfg.maColor });
    // fill(plot1, plot2, color = iFill ? lColor : na)
    fillColors.push(cfg.fill ? lColor : 'transparent');
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: critical, plot1: line, plot2: maPlot },
    fills: [{ plot1: 'plot0', plot2: 'plot1', colors: fillColors }],
    markers: [],
  };
}

export const VolumePositiveNegative = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
