/**
 * Volume Profile Heatmap [KEYALGOS]
 *
 * On every bar a volume profile of the last `lookback` bars: the range from the lowest low to the highest high is cut
 * into `numRows` rows, and the volume of each bar (all bars, or only up / down bars) is shared equally between the
 * rows its low..high range touches. The POC is the row with the most volume; the value area grows from the POC
 * towards the larger neighbour row until it holds `vaPercent` % of the volume (VAH / VAL). The rows are drawn as
 * bands between 25 transparent level lines, filled with a gradient from the low volume colour to the high volume
 * colour by the row volume / max row volume. When the range is not positive (warm-up, flat market) every level is
 * the close.
 *
 * Reference: "Volume Profile Heatmap [KEYALGOS]" by KeyAlgos
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Visuals & Gradient Logic: Original. Performance Optimizations & Architecture: Credited to
 * u/Mess_Hot (Reddit)
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface VolumeProfileHeatmapInputs {
  /** Number of bars of the volume profile */
  lookback: number;
  /** Profile rows (10..24) */
  numRows: number;
  /** Value area % */
  vaPercent: number;
  /** Volume of all bars ('Both'), of up bars ('Bullish') or of down bars ('Bearish') */
  volumeType: 'Both' | 'Bullish' | 'Bearish';
  colorHighVol: string;
  colorLowVol: string;
  colorPoc: string;
  colorVah: string;
  colorExtreme: string;
  showPoc: boolean;
  showVaLines: boolean;
  showExtremes: boolean;
}

const DEF_HIGH_VOL = String(color.new('#FF0000', 60));
// Pine input default color.new(#FFFFE0, 90): Pine stores an input.color default with an alpha of 2 decimals
// (rgba(255,255,224,0.1)) and the script receives the alpha byte round(255 * 0.1) = 26 (0x1A), where
// color.new(#FFFFE0, 90) inside a script has the byte 25 (oakscriptjs #122).
const DEF_LOW_VOL = '#FFFFE01A';

export const defaultInputs: VolumeProfileHeatmapInputs = {
  lookback: 100,
  numRows: 24,
  vaPercent: 68,
  volumeType: 'Both',
  colorHighVol: DEF_HIGH_VOL,
  colorLowVol: DEF_LOW_VOL,
  colorPoc: color.orange,
  colorVah: color.blue,
  colorExtreme: color.gray,
  showPoc: true,
  showVaLines: true,
  showExtremes: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'Lookback Period', defval: 100, min: 10, max: 300 },
  { id: 'numRows', type: 'int', title: 'Profile Rows (Max 24)', defval: 24, min: 10, max: 24 },
  { id: 'vaPercent', type: 'int', title: 'Value Area %', defval: 68, min: 5, max: 95 },
  { id: 'volumeType', type: 'string', title: 'Volume Type', defval: 'Both', options: ['Both', 'Bullish', 'Bearish'] },
  { id: 'colorHighVol', type: 'color', title: 'High Volume Color', defval: DEF_HIGH_VOL },
  { id: 'colorLowVol', type: 'color', title: 'Low Volume Color', defval: DEF_LOW_VOL },
  { id: 'colorPoc', type: 'color', title: 'POC Line', defval: color.orange },
  { id: 'colorVah', type: 'color', title: 'VAH/VAL Lines', defval: color.blue },
  { id: 'colorExtreme', type: 'color', title: 'Extreme Lines', defval: color.gray },
  { id: 'showPoc', type: 'bool', title: 'Show POC', defval: true },
  { id: 'showVaLines', type: 'bool', title: 'Show Value Area Lines', defval: true },
  { id: 'showExtremes', type: 'bool', title: 'Show Profile Extremes', defval: true },
];

const LEVELS = 25;
const LEVEL_COLOR = String(color.new(color.gray, 100));

