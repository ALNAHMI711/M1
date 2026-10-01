/**
 * Renko Mod
 *
 * A renko brick line on the price bars. The brick open starts at 0 and moves by one brick size per bar: up when the
 * close or the high is more than one brick above the previous brick open, down when the close or the low is more
 * than one brick below it, else it stays. The brick close is one brick behind the open after a move and keeps its
 * value otherwise. The open is drawn as crosses (green after an up move, maroon after a down move), the close as
 * gray circles.
 *
 * Reference: "Renko Mod" by RicardoSantos
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © RicardoSantos
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface RenkoModInputs {
  /** Brick size */
  bricksize: number;
}

export const defaultInputs: RenkoModInputs = {
  bricksize: 0.0005,
};

export const inputConfig: InputConfig[] = [
  { id: 'bricksize', type: 'float', title: 'Brick Size:', defval: 0.0005 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Renko Open', color: color.green, lineWidth: 3, style: 'cross' },
  { id: 'plot1', title: 'Renko Close', color: color.gray, lineWidth: 2, style: 'circles' },
];

export const metadata = {
  title: 'Renko Mod',
  shortTitle: 'Rm',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;
const nz = (x: number) => (isNaN(x) ? 0 : x);

export function calculate(bars: Bar[], inputs: Partial<RenkoModInputs> = {}): IndicatorResult {
  const { bricksize } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const ropen: number[] = new Array(n);
  const rclose: number[] = new Array(n);
  const direction: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const { close, high, low } = bars[i];
    const propen = nz(i > 0 ? ropen[i - 1] : NaN);
    const up = propen + bricksize;
    const down = propen - bricksize;
    ropen[i] = gt(close, up) || gt(high, up) ? up : lt(close, down) || lt(low, down) ? down : propen;
    const prevClose = nz(i > 0 ? rclose[i - 1] : NaN);
    const prevDir = nz(i > 0 ? direction[i - 1] : NaN);
    rclose[i] = gt(ropen[i], propen) ? ropen[i] - bricksize : lt(ropen[i], propen) ? ropen[i] + bricksize : prevClose;
    direction[i] = gt(ropen[i], propen) ? 1 : lt(ropen[i], propen) ? -1 : prevDir;
  }

  // rc = direction == 1 ? color.green : direction == -1 ? color.maroon : na
  const rc = (d: number) => (d === 1 ? color.green : d === -1 ? color.maroon : 'transparent');

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      // plot(ropen, '', rc, 3, plot.style_cross)
      plot0: bars.map((b, i) => ({ time: b.time, value: ropen[i], color: rc(direction[i]) })),
      // plot(rclose, '', color.gray, 2, plot.style_circles)
      plot1: bars.map((b, i) => ({ time: b.time, value: rclose[i], color: color.gray })),
    },
  };
}

export const RenkoMod = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
