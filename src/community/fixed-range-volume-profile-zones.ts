/**
 * Fixed-Range Volume-Profile Zones
 *
 * A volume profile of the closes of the last `Lookback Days` bars: the close range is cut into `Number of Bins`
 * equal bins and each bar adds its volume to the bin of its close. The bins with volume, in price order (position j),
 * get zone = j / ceil(count / 3), a fractional quotient: VAL is the centre of the bin with zone 0 (the lowest bin),
 * POC the centre of the bin with zone 1, VAH the centre of the last bin with zone 2 or above (the lines keep their
 * value when fewer than 3 bins have volume or no bin has that zone). The window low / high are drawn (transparent)
 * for fills to VAL / VAH. Triangles mark closes above the VAH percentile price or below the VAL percentile price of the window, and
 * candles are coloured by the direction of the previous close change.
 *
 * Reference: "Fixed-Range Volume-Profile Zones" by RWCS_LTD
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © RWCS_LTD
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';

export interface FixedRangeVolumeProfileZonesInputs {
  /** Number of bars in the profile window */
  lookbackDays: number;
  /** Number of price bins */
  numBins: number;
  /** Upper percentile of the window closes for the VAH buffer */
  percentileUpper: number;
  /** Lower percentile of the window closes for the VAL buffer */
  percentileLower: number;
}

export const defaultInputs: FixedRangeVolumeProfileZonesInputs = {
  lookbackDays: 30,
  numBins: 30,
  percentileUpper: 95.0,
  percentileLower: 5.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookbackDays', type: 'int', title: 'Lookback Days', defval: 30, min: 1 },
  { id: 'numBins', type: 'int', title: 'Number of Bins', defval: 30, min: 5 },
  { id: 'percentileUpper', type: 'float', title: 'VAH Percentile', defval: 95.0, min: 50.0, max: 100.0, step: 0.1 },
  { id: 'percentileLower', type: 'float', title: 'VAL Percentile', defval: 5.0, min: 0.0, max: 50.0, step: 0.1 },
];

const MIN_COL = String(color.new(color.green, 100));
const MAX_COL = String(color.new(color.red, 100));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VAL', color: color.green, lineWidth: 1 },
  { id: 'plot1', title: 'VAH', color: color.orange, lineWidth: 1 },
  { id: 'plot2', title: 'POC', color: color.red, lineWidth: 2 },
  { id: 'plot3', title: 'Min Price', color: MIN_COL, lineWidth: 1 },
  { id: 'plot4', title: 'Max Price', color: MAX_COL, lineWidth: 1 },
];