export const plotConfig: PlotConfig[] = [
  // plot(lK, '', color = color.new(color.gray, 100), editable = false): the band edges (untitled in Pine)
  ...Array.from({ length: LEVELS }, (_v, k): PlotConfig => ({ id: `plot${k}`, title: `Level ${k}`, color: LEVEL_COLOR, lineWidth: 1 })),
  { id: 'plot25', title: 'POC', color: color.orange, lineWidth: 2 },
  { id: 'plot26', title: 'VAH', color: color.blue, lineWidth: 1 },
  { id: 'plot27', title: 'VAL', color: color.blue, lineWidth: 1 },
  { id: 'plot28', title: 'High', color: color.gray, lineWidth: 1, style: 'linebr' },
  { id: 'plot29', title: 'Low', color: color.gray, lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'Volume Profile Heatmap [KEYALGOS]',
  shortTitle: 'Volume Profile Heatmap [KEYALGOS]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color: string };

export function calculate(bars: Bar[], inputs: Partial<VolumeProfileHeatmapInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const { lookback, numRows, vaPercent, volumeType } = cfg;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  // ta.highest(lookback) / ta.lowest(lookback): high / low (run on every bar: barstate.isnew is true on history)
  const highest = A(ta.highest(Series.fromArray(bars, bars.map((b) => b.high)), lookback));
  const lowest = A(ta.lowest(Series.fromArray(bars, bars.map((b) => b.low)), lookback));
  const vol = (i: number) => bars[i].volume ?? NaN;

  // var cache
  let cachedPoc = 0.0;
  let cachedVah = 0.0;
  let cachedVal = 0.0;
  let cachedHigh = 0.0;
  let cachedLow = 0.0;
  let cachedMaxVol = 0.0;
  const volumes: number[] = new Array(numRows).fill(0.0);
  // var (inside the gate): kept from the last bar with a positive range
  let maxVol = 0.0;
  let pocIdx = 0;

  const plots: Record<string, Point[]> = {};
  for (let k = 0; k < 30; k++) plots[`plot${k}`] = [];
  const fillColors: string[][] = Array.from({ length: LEVELS - 1 }, () => []);
  const levelCount = numRows - 1;

  for (let b = 0; b < n; b++) {
    const bar = bars[b];
    const profileHigh = highest[b];
    const profileLow = lowest[b];
    const priceRange = profileHigh - profileLow;

    if (gt(priceRange, 0)) {
      for (let r = 0; r < numRows; r++) volumes[r] = 0.0;
      const rowHeight = priceRange / numRows;

      // Build the histogram: bar i bars ago, i = 0 .. lookback - 1
      for (let i = 0; i < lookback; i++) {
        const j0 = b - i;
        const c = j0 >= 0 ? bars[j0] : undefined;
        let includeVol = false;
        if (volumeType === 'Both') includeVol = true;
        else if (volumeType === 'Bullish') includeVol = c !== undefined && gt(c.close, c.open);
        else if (volumeType === 'Bearish') includeVol = c !== undefined && lt(c.close, c.open);
        const v = j0 >= 0 ? vol(j0) : NaN;
        if (includeVol && gt(v, 0) && c !== undefined) {
          let startRow = Math.trunc(Math.floor((c.low - profileLow) / rowHeight));
          let endRow = Math.trunc(Math.ceil((c.high - profileLow) / rowHeight));
          // Clamp to the rows
          startRow = Math.max(0, Math.min(startRow, levelCount));
          endRow = Math.max(0, Math.min(endRow, levelCount));
          const volPerRow = v / (endRow - startRow + 1);
          for (let j = startRow; j <= endRow; j++) volumes[j] = volumes[j] + volPerRow;
        }
      }

      // array.max (skips na), array.indexof (first element == max, Pine ==)
      maxVol = NaN;
      for (const x of volumes) if (!isNaN(x) && (isNaN(maxVol) || x > maxVol)) maxVol = x;
      pocIdx = volumes.findIndex((x) => eq(x, maxVol));
      // Not reached (the max is an element of the array); kept as in Pine
      if (pocIdx === -1) pocIdx = Math.trunc(numRows / 2);

      const pocLevel = profileLow + pocIdx * rowHeight;
      let totalVol = 0;
      for (const x of volumes) totalVol += x;
      const targetVol = (totalVol * vaPercent) / 100.0;
      let vaUp = pocIdx;
      let vaDown = pocIdx;
      let accVol = maxVol;
      let safety = 0;
      while (lt(accVol, targetVol) && (vaUp < levelCount || vaDown > 0) && safety < numRows) {
        safety += 1;
        const vUp = vaUp < levelCount ? volumes[vaUp + 1] : 0.0;
        const vDown = vaDown > 0 ? volumes[vaDown - 1] : 0.0;
        if (ge(vUp, vDown) && vaUp < levelCount) {
          vaUp += 1;
          accVol += vUp;
        } else if (vaDown > 0) {
          vaDown -= 1;
          accVol += vDown;
        } else {
          break;
        }
      }
      if (vaUp < vaDown) {
        vaUp = pocIdx;
        vaDown = pocIdx;
      }
      cachedPoc = pocLevel;
      cachedVah = profileLow + vaUp * rowHeight;
      cachedVal = profileLow + vaDown * rowHeight;
      cachedHigh = profileHigh;
      cachedLow = profileLow;
      cachedMaxVol = maxVol;
    } else {
      // Flat market handling (also the warm-up, where the range is na)
      cachedPoc = bar.close;
      cachedVah = bar.close;
      cachedVal = bar.close;
      cachedHigh = bar.close;
      cachedLow = bar.close;
      cachedMaxVol = 0.0;
      for (let r = 0; r < numRows; r++) volumes[r] = 0.0;
    }

    // Heatmap
    const plotRange = cachedHigh - cachedLow;
    const rowHeightCalc = gt(plotRange, 0) ? plotRange / numRows : 0.0;
    const t = bar.time;
    for (let k = 0; k < LEVELS; k++) {
      plots[`plot${k}`].push({ time: t, value: cachedLow + k * rowHeightCalc, color: LEVEL_COLOR });
    }
    for (let k = 0; k < LEVELS - 1; k++) {
      // getRowColor(k)
      let c: string;
      if (k >= numRows || k < 0) c = LEVEL_COLOR;
      else {
        const ratio = gt(cachedMaxVol, 0) ? volumes[k] / cachedMaxVol : 0.0;
        c = String(color.from_gradient(ratio, 0.0, 1.0, cfg.colorLowVol, cfg.colorHighVol));
      }
      fillColors[k].push(c);
    }
    plots.plot25.push({ time: t, value: cfg.showPoc ? cachedPoc : NaN, color: cfg.colorPoc });
    plots.plot26.push({ time: t, value: cfg.showVaLines ? cachedVah : NaN, color: cfg.colorVah });
    plots.plot27.push({ time: t, value: cfg.showVaLines ? cachedVal : NaN, color: cfg.colorVah });
    plots.plot28.push({ time: t, value: cfg.showExtremes ? cachedHigh : NaN, color: cfg.colorExtreme });
    plots.plot29.push({ time: t, value: cfg.showExtremes ? cachedLow : NaN, color: cfg.colorExtreme });
  }

  // fill(pK, pK+1, color = getRowColor(K), title = 'Band K')
  const fills = fillColors.map((colors, k) => ({
    plot1: `plot${k}`, plot2: `plot${k + 1}`, options: { title: `Band ${k}` }, colors,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills,
  };
}

export const VolumeProfileHeatmap = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
