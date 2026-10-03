/**
 * WaveFunction MACD
 *
 * MACD line = fast MA - slow MA of the close (SMA, EMA or WMA). A phase angle comes from a detrended close:
 * detrender = close - ema(close, 4); phase = ema(detrender - ema(detrender, 4), 4); angle = atan(phase / close) in
 * degrees, smoothed by an EMA. Energy = MACD * cos(smoothed angle); the signal line is an EMA of the energy and the
 * histogram is energy - signal, coloured by sign and direction. Dots mark the crossings of the MACD line and the
 * signal line.
 *
 * Reference: "WaveFunction MACD (TechnoBlooms)" by TechnoBlooms
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: This indicator is created under TechnoBlooms - Innovating Trading Indicators and Strategies.
 * All rights reserved. Unauthorized copying or distribution is prohibited. © TechnoBlooms
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export type WaveFunctionMacdMaType = 'SMA' | 'EMA' | 'WMA';

export interface WaveFunctionMacdInputs {
  /** Moving average type of the fast / slow MAs */
  maType: WaveFunctionMacdMaType;
  fastLength: number;
  slowLength: number;
  /** EMA length of the signal line */
  signalLength: number;
  /** EMA length of the phase angle */
  phaseSmoothing: number;
}

export const defaultInputs: WaveFunctionMacdInputs = {
  maType: 'WMA',
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  phaseSmoothing: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'Moving Average Type', defval: 'WMA', options: ['SMA', 'EMA', 'WMA'] },
  { id: 'fastLength', type: 'int', title: 'Fast MA Length', defval: 12 },
  { id: 'slowLength', type: 'int', title: 'Slow MA Length', defval: 26 },
  { id: 'signalLength', type: 'int', title: 'Signal Smoothing Length', defval: 9 },
  { id: 'phaseSmoothing', type: 'int', title: 'Phase Shift Smoothing Length', defval: 5 },
];

const MACD_COLOR = String(color.rgb(33, 243, 226));
const SIGNAL_COLOR = String(color.rgb(211, 12, 255));
const STRONG_BULL = String(color.rgb(180, 198, 22));
const WEAK_BULL = String(color.rgb(223, 246, 19));
const STRONG_BEAR = '#bf1e7c';
const WEAK_BEAR = '#ff0f9b';
const BULL_DOT = String(color.rgb(51, 255, 0));
const BEAR_DOT = String(color.rgb(255, 0, 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Quantum MACD Line', color: MACD_COLOR, lineWidth: 1 },
  { id: 'plot1', title: 'Phase Signal Line', color: SIGNAL_COLOR, lineWidth: 1 },
  { id: 'plot2', title: 'Energy Histogram', color: color.gray, lineWidth: 1, style: 'columns' },
  { id: 'plot3', title: 'Bullish Dot', color: BULL_DOT, lineWidth: 3, style: 'circles' },
  { id: 'plot4', title: 'Bearish Dot', color: BEAR_DOT, lineWidth: 3, style: 'circles' },
];

export const metadata = {
  title: 'WaveFunction MACD (TechnoBlooms)',
  shortTitle: 'WaveFunction MACD (TechnoBlooms)',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(bars: Bar[], inputs: Partial<WaveFunctionMacdInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => (v === null || v === undefined ? NaN : v));
  const S = (a: number[]) => Series.fromArray(bars, a);
  const closeArr = bars.map((b) => b.close);
  const close = S(closeArr);

  const ma = (src: Series, length: number): number[] => {
    switch (cfg.maType) {
      case 'SMA': return A(ta.sma(src, length));
      case 'EMA': return A(ta.ema(src, length));
      default: return A(ta.wma(src, length));
    }
  };

  // Core MACD
  const fastMa = ma(close, cfg.fastLength);
  const slowMa = ma(close, cfg.slowLength);
  const macdLine = fastMa.map((f, i) => f - slowMa[i]);

  // Phase shift: detrender = close - ema(close, 4); phaseComponent = ema(detrender - ema(detrender, 4), 4)
  const ema4 = A(ta.ema(close, 4));
  const detrender = closeArr.map((c, i) => c - ema4[i]);
  const detrenderEma = A(ta.ema(S(detrender), 4));
  const phaseComponent = A(ta.ema(S(detrender.map((d, i) => d - detrenderEma[i])), 4));
  // phaseShift = math.atan(phaseComponent / close) * (180 / math.pi)
  const phaseShift = phaseComponent.map((p, i) => Math.atan(p / closeArr[i]) * (180 / Math.PI));
  const smoothedPhase = A(ta.ema(S(phaseShift), cfg.phaseSmoothing));

  // energy = macdLine * math.cos(smoothedPhase * math.pi / 180); signalLine = ema(energy, signalLength)
  const energy = macdLine.map((m, i) => m * Math.cos((smoothedPhase[i] * Math.PI) / 180));
  const signalLine = A(ta.ema(S(energy), cfg.signalLength));
  const histogram = energy.map((e, i) => e - signalLine[i]);

  // ta.crossover / ta.crossunder (exact comparisons, with the last bar where both values were not na)
  const macdS = S(macdLine);
  const signalS = S(signalLine);
  const bullishCross = A(ta.crossover(macdS, signalS));
  const bearishCross = A(ta.crossunder(macdS, signalS));

  const plot0 = [];
  const plot1 = [];
  const plot2 = [];
  const plot3 = [];
  const plot4 = [];
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    const h = histogram[i];
    const prevH = i > 0 ? histogram[i - 1] : NaN;
    const isBullish = gt(h, 0);
    const isBearish = lt(h, 0);
    const isRising = gt(h, prevH);
    const isFalling = lt(h, prevH);
    const histColor = isBullish && isRising ? STRONG_BULL
      : isBullish && isFalling ? WEAK_BULL
        : isBearish && isFalling ? STRONG_BEAR
          : isBearish && isRising ? WEAK_BEAR
            : color.gray;
    plot0.push({ time: t, value: macdLine[i] });
    plot1.push({ time: t, value: signalLine[i] });
    plot2.push({ time: t, value: h, color: histColor });
    plot3.push({ time: t, value: bullishCross[i] === 1 ? macdLine[i] : NaN });
    plot4.push({ time: t, value: bearishCross[i] === 1 ? macdLine[i] : NaN });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2, plot3, plot4 },
    hlines: [{ value: 0, options: { title: 'Zero Line', color: color.gray, linestyle: 'dashed' } }],
  };
}

export const WaveFunctionMacd = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
