/**
 * Renko Boxes
 *
 * A Renko brick of ATR(atrLength) * atrMult is built on the close. The brick starts at the close of the first bar
 * after the ATR length (upper = close, lower = close - brick). Up bricks: a close above upper + brick moves the
 * brick up by the whole number of bricks between the upper level and the close; a close below lower - brick
 * reverses down by the whole number of bricks between the lower level and the close (and the other way round in
 * a down trend). The upper and lower levels are drawn with a fill between them, cut on the bars where they change;
 * the brick middle is drawn as a line with dots on the direction changes.
 *
 * Reference: "Renko Boxes [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { ta, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface RenkoBoxesInputs {
  atrLength: number;
  atrMult: number;
  bullColor: string;
  bearColor: string;
  /** Transparency of the box fill */
  fillTransp: number;
}

export const defaultInputs: RenkoBoxesInputs = {
  atrLength: 200,
  atrMult: 1.0,
  bullColor: '#089981',
  bearColor: '#f23645',
  fillTransp: 90,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 200, min: 1 },
  { id: 'atrMult', type: 'float', title: 'ATR Multiplier', defval: 1.0, min: 0.1, step: 0.1 },
  { id: 'bullColor', type: 'color', title: 'Bullish Color', defval: '#089981' },
  { id: 'bearColor', type: 'color', title: 'Bearish Color', defval: '#f23645' },
  { id: 'fillTransp', type: 'int', title: 'Transparency', defval: 90, min: 0, max: 100 },
];

export const plotConfig: PlotConfig[] = [
  // Pine linestyle = plot.linestyle_dotted: PlotConfig has no line style, drawn solid
  { id: 'plot0', title: 'Renko Average', color: '#089981', lineWidth: 1 },
  { id: 'plot1', title: 'Reversal Dots', color: '#089981', lineWidth: 2, style: 'circles' },
  { id: 'plot2', title: 'Renko Upper', color: '#089981', lineWidth: 1, style: 'linebr' },
  { id: 'plot3', title: 'Renko Lower', color: '#089981', lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'Renko Boxes [LuxAlgo]',
  shortTitle: 'LuxAlgo - Renko Boxes',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
/** Pine a != b: false when a or b is na */
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;

export function calculate(bars: Bar[], inputs: Partial<RenkoBoxesInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const atr = ta.atr(bars, cfg.atrLength).toArray().map((v) => v ?? NaN);

  const upper: number[] = new Array(n);
  const lower: number[] = new Array(n);
  const dir: number[] = new Array(n);
  let renkoUpper = NaN; // var float renkoUpper = na
  let renkoLower = NaN;
  let direction = 0; // var int direction = 0
  for (let i = 0; i < n; i++) {
    const close = bars[i].close;
    const brickSize = atr[i] * cfg.atrMult;
    // if bar_index > atrLengthInput (bar_index: bars from the first bar of the data)
    if (i > cfg.atrLength) {
      if (isNaN(renkoUpper)) {
        renkoUpper = close;
        renkoLower = close - brickSize;
        direction = 1;
      } else {
        const upThreshold = renkoUpper + brickSize;
        const downThreshold = renkoLower - brickSize;
        const up = () => {
          const numBricks = Math.floor((close - renkoUpper) / brickSize);
          renkoLower = renkoUpper + (numBricks - 1) * brickSize;
          renkoUpper = renkoUpper + numBricks * brickSize;
        };
        const down = () => {
          const numBricks = Math.floor((renkoLower - close) / brickSize);
          renkoUpper = renkoLower - (numBricks - 1) * brickSize;
          renkoLower = renkoLower - numBricks * brickSize;
        };
        if (direction === 1) {
          if (gt(close, upThreshold)) up();
          else if (gt(downThreshold, close)) {
            down();
            direction = -1;
          }
        } else if (gt(downThreshold, close)) {
          down();
        } else if (gt(close, upThreshold)) {
          up();
          direction = 1;
        }
      }
    }
    upper[i] = renkoUpper;
    lower[i] = renkoLower;
    dir[i] = direction;
  }

  const avg: number[] = new Array(n);
  const plotColor: string[] = new Array(n);
  const changed: boolean[] = new Array(n);
  const reversed: boolean[] = new Array(n);
  for (let i = 0; i < n; i++) {
    // isChanged = renkoUpper != renkoUpper[1] or renkoLower != renkoLower[1]
    changed[i] = i > 0 && (ne(upper[i], upper[i - 1]) || ne(lower[i], lower[i - 1]));
    // isReversed = ta.change(direction) != 0 (na on the first bar)
    reversed[i] = i > 0 && dir[i] !== dir[i - 1];
    avg[i] = (upper[i] + lower[i]) / 2.0;
    plotColor[i] = dir[i] === 1 ? cfg.bullColor : cfg.bearColor;
  }
  // finalColor = isChanged ? na : plotColor
  const finalColor = (i: number) => (changed[i] ? 'transparent' : plotColor[i]);

  const time = (i: number) => bars[i].time;
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((_b, i) => ({ time: time(i), value: avg[i], color: plotColor[i] })),
      plot1: bars.map((_b, i) => ({ time: time(i), value: reversed[i] ? avg[i] : NaN, color: plotColor[i] })),
      plot2: bars.map((_b, i) => ({ time: time(i), value: upper[i], color: finalColor(i) })),
      plot3: bars.map((_b, i) => ({ time: time(i), value: lower[i], color: finalColor(i) })),
    },
    // fill(p1, p2, isChanged ? na : color.new(plotColor, fillTransp), "Renko Box Fill")
    fills: [{
      plot1: 'plot2',
      plot2: 'plot3',
      options: { title: 'Renko Box Fill' },
      colors: bars.map((_b, i) => (changed[i] ? 'transparent' : String(color.new(plotColor[i], cfg.fillTransp)))),
    }],
  };
}

export const RenkoBoxes = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
