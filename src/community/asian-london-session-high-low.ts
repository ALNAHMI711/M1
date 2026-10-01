/**
 * Asian & London Session High/Low
 *
 * Session times in the fixed time zone Europe/Sofia: Asian 00:00 - 08:00, London 09:00 - 16:30 of the bar day.
 * The high and the low of the bars that open in each session are tracked (kept between sessions); all four values
 * are reset to na on the bars that open at or after 16:30 Europe/Sofia. The bar open time decides: on daily bars
 * this is the session open time of the bar.
 *
 * Reference: "Asian & London Session High/Low" by NikolayBorisov
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, time as ptime, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AsianLondonSessionHighLowInputs {}

export const defaultInputs: AsianLondonSessionHighLowInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Asian High', color: color.fuchsia, lineWidth: 1, style: 'linebr' },
  { id: 'plot1', title: 'Asian Low', color: color.fuchsia, lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'London High', color: color.orange, lineWidth: 1, style: 'linebr' },
  { id: 'plot3', title: 'London Low', color: color.orange, lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'Asian & London Session High/Low',
  shortTitle: 'Asian & London Session High/Low',
  overlay: true,
};

const TZ = 'Europe/Sofia';

export function calculate(bars: Bar[], _inputs: Partial<AsianLondonSessionHighLowInputs> = {}): IndicatorResult {
  const n = bars.length;
  const asianHigh: number[] = new Array(n);
  const asianLow: number[] = new Array(n);
  const londonHigh: number[] = new Array(n);
  const londonLow: number[] = new Array(n);
  let aH = NaN;
  let aL = NaN;
  let lH = NaN;
  let lL = NaN;
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    // Pine `time`: bar open time in milliseconds
    const t = b.time * 1000;
    const y = ptime.year(t, TZ);
    const m = ptime.month(t, TZ);
    const d = ptime.dayofmonth(t, TZ);
    const asianStart = ptime.timestamp(TZ, y, m, d, 0, 0);
    const asianEnd = ptime.timestamp(TZ, y, m, d, 8, 0);
    const londonStart = ptime.timestamp(TZ, y, m, d, 9, 0);
    const londonEnd = ptime.timestamp(TZ, y, m, d, 16, 30);
    const inAsian = t >= asianStart && t < asianEnd;
    const inLondon = t >= londonStart && t < londonEnd;
    if (inAsian) {
      aH = isNaN(aH) ? b.high : Math.max(aH, b.high);
      aL = isNaN(aL) ? b.low : Math.min(aL, b.low);
    }
    if (inLondon) {
      lH = isNaN(lH) ? b.high : Math.max(lH, b.high);
      lL = isNaN(lL) ? b.low : Math.min(lL, b.low);
    }
    // Reset after 16:30
    if (t >= ptime.timestamp(TZ, y, m, d, 16, 30)) {
      aH = NaN;
      aL = NaN;
      lH = NaN;
      lL = NaN;
    }
    asianHigh[i] = aH;
    asianLow[i] = aL;
    londonHigh[i] = lH;
    londonLow[i] = lL;
  }

  const line = (values: number[]) => bars.map((b, i) => ({ time: b.time, value: values[i] }));
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: line(asianHigh),
      plot1: line(asianLow),
      plot2: line(londonHigh),
      plot3: line(londonLow),
    },
  };
}

export const AsianLondonSessionHighLow = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
