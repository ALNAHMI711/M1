/**
 * RSI Momentum Divergence Zones [ChartPrime]
 *
 * RSI computed on momentum (close change over 10 bars) with divergence
 * detection via pivot analysis. Bullish divergence: price lower low + RSI
 * higher low. Bearish: price higher high + RSI lower high.
 *
 * Reference: "RSI Momentum Divergence Zones [ChartPrime]" by ChartPrime
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, LineDrawingData } from '../types';
import { barInterval, barTime } from '../bar-time';

export interface RsiMomentumDivergenceInputs {
  rsiLength: number;
  enableDivCheck: boolean;
  showDivLevels: boolean;
  qtyDivLevels: number;
  divBearColor: string;
  divBullColor: string;
  divLookbackL: number;
  divLookbackR: number;
  minBarsInRange: number;
  maxBarsInRange: number;
}

export const defaultInputs: RsiMomentumDivergenceInputs = {
  rsiLength: 14,
  enableDivCheck: true,
  showDivLevels: true,
  qtyDivLevels: 10,
  divBearColor: '#ae4ce6',
  divBullColor: '#33c570',
  divLookbackL: 5,
  divLookbackR: 5,
  minBarsInRange: 5,
  maxBarsInRange: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'enableDivCheck', type: 'bool', title: 'Enable Divergence Detection', defval: true },
  { id: 'showDivLevels', type: 'bool', title: 'Show Divergence Zones', defval: true },
  { id: 'qtyDivLevels', type: 'int', title: 'Qty Divergence Zones', defval: 10 },
  { id: 'divBearColor', type: 'color', title: 'Bearish Color', defval: '#ae4ce6' },
  { id: 'divBullColor', type: 'color', title: 'Bullish Color', defval: '#33c570' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: '#ae4ce6', lineWidth: 1 },
  { id: 'plot1', title: 'Plot', color: '#808080', lineWidth: 1 },
];

export const metadata = {
  title: 'RSI Momentum Divergence',
  shortTitle: 'RSIM Div',
  overlay: false,
};

// Pine: indicator(..., max_lines_count = 500)
const MAX_LINES = 500;
// Pine: textCol = color.white, noneCol = color.new(color.white, 100)
const TEXT_COL = '#FFFFFF';
const NONE_COL = 'rgba(255,255,255,0)';

export function calculate(bars: Bar[], inputs: Partial<RsiMomentumDivergenceInputs> = {}): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; lines: LineDrawingData[] } {
  const {
    rsiLength, enableDivCheck, showDivLevels, qtyDivLevels, divBearColor, divBullColor,
    divLookbackL, divLookbackR, minBarsInRange, maxBarsInRange,
  } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const bearColor = divBearColor;
  const bullColor = divBullColor;

  // Pine: rsiSrc = ta.mom(close, 10) -> na on the first 10 bars
  const momLen = 10;
  const momArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    momArr[i] = i >= momLen ? bars[i].close - bars[i - momLen].close : NaN;
  }
  // Pine: rsiVal = ta.rsi(rsiSrc, rsiLength). ta.rsi of oakscriptjs 0.6.0 counts a change from an na value as a
  // 0 gain / 0 loss, so it is called on the bars where the momentum exists (Pine: na until the RMA has
  // rsiLength changes, first value on bar momLen + rsiLength).
  const rsiArr: number[] = new Array(n).fill(NaN);
  if (n > momLen) {
    const tail = ta.rsi(Series.fromArray(bars.slice(momLen), momArr.slice(momLen)), rsiLength).toArray();
    for (let i = momLen; i < n; i++) rsiArr[i] = tail[i - momLen] ?? NaN;
  }

  // Pivot detection for divergence
  // pivothigh/pivotlow on rsiVal with lookback L and R
  const rsiSeries = Series.fromArray(bars, rsiArr);
  const pivotHighArr = ta.pivothigh(rsiSeries, divLookbackL, divLookbackR).toArray();
  const pivotLowArr = ta.pivotlow(rsiSeries, divLookbackL, divLookbackR).toArray();

  const markers: MarkerData[] = [];
  const isBullDiv: boolean[] = new Array(n).fill(false);
  const isBearDiv: boolean[] = new Array(n).fill(false);

  if (enableDivCheck) {
    // Pine: ta.valuewhen(found, x, 1) -> the pivot before the latest one (the latest includes the current bar)
    const plRsi: number[] = [];
    const plLow: number[] = [];
    const phRsi: number[] = [];
    const phHigh: number[] = [];
    // Pine v6 `and` is lazy: in `rsiHL = rsiRight > ta.valuewhen(...) and _inRange(foundPL[1])` the ta.barssince
    // inside _inRange only runs on bars where the left side is true, so it counts those calls, not bars.
    let plCalls = NaN;
    let phCalls = NaN;
    let prevFoundPL = false;
    let prevFoundPH = false;

    for (let i = 0; i < n; i++) {
      const rsiRight = rsiArr[i - divLookbackR] ?? NaN;
      const lowRight = bars[i - divLookbackR]?.low ?? NaN;
      const highRight = bars[i - divLookbackR]?.high ?? NaN;

      // Bullish: price LL, RSI HL
      const foundPL = pivotLowArr[i] != null && !isNaN(pivotLowArr[i]!);
      if (foundPL) {
        plRsi.push(rsiRight);
        plLow.push(lowRight);
      }
      let rsiHL = false;
      if (plRsi.length >= 2 && rsiRight > plRsi[plRsi.length - 2]) {
        if (prevFoundPL) plCalls = 0;
        else if (!isNaN(plCalls)) plCalls++;
        rsiHL = plCalls >= minBarsInRange && plCalls <= maxBarsInRange;
      }
      const priceLL = plLow.length >= 2 && lowRight < plLow[plLow.length - 2];
      if (foundPL && rsiHL && priceLL) {
        // Pine (offset = -divLookbackR, location.absolute):
        // plotshape(isBullDiv ? rsiRight : na, 'Bullish Label', shape.labelup, text = ' Bull ', color = divBullColor,
        //   textcolor = textCol) in the RSI pane, and
        // plotshape(isBullDiv ? low[divLookbackR] : na, 'Bullish Price LL Label', shape.labelup, text = '▲\nBull',
        //   color = noneCol, textcolor = divBullColor, force_overlay = true) on the price pane
        const t = bars[i - divLookbackR].time;
        markers.push({
          time: t, position: 'atPriceBottom', price: rsiRight, shape: 'labelUp',
          color: bullColor, text: ' Bull ', textColor: TEXT_COL,
        });
        markers.push({
          time: t, position: 'atPriceBottom', price: lowRight, shape: 'labelUp',
          color: NONE_COL, text: '▲\nBull', textColor: bullColor, forceOverlay: true,
        });
        isBullDiv[i] = true;
      }

      // Bearish: price HH, RSI LH
      const foundPH = pivotHighArr[i] != null && !isNaN(pivotHighArr[i]!);
      if (foundPH) {
        phRsi.push(rsiRight);
        phHigh.push(highRight);
      }
      let rsiLH = false;
      if (phRsi.length >= 2 && rsiRight < phRsi[phRsi.length - 2]) {
        if (prevFoundPH) phCalls = 0;
        else if (!isNaN(phCalls)) phCalls++;
        rsiLH = phCalls >= minBarsInRange && phCalls <= maxBarsInRange;
      }
      const priceHH = phHigh.length >= 2 && highRight > phHigh[phHigh.length - 2];
      if (foundPH && rsiLH && priceHH) {
        // Pine: 'Bearish Label' (labeldown at rsiRight, RSI pane) and 'Bearish Price HH Label' (labeldown at
        // high[divLookbackR], text 'Bear\n▼', color noneCol, textcolor divBearColor, force_overlay = true)
        const t = bars[i - divLookbackR].time;
        markers.push({
          time: t, position: 'atPriceTop', price: rsiRight, shape: 'labelDown',
          color: bearColor, text: ' Bear ', textColor: TEXT_COL,
        });
        markers.push({
          time: t, position: 'atPriceTop', price: highRight, shape: 'labelDown',
          color: NONE_COL, text: 'Bear\n▼', textColor: bearColor, forceOverlay: true,
        });
        isBearDiv[i] = true;
      }

      prevFoundPL = foundPL;
      prevFoundPH = foundPH;
    }
  }

  // Divergence zones (Pine plotDivergenceLevels, force_overlay = true), bar by bar:
  //   - on a divergence bar: primary line (width 1) and background line (width 6, colour 70% transparent)
  //     from bar_index - 5 to bar_index at high[5] / low[5]
  //   - more than qtyDivLevels active zones: the oldest active zone is deleted (both lines)
  //   - each active zone: price beyond the level (bull: high > y, bear: low < y) -> x2 = bar_index + 15;
  //     otherwise x2 = bar_index, primary line dashed, background line deleted, zone removed from the array
  //   - `for dl in arr` walks the array by index: after arr.remove the next element takes the removed index
  //     and is skipped on this bar
  //   - max_lines_count = 500: the oldest lines are deleted when more exist
  type Ln = { x1: number; x2: number; y: number; color: string; width: number; style: 'solid' | 'dashed'; deleted: boolean };
  type Zone = { primary: Ln; bg: Ln };
  const allLines: Ln[] = [];
  let aliveCount = 0;
  let oldest = 0;
  const newLine = (x1: number, x2: number, y: number, color: string, width: number): Ln => {
    const ln: Ln = { x1, x2, y, color, width, style: 'solid', deleted: false };
    allLines.push(ln);
    aliveCount++;
    while (aliveCount > MAX_LINES) {
      while (allLines[oldest].deleted) oldest++;
      allLines[oldest].deleted = true;
      aliveCount--;
    }
    return ln;
  };
  const deleteLine = (ln: Ln) => {
    if (!ln.deleted) {
      ln.deleted = true;
      aliveCount--;
    }
  };

  // Pine line.set_x2(bar_index + 15): on the last bars x2 lies after the last bar (time of that future bar)
  const futureExt = 15;

  if (showDivLevels) {
    const bearZones: Zone[] = [];
    const bullZones: Zone[] = [];
    const update = (arr: Zone[], cond: boolean, isBull: boolean, i: number) => {
      const b = bars[i];
      if (cond) {
        const levelY = isBull ? bars[i - divLookbackR].low : bars[i - divLookbackR].high;
        const col = isBull ? bullColor : bearColor;
        const l1 = newLine(i - 5, i, levelY, col, 1);
        const l2 = newLine(i - 5, i, levelY, col + '4d', 6); // color.new(col, 70)
        arr.push({ primary: l1, bg: l2 });
      }
      if (arr.length > qtyDivLevels) {
        const expired = arr.shift()!;
        deleteLine(expired.primary);
        deleteLine(expired.bg);
      }
      for (let k = 0; k < arr.length; k++) {
        const dl = arr[k];
        const y1 = dl.primary.y;
        if (isBull ? b.high > y1 : b.low < y1) {
          dl.primary.x2 = i + futureExt;
          dl.bg.x2 = i + futureExt;
        } else {
          dl.primary.x2 = i;
          dl.primary.style = 'dashed';
          deleteLine(dl.bg);
          arr.splice(k, 1); // no k-- : the next element is skipped, as in Pine
        }
      }
    };
    for (let i = 0; i < n; i++) {
      update(bearZones, isBearDiv[i], false, i);
      update(bullZones, isBullDiv[i], true, i);
    }
  }

  // Pine line.new(..., force_overlay = true): the zones are drawn on the price pane
  const interval = barInterval(bars);
  const lines: LineDrawingData[] = [];
  for (const ln of allLines) {
    if (ln.deleted) continue;
    lines.push({
      time1: barTime(bars, ln.x1, interval),
      price1: ln.y,
      time2: barTime(bars, ln.x2, interval),
      price2: ln.y,
      color: ln.color,
      width: ln.width,
      style: ln.style,
      forceOverlay: true,
    });
  }

  // RSI plot: color.from_gradient(rsiVal, 30, 70, divBullColor, divBearColor)
  const hexRgb = (c: string): [number, number, number] => [
    parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16),
  ];
  const [br, bg, bb] = hexRgb(bullColor);
  const [rr, rg, rb] = hexRgb(bearColor);
  const plot0 = rsiArr.map((v, i) => {
    if (isNaN(v)) return { time: bars[i].time, value: NaN };
    const t = Math.max(0, Math.min(1, (v - 30) / 40));
    const r = Math.round(br + t * (rr - br));
    const g = Math.round(bg + t * (rg - bg));
    const b = Math.round(bb + t * (rb - bb));
    return { time: bars[i].time, value: v, color: `rgb(${r},${g},${b})` };
  });

  // Pine: p50 = plot(50, color = color.gray)
  const plot1 = bars.map((b) => ({ time: b.time, value: 50 }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    // Pine: fill(rsiLine, p50, 70, 30, divBearColor, na) and fill(rsiLine, p50, 70, 30, na, divBullColor) are
    // gradient fills by price level; FillData has one colour per bar, so a single fill is kept.
    fills: [
      { plot1: 'plot0', plot2: 'plot1', options: { color: bearColor + '33' } },
    ],
    markers,
    lines,
  };
}

export const RsiMomentumDivergence = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