export const metadata = {
  title: 'Fixed Range Volume Profile Zones (with Dynamic Percentile Buffers)',
  shortTitle: 'Fixed Range Volume Profile Zones (with Dynamic Percentile Buffers)',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** plotcandle without bordercolor: the style default of the plot (no colorer) */
const CANDLE_BORDER = '#000000';

export function calculate(
  bars: Bar[],
  inputs: Partial<FixedRangeVolumeProfileZonesInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const { lookbackDays, numBins, percentileUpper, percentileLower } = cfg;
  const n = bars.length;

  const valArr: number[] = new Array(n).fill(NaN);
  const vahArr: number[] = new Array(n).fill(NaN);
  const pocArr: number[] = new Array(n).fill(NaN);
  const pminArr: number[] = new Array(n).fill(NaN);
  const pmaxArr: number[] = new Array(n).fill(NaN);
  const above: boolean[] = new Array(n).fill(false);
  const below: boolean[] = new Array(n).fill(false);

  let VAL = NaN; // var float VAL = na
  let VAH = NaN;
  let POC = NaN;
  const closes: number[] = [];
  const vols: number[] = [];
  for (let k = 0; k < n; k++) {
    closes.push(bars[k].close);
    vols.push(bars[k].volume ?? NaN);
    if (closes.length > lookbackDays) {
      closes.shift();
      vols.shift();
    }

    if (closes.length >= lookbackDays) {
      // Binning (array.min / array.max of the window)
      const pmin = Math.min(...closes);
      const pmax = Math.max(...closes);
      const prange = pmax - pmin;
      const binWidth = gt(prange, 0) ? prange / numBins : 1.0;
      const binVol: number[] = new Array(numBins).fill(0.0);
      const binCenter: number[] = new Array(numBins).fill(0.0);
      for (let i = 0; i < numBins; i++) {
        const left = pmin + i * binWidth;
        const right = left + binWidth;
        binCenter[i] = (left + right) / 2;
      }
      for (let i = 0; i < closes.length; i++) {
        const binIndex = Math.min(numBins - 1, Math.max(0, Math.floor((closes[i] - pmin) / binWidth)));
        binVol[binIndex] = binVol[binIndex] + vols[i];
      }
      // Non-zero bins
      const nzCenter: number[] = [];
      const nzVol: number[] = [];
      for (let i = 0; i < numBins; i++) {
        const v = binVol[i];
        if (gt(v, 0)) {
          nzCenter.push(binCenter[i]);
          nzVol.push(v);
        }
      }
      if (nzCenter.length >= 3) {
        const nz = nzCenter.length;
        const idx = nzCenter.map((_c, i) => i);
        // Selection sort of idx by nz_center
        for (let i = 0; i <= nz - 2; i++) {
          let minIdx = i;
          for (let j = i + 1; j <= nz - 1; j++) {
            if (lt(nzCenter[idx[j]], nzCenter[idx[minIdx]])) minIdx = j;
          }
          if (i !== minIdx) {
            const tmp = idx[i];
            idx[i] = idx[minIdx];
            idx[minIdx] = tmp;
          }
        }
        const zoneSize = Math.ceil(nz / 3);
        let maxVol = -1.0;
        for (let j = 0; j < nz; j++) {
          const bin = idx[j];
          const center = nzCenter[bin];
          const vol = nzVol[bin];
          // int zone = j / zone_size: Pine keeps the fractional quotient (observed values: a truncated zone gives
          // other VAL / POC values)
          let zone = j / zoneSize;
          if (gt(zone, 2)) zone = 2;
          if (zone === 0) VAL = center;
          if (zone === 2) VAH = center;
          if (zone === 1 && gt(vol, maxVol)) {
            maxVol = vol;
            POC = center;
          }
        }
      }
      pminArr[k] = pmin;
      pmaxArr[k] = pmax;
    }

    // Dynamic percentile buffers
    const sorted = [...closes].sort((a, b) => a - b);
    const m = sorted.length;
    const idxUp = Math.max(0, Math.min(Math.round((m * percentileUpper) / 100) - 1, m - 1));
    const idxLo = Math.max(0, Math.min(Math.round((m * percentileLower) / 100) - 1, m - 1));
    const pctUp = sorted[idxUp];
    const pctLo = sorted[idxLo];
    const vahBuf = pctUp - VAH;
    const valBuf = VAL - pctLo;

    valArr[k] = VAL;
    vahArr[k] = VAH;
    pocArr[k] = POC;
    const c = bars[k].close;
    above[k] = gt(c, VAH + vahBuf) && !isNaN(VAH);
    below[k] = lt(c, VAL - valBuf) && !isNaN(VAL);
  }

  const t = (i: number) => bars[i].time;
  const plots = {
    plot0: bars.map((_b, i) => ({ time: t(i), value: valArr[i], color: color.green })),
    plot1: bars.map((_b, i) => ({ time: t(i), value: vahArr[i], color: color.orange })),
    plot2: bars.map((_b, i) => ({ time: t(i), value: pocArr[i], color: color.red })),
    plot3: bars.map((_b, i) => ({ time: t(i), value: pminArr[i], color: MIN_COL })),
    plot4: bars.map((_b, i) => ({ time: t(i), value: pmaxArr[i], color: MAX_COL })),
  };

  // fill(plot_val, plot_pmin, color.new(color.green, 90)), fill(plot_vah, plot_pmax, color.new(color.red, 90))
  const fills = [
    { plot1: 'plot0', plot2: 'plot3', colors: new Array(n).fill(String(color.new(color.green, 90))) },
    { plot1: 'plot1', plot2: 'plot4', colors: new Array(n).fill(String(color.new(color.red, 90))) },
  ];

  // plotcandle(open, high, low, close, 'Price Action', close[2] < close[1] ? aqua : close[2] > close[1] ? fuchsia
  //   : color.new(color.black, 100), color.white)
  const noCandle = String(color.new(color.black, 100));
  const candles: PlotCandleData[] = bars.map((b, i) => {
    const c2 = i >= 2 ? bars[i - 2].close : NaN;
    const c1 = i >= 1 ? bars[i - 1].close : NaN;
    const col = lt(c2, c1) ? color.aqua : gt(c2, c1) ? color.fuchsia : noCandle;
    return { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, color: col,
      wickColor: color.white, borderColor: CANDLE_BORDER };
  });

  const markers: MarkerData[] = [];
  for (let i = 0; i < n; i++) {
    if (above[i]) markers.push({ time: t(i), position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'tiny' });
    if (below[i]) markers.push({ time: t(i), position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'tiny' });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills,
    markers,
    plotCandles: { priceAction: candles },
  };
}

export const FixedRangeVolumeProfileZones = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
