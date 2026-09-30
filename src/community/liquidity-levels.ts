/**
 * Liquidity Levels [LuxAlgo]
 *
 * Detects pivot highs in volume to identify liquidity levels.
 * On a volume pivot, records close[length] as a liquidity level.
 * Keeps the N most recent levels (sorted), draws horizontal lines,
 * and optionally shows a histogram (boxes) between level pairs
 * indicating bullish/bearish bar distribution.
 *
 * Overlay indicator.
 *
 * Reference: "Liquidity Levels [LuxAlgo]" by LuxAlgo
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LineDrawingData, BoxData } from '../types';

export interface LiquidityLevelsInputs {
  length: number;
  show: number;
  lineCol: 'Relative' | 'Random' | 'Fixed';
  lvlStyle: 'solid' | 'dashed' | 'dotted';
  relativeColUp: string;
  relativeColDn: string;
  fixedCol: string;
  showHist: boolean;
  distWin: number;
  upCol: string;
  dnCol: string;
}

export const defaultInputs: LiquidityLevelsInputs = {
  length: 20,
  show: 5,
  lineCol: 'Fixed',
  lvlStyle: 'solid',
  relativeColUp: '#2157f3',
  relativeColDn: '#ff5d00',
  fixedCol: '#2157f3',
  showHist: true,
  distWin: 200,
  upCol: 'rgba(33,87,243,0.5)',
  dnCol: 'rgba(255,93,0,0.5)',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 20, min: 1 },
  { id: 'show', type: 'int', title: 'Number Of Levels', defval: 5, min: 1 },
  { id: 'lineCol', type: 'string', title: 'Levels Color Mode', defval: 'Fixed', options: ['Relative', 'Random', 'Fixed'] },
  // Pine options '──' / '- - -' / '· · ·'
  { id: 'lvlStyle', type: 'string', title: 'Levels Style', defval: 'solid', options: ['solid', 'dashed', 'dotted'] },
  { id: 'relativeColUp', type: 'color', title: '', defval: '#2157f3' },
  { id: 'relativeColDn', type: 'color', title: '', defval: '#ff5d00' },
  { id: 'fixedCol', type: 'color', title: 'Fixed Color', defval: '#2157f3' },
  { id: 'showHist', type: 'bool', title: 'Show Histogram', defval: true },
  { id: 'distWin', type: 'int', title: 'Histogram Window', defval: 200, max: 500 },
  { id: 'upCol', type: 'color', title: 'Bins Colors', defval: 'rgba(33,87,243,0.5)' },
  { id: 'dnCol', type: 'color', title: '', defval: 'rgba(255,93,0,0.5)' },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Liquidity Levels [LuxAlgo]',
  shortTitle: 'LiqLevels',
  overlay: true,
};

export function calculate(
  bars: Bar[],
  inputs: Partial<LiquidityLevelsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { lines: LineDrawingData[]; boxes: BoxData[] } {
  const { length, show, lineCol, lvlStyle, relativeColUp, relativeColDn, fixedCol, showHist, upCol, dnCol } =
    { ...defaultInputs, ...inputs };
  const n = bars.length;

  // barstate.isfirst: one line per level, colour fixed_col or a random colour ('Random' mode)
  const lineColors: string[] = [];
  for (let i = 0; i < show; i++) {
    if (lineCol === 'Random') {
      const r = () => Math.round(Math.random() * 255);
      lineColors.push(`rgb(${r()},${r()},${r()})`);
    } else {
      lineColors.push(fixedCol);
    }
  }

  // Compute pivot highs on volume
  const volSeries = new Series(bars, (b) => b.volume ?? 0);
  const phvArr = ta.pivothigh(volSeries, length, length).toArray();

  // Collect liquidity levels: on volume pivot (`if phv`: not na and not 0), record close[length]
  const pals: number[] = [];

  for (let i = 0; i < n; i++) {
    const phv = phvArr[i];
    if (phv != null && !isNaN(phv) && phv !== 0 && i >= length) {
      // Pine: close[length] on the confirmation bar = close of the pivot bar
      pals.unshift(bars[i - length].close);
      if (pals.length > show) {
        pals.pop();
      }
    }
  }

  // Sort levels (required for histogram binary search)
  pals.sort((a, b) => a - b);

  const lines: LineDrawingData[] = [];
  const boxes: BoxData[] = [];

  if (n === 0) {
    return {
      metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
      plots: {},
      lines,
      boxes,
    };
  }

  const lastBar = bars[n - 1];

  // Levels: line from n-1 to n, extend.left, width 1; 'Relative' mode colours by close > level
  pals.forEach((lvl, index) => {
    const col = lineCol === 'Relative' ? (lastBar.close > lvl ? relativeColUp : relativeColDn) : lineColors[index];
    lines.push({
      time1: bars[Math.max(0, n - 2)].time,
      price1: lvl,
      time2: lastBar.time,
      price2: lvl,
      color: col,
      width: 1,
      style: lvlStyle,
      extend: 'left',
    });
  });

  // Histogram (show - 1 bins between adjacent levels). Pine counts, over the last distwin bars, the bullish and
  // bearish closes in each bin (array.binary_search_rightmost) and draws the bull box from bar n
  // to n + bull and the bear box from n + bull to n + bull + bear: all on bars after the last bar. The port cannot
  // give the time of a future bar and the example renderer puts any later time on the slot right after the last
  // bar, so both box ends are on the last bar and the counts give no width.
  // Boxes: between pals[index] and pals[index + 1], bgcolor upCol / dnCol, border colour na.
  if (showHist && show >= 2 && pals.length >= 2) {
    for (let i = 0; i < Math.min(show - 1, pals.length - 1); i++) {
      boxes.push({ time1: lastBar.time, price1: pals[i + 1], time2: lastBar.time, price2: pals[i], bgColor: upCol });
      boxes.push({ time1: lastBar.time, price1: pals[i + 1], time2: lastBar.time, price2: pals[i], bgColor: dnCol });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    lines,
    boxes,
  };
}

export const LiquidityLevels = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
