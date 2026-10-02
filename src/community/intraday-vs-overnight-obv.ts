/**
 * Intraday vs Overnight OBV
 *
 * The bar volume is split into an estimated overnight part (volume * overnightVol / 100) and an intraday part (the
 * rest). Three OBV-style sums start at 0 on the first bar: the intraday OBV adds +- the intraday volume by the sign
 * of close - open, the overnight OBV adds +- the overnight volume by the sign of open - close[1], and the aggregate
 * OBV adds both. Each line can be tinted toward green (rising) or red (falling). A moving average (SMA, EMA, WMA or
 * RMA) of the selected OBV is green below the OBV and red above it.
 *
 * Reference: "Intraday vs Overnight OBV [theUltimator5]" by TheUltimator5
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © TheUltimator5
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export type IntradayVsOvernightObvType = 'Both Intraday and Overnight' | 'Intraday' | 'Overnight' | 'Aggregate';

export interface IntradayVsOvernightObvInputs {
  plotChoice: IntradayVsOvernightObvType;
  /** Estimated overnight volume (% of the bar volume) */
  overnightVol: number;
  colorByDirection: boolean;
  /** Colour blending strength (0 to 1) */
  blendWeight: number;
  showMA: boolean;
  maType: 'SMA' | 'EMA' | 'WMA' | 'RMA';
  maLen: number;
  colorMAByPosition: boolean;
}

export const defaultInputs: IntradayVsOvernightObvInputs = {
  plotChoice: 'Both Intraday and Overnight',
  overnightVol: 20,
  colorByDirection: true,
  blendWeight: 0.5,
  showMA: true,
  maType: 'SMA',
  maLen: 20,
  colorMAByPosition: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'plotChoice', type: 'string', title: 'Synthetic OBV Type', defval: 'Both Intraday and Overnight',
    options: ['Both Intraday and Overnight', 'Intraday', 'Overnight', 'Aggregate'] },
  { id: 'overnightVol', type: 'int', title: 'Estimated Overnight Volume %', defval: 20, min: 0, max: 100 },
  { id: 'colorByDirection', type: 'bool', title: 'Color OBV Lines by Direction?', defval: true },
  { id: 'blendWeight', type: 'float', title: 'Color blending strength (value from 0 to 1)', defval: 0.5, min: 0, max: 1 },
  { id: 'showMA', type: 'bool', title: 'Show Moving Average?', defval: true },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'SMA', options: ['SMA', 'EMA', 'WMA', 'RMA'] },
  { id: 'maLen', type: 'int', title: 'MA Length', defval: 20, min: 1 },
  { id: 'colorMAByPosition', type: 'bool', title: 'Color MA Based on Position Relative to OBV?', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Intraday OBV', color: color.orange, lineWidth: 2 },
  { id: 'plot1', title: 'Overnight OBV', color: color.blue, lineWidth: 2 },
  { id: 'plot2', title: 'Aggregate OBV', color: color.teal, lineWidth: 2 },
  { id: 'plot3', title: 'Moving Average', color: color.aqua, lineWidth: 1 },
];

