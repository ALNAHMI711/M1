/**
 * Median ATR SD Oscillator
 *
 * Median = 50th percentile (nearest rank) of the source over the median length. Upper SD level = median +
 * stdev(close, SD length); ATR level = median + ATR(ATR length) * factor. The trend turns 1 when the close is above
 * the SD level and -1 when it is below the ATR level (the second rule wins on the same bar). The oscillator is
 * close - ATR level in an up trend, else close - SD level, with an EMA. The hold state is 1 / -1 when the trend
 * agrees with the oscillator position against its EMA (or with the trend alone when the EMA filter is off), and
 * colours the area, the bars and an optional background on the price pane.
 *
 * Reference: "Median ATR SD Oscillator" by Unknownhodler
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Unknownhodler
 */

import { ta, Series, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData, BgColorData } from '../types';

export interface MedianAtrSdOscillatorInputs {
  /** Source of the median */
  medSrc: SourceType;
  /** Median length */
  medLen: number;
  /** ATR length */
  atrLen: number;
  /** ATR factor */
  atrFactor: number;
  /** Standard deviation length */
  sdLen: number;
  /** EMA filter of the hold state */
  useEma: boolean;
  /** EMA length */
  emaLen: number;
  /** Colour the bars */
  barColoring: boolean;
  /** Colour the background of the price pane */
  ShowBGCol: boolean;
  /** Background transparency */
  Transparency: number;
}

export const defaultInputs: MedianAtrSdOscillatorInputs = {
  medSrc: 'hl2',
  medLen: 63,
  atrLen: 4,
  atrFactor: 1,
  sdLen: 29,
  useEma: true,
  emaLen: 35,
  barColoring: true,
  ShowBGCol: false,
  Transparency: 85,
};

export const inputConfig: InputConfig[] = [
  { id: 'medSrc', type: 'source', title: 'Median Source', defval: 'hl2' },
  { id: 'medLen', type: 'int', title: 'Median Length', defval: 63, min: 1 },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 4, min: 1 },
  { id: 'atrFactor', type: 'float', title: 'ATR Factor', defval: 1, min: 0.05, step: 0.05 },
  { id: 'sdLen', type: 'int', title: 'SD Length', defval: 29, min: 1 },
  { id: 'useEma', type: 'bool', title: 'Use EMA', defval: true },
  { id: 'emaLen', type: 'int', title: 'EMA Length', defval: 35, min: 2 },
  { id: 'barColoring', type: 'bool', title: 'Use Bar Coloring?', defval: true },
  { id: 'ShowBGCol', type: 'bool', title: 'Color Background', defval: false },
  { id: 'Transparency', type: 'int', title: 'Background Transparency', defval: 85, min: 0, max: 100 },
];

const LONG = 'rgb(0, 200, 255)';
const SHORT = 'rgb(255, 0, 0)';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Oscillator', color: LONG, lineWidth: 2, style: 'area' },
  { id: 'plot1', title: 'EMA', color: 'rgb(255, 255, 255)', lineWidth: 2 },
  { id: 'plot2', title: 'Zero Line', color: color.gray, lineWidth: 2, style: 'stepline' },
];

export const metadata = {
  title: 'Median ATR SD Oscillator',
  shortTitle: 'Median ATR SD Oscillator',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<MedianAtrSdOscillatorInputs> = {},
): IndicatorResult & { barColors: BarColorData[]; bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const closeArr = bars.map((b) => b.close);

  const median = A(ta.percentile_nearest_rank(getSourceSeries(bars, cfg.medSrc), cfg.medLen, 50));
  const atrRaw = A(ta.atr(bars, cfg.atrLen));
  const stdev = A(ta.stdev(S(closeArr), cfg.sdLen));

  const diff: number[] = new Array(n);
  const atrLvl: number[] = new Array(n);
  const sdLvl: number[] = new Array(n);
  let trend = 0; // var trend = 0
  const trendArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    atrLvl[i] = median[i] + atrRaw[i] * cfg.atrFactor;
    sdLvl[i] = median[i] + stdev[i];
    if (gt(closeArr[i], sdLvl[i])) trend = 1;
    if (lt(closeArr[i], atrLvl[i])) trend = -1;
    trendArr[i] = trend;
    diff[i] = trend === 1 ? closeArr[i] - atrLvl[i] : closeArr[i] - sdLvl[i];
  }
  const ema = A(ta.ema(S(diff), cfg.emaLen));

  const bgLong = String(color.new(LONG, cfg.Transparency));
  const bgShort = String(color.new(SHORT, cfg.Transparency));
  const plot0: { time: number; value: number; color: string }[] = [];
  const plot1: { time: number; value: number; color: string }[] = [];
  const plot2: { time: number; value: number; color: string }[] = [];
  const barColors: BarColorData[] = [];
  const bgColors: BgColorData[] = [];
  let hodl = 0; // var hodl = 0
  for (let i = 0; i < n; i++) {
    const t = bars[i].time as number;
    const tr = trendArr[i];
    if (cfg.useEma) {
      hodl = tr === 1 && gt(diff[i], ema[i]) ? 1 : tr === -1 && lt(diff[i], ema[i]) ? -1 : hodl;
    } else {
      hodl = tr === 1 ? 1 : tr === -1 ? -1 : hodl;
    }
    plot0.push({ time: t, value: diff[i], color: hodl === 1 ? LONG : SHORT });
    plot1.push({ time: t, value: ema[i], color: 'rgb(255, 255, 255)' });
    plot2.push({ time: t, value: 0, color: color.gray });
    // barcolor(barColoring and hodl == 1 ? long : barColoring and hodl == -1 ? short : na)
    if (cfg.barColoring && hodl === 1) barColors.push({ time: t, color: LONG });
    else if (cfg.barColoring && hodl === -1) barColors.push({ time: t, color: SHORT });
    // bgcolor(hodl == 1 ? color.new(long, Transparency) : color.new(short, Transparency), force_overlay = true,
    //         display = ShowBGCol ? display.all : display.none)
    if (cfg.ShowBGCol) bgColors.push({ time: t, color: hodl === 1 ? bgLong : bgShort, forceOverlay: true });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2 },
    barColors,
    bgColors,
  };
}

export const MedianAtrSdOscillator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
