/**
 * Volatility Bands
 *
 * An adaptive moving average (UMA) of the close: out = b * close + (1 - b) * out[1], with b = erf(|log(close /
 * close[1])|) (erf by the Abramowitz-Stegun approximation). The bands are built on the log scale around
 * mid = log(uma): each deviation is the square root of an adaptive variance of (log price - centre)^2 with the
 * weight erf(|log price - log price[1]|). Band 0 = mid +- dev(log high / log low, mid); bands 1 and 2 add a further
 * deviation around the nearest of the earlier bands. The bands are hidden; fills between them draw a red upper
 * cloud and a green lower cloud. The UMA is lime when rising, red when falling, navy otherwise.
 *
 * Reference: "Volatility Bands" by pmk07
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface VolatilityBandsInputs {}

export const defaultInputs: VolatilityBandsInputs = {};

export const inputConfig: InputConfig[] = [];

const UPPER_OUTER = String(color.rgb(255, 82, 82, 90));
const LOWER_OUTER = String(color.rgb(0, 230, 119, 90));
const UPPER_INNER = String(color.rgb(255, 82, 82, 69));
const LOWER_INNER = String(color.rgb(0, 230, 119, 69));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'UMA', color: color.lime, lineWidth: 1 },
  { id: 'plot1', title: 'Volatility Band', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Volatility Band', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Volatility Deviation Band 1', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'Volatility Deviation Band 1', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Volatility Deviation Band 2', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot6', title: 'Volatility Deviation Band 2', color: 'transparent', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Volatility Bands',
  shortTitle: 'VB',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
/** Pine nz(x, y) */
const nz = (x: number, y: number) => (Number.isFinite(x) ? x : y);

/** erf(x): 1 - exp(-x^2) * (a1 t + a2 t^2 + a3 t^3 + a4 t^4 + a5 t^5), t = 1 / (1 + p |x|) */
function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  return 1 - Math.exp(-1 * Math.pow(x, 2)) * (0.254829592 * t - 0.284496736 * Math.pow(t, 2)
    + 1.421413741 * Math.pow(t, 3) - 1.453152027 * Math.pow(t, 4) + 1.061405429 * Math.pow(t, 5));
}

/** dev(input, mu): one state per Pine call site (input[1] and variance[1] are kept by the site) */
function devSite() {
  let prevInput = NaN;
  let variance = NaN;
  return (input: number, mu: number): number => {
    const dev = Math.pow(input - mu, 2);
    const x = Math.abs(input - nz(prevInput, input));
    const b0 = erf(x);
    variance = b0 * dev + (1 - b0) * nz(variance, dev);
    prevInput = input;
    return Math.sqrt(variance);
  };
}

export function calculate(bars: Bar[], _inputs: Partial<VolatilityBandsInputs> = {}): IndicatorResult {
  const n = bars.length;
  const devU0 = devSite();
  const devD0 = devSite();
  const devU1 = devSite();
  const devD1 = devSite();
  const devU2 = devSite();
  const devD2 = devSite();

  const uma: number[] = new Array(n);
  const u0: number[] = new Array(n);
  const d0: number[] = new Array(n);
  const u1: number[] = new Array(n);
  const d1: number[] = new Array(n);
  const u2: number[] = new Array(n);
  const d2: number[] = new Array(n);
  let out = NaN;
  for (let i = 0; i < n; i++) {
    const c = bars[i].close;
    // uma(close): x = |log(close / nz(close[1], close))|; out := b0 * close + (1 - b0) * nz(out[1], close)
    const prevClose = i > 0 ? bars[i - 1].close : NaN;
    const b0 = erf(Math.abs(Math.log(c / nz(prevClose, c))));
    out = b0 * c + (1 - b0) * nz(out, c);
    uma[i] = out;

    const mid = Math.log(out);
    const hi = Math.log(bars[i].high);
    const lo = Math.log(bars[i].low);

    const u0Band = mid + devU0(hi, mid);
    const d0Band = mid - devD0(lo, mid);
    let tempD = Math.min(Math.abs(hi - u0Band), Math.abs(hi - d0Band));
    const u1BandD = eq(Math.abs(hi - u0Band), tempD) ? u0Band : d0Band;
    const u1Band = u0Band + devU1(hi, u1BandD);
    tempD = Math.min(Math.abs(lo - d0Band), Math.abs(lo - u0Band));
    const d1BandD = eq(Math.abs(lo - d0Band), tempD) ? d0Band : u0Band;
    const d1Band = d0Band - devD1(lo, d1BandD);
    tempD = Math.min(Math.abs(hi - u1Band), Math.abs(hi - d0Band), Math.abs(hi - mid));
    const u2BandD = eq(Math.abs(hi - u1Band), tempD) ? u1Band : eq(Math.abs(hi - d0Band), tempD) ? d0Band : mid;
    const u2Band = u1Band + devU2(hi, u2BandD);
    tempD = Math.min(Math.abs(lo - d1Band), Math.abs(lo - u0Band), Math.abs(lo - mid));
    const d2BandD = eq(Math.abs(lo - d1Band), tempD) ? d1Band : eq(Math.abs(lo - u0Band), tempD) ? u0Band : mid;
    const d2Band = d1Band - devD2(lo, d2BandD);

    u0[i] = Math.exp(u0Band);
    d0[i] = Math.exp(d0Band);
    u1[i] = Math.exp(u1Band);
    d1[i] = Math.exp(d1Band);
    u2[i] = Math.exp(u2Band);
    d2[i] = Math.exp(d2Band);
  }

  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const line = (a: number[]) => bars.map((b, i) => ({ time: b.time, value: fin(a[i]) }));
  // middle_color = uma > uma[1] ? lime : uma < uma[1] ? red : navy
  const plot0 = bars.map((b, i) => {
    const prev = i > 0 ? uma[i - 1] : NaN;
    const col = gt(uma[i], prev) ? color.lime : gt(prev, uma[i]) ? color.red : color.navy;
    return { time: b.time, value: fin(uma[i]), color: col };
  });

  const fill = (plot1: string, plot2: string, c: string) => ({ plot1, plot2, options: { color: c } });
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0,
      plot1: line(u0), // uuu
      plot2: line(d0), // ddd
      plot3: line(u2), // cloud_uuu_1
      plot4: line(u1), // cloud_uuu_2
      plot5: line(d1), // cloud_ddd_1
      plot6: line(d2), // cloud_ddd_2
    },
    fills: [
      fill('plot4', 'plot1', UPPER_OUTER), // fill(cloud_uuu_2, uuu)
      fill('plot5', 'plot2', LOWER_OUTER), // fill(cloud_ddd_1, ddd)
      fill('plot3', 'plot4', UPPER_INNER), // fill(cloud_uuu_1, cloud_uuu_2)
      fill('plot5', 'plot6', LOWER_INNER), // fill(cloud_ddd_1, cloud_ddd_2)
    ],
  };
}

export const VolatilityBands = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