export const metadata = {
  title: 'Intraday vs Overnight OBV [theUltimator5]',
  shortTitle: 'Intraday vs Overnight OBV [theUltimator5]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(bars: Bar[], inputs: Partial<IntradayVsOvernightObvInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  const intradayOBV: number[] = new Array(n);
  const overnightOBV: number[] = new Array(n);
  const aggregateOBV: number[] = new Array(n);
  // var float intradayOBV = na (and the two others): reset to 0 while intradayOBV is na
  let intra = NaN;
  let over = NaN;
  let agg = NaN;
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const volume = b.volume ?? NaN;
    const overnightVolume = (volume * cfg.overnightVol) / 100;
    const intradayVolume = volume - overnightVolume;
    const intradayChange = b.close - b.open;
    const overnightChange = i > 0 ? b.open - bars[i - 1].close : NaN;
    if (isNaN(intra)) {
      intra = 0;
      over = 0;
      agg = 0;
    } else {
      const intradayDelta = gt(intradayChange, 0) ? intradayVolume : lt(intradayChange, 0) ? -intradayVolume : 0;
      const overnightDelta = gt(overnightChange, 0) ? overnightVolume : lt(overnightChange, 0) ? -overnightVolume : 0;
      intra += intradayDelta;
      over += overnightDelta;
      agg += intradayDelta + overnightDelta;
    }
    intradayOBV[i] = intra;
    overnightOBV[i] = over;
    aggregateOBV[i] = agg;
  }

  // tintRGB(baseColor, currentVal, prevVal): blend toward green when rising, toward red when falling
  const w = cfg.blendWeight;
  const tintRGB = (baseColor: string, currentVal: number, prevVal: number): string => {
    const r = color.r(baseColor);
    const g = color.g(baseColor);
    const bl = color.b(baseColor);
    let newR = r;
    let newG = g;
    let newB = bl;
    if (cfg.colorByDirection) {
      if (gt(currentVal, prevVal)) {
        newR = r * (1 - w) + 0 * w;
        newG = g * (1 - w) + 255 * w;
        newB = bl * (1 - w) + 0 * w;
      } else if (lt(currentVal, prevVal)) {
        newR = r * (1 - w) + 255 * w;
        newG = g * (1 - w) + 0 * w;
        newB = bl * (1 - w) + 0 * w;
      }
    }
    // int() truncates toward zero
    return String(color.rgb(Math.trunc(newR), Math.trunc(newG), Math.trunc(newB)));
  };
  // nz(x[1]): 0 on the first bar
  const prev = (arr: number[], i: number) => (i > 0 && !isNaN(arr[i - 1]) ? arr[i - 1] : 0);

  const showIntra = cfg.plotChoice === 'Intraday' || cfg.plotChoice === 'Both Intraday and Overnight';
  const showOver = cfg.plotChoice === 'Overnight' || cfg.plotChoice === 'Both Intraday and Overnight';
  const showAgg = cfg.plotChoice === 'Aggregate';

  const maSource = cfg.plotChoice === 'Intraday' ? intradayOBV : cfg.plotChoice === 'Overnight' ? overnightOBV : aggregateOBV;
  let maLine: number[] = new Array(n).fill(NaN);
  if (cfg.showMA) {
    const s = Series.fromArray(bars, maSource);
    const len = cfg.maLen;
    maLine = A(cfg.maType === 'SMA' ? ta.sma(s, len) : cfg.maType === 'EMA' ? ta.ema(s, len)
      : cfg.maType === 'WMA' ? ta.wma(s, len) : ta.rma(s, len));
  }
  const maColor = (i: number) => (!cfg.colorMAByPosition ? color.aqua
    : lt(maLine[i], maSource[i]) ? color.green : gt(maLine[i], maSource[i]) ? color.red : color.aqua);

  const plot0 = bars.map((b, i) => ({ time: b.time, value: showIntra ? intradayOBV[i] : NaN,
    color: tintRGB(color.orange, intradayOBV[i], prev(intradayOBV, i)) }));
  const plot1 = bars.map((b, i) => ({ time: b.time, value: showOver ? overnightOBV[i] : NaN,
    color: tintRGB(color.blue, overnightOBV[i], prev(overnightOBV, i)) }));
  const plot2 = bars.map((b, i) => ({ time: b.time, value: showAgg ? aggregateOBV[i] : NaN,
    color: tintRGB(color.teal, aggregateOBV[i], prev(aggregateOBV, i)) }));
  const plot3 = bars.map((b, i) => ({ time: b.time, value: cfg.showMA ? maLine[i] : NaN, color: maColor(i) }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2, plot3 },
  };
}

export const IntradayVsOvernightObv = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
