/**
 * Chart Setup and Management
 * Creates and manages the LightweightCharts instance
 */

import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  BarSeries,
  LineSeries,
  HistogramSeries,
  type LineWidth,
  BaselineSeries,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type ISeriesPrimitive,
  type IPrimitivePaneView,
  type IPrimitivePaneRenderer,
  type SeriesAttachedParameter,
  type SeriesMarker,
  type CandlestickData,
  type BarData,
  type LineData,
  type HistogramData,
  type BaselineData,
  type WhitespaceData,
  type Time,
  type SeriesType,
  ColorType,
  LineStyle,
  LineType,
} from 'lightweight-charts';
import type { CanvasRenderingTarget2D } from 'fancy-canvas';
import type { Bar, HLineConfig, FillConfig, FillData, ArrowConfig, ArrowData } from 'oakscriptjs';
import type {
  BarColorData,
  BgColorData,
  PlotCandleData,
  PlotBarData,
  LabelData,
  LineDrawingData,
  BoxData,
  LinefillData,
  PolylineData,
  TableData,
  MarkerData,
  PineSize,
} from '../../src/types';
import { barInterval } from '../../src/bar-time';
import { toCandlestickData } from './data-loader';
import { gradientPart, isTransparent, withOpacity, type GradientPart } from './color';

// ─── Bar grid (bars after the last bar) ────────────────────────────────────

/**
 * Bars of the chart and the slots after the last bar.
 * Ports give points on future bars (Pine bar_index + k, plot offsets) the time lastTime + k * interval
 * (src/bar-time.ts). ChartManager adds whitespace points at these times to the time scale, so they get their own
 * bar slots; x() also places a later time that is not on this grid by its bar count after the last bar.
 */
class BarGrid {
  bars: Bar[] = [];
  byTime = new Map<number, Bar>();
  interval = 0;

  setBars(bars: Bar[]): void {
    this.bars = bars;
    this.byTime = new Map(bars.map(b => [b.time, b]));
    this.interval = barInterval(bars);
  }

  get lastTime(): number {
    return this.bars.length ? this.bars[this.bars.length - 1].time : NaN;
  }

  /** Number of bar slots after the last bar needed to show `time` (0 when time is not after the last bar) */
  slotsAfter(time: number): number {
    if (!(time > this.lastTime) || !(this.interval > 0)) return 0;
    return Math.ceil((time - this.lastTime) / this.interval - 1e-9);
  }

  /** A time after the last bar moved to the nearest future slot; other times unchanged */
  snap(time: number): number {
    if (!(time > this.lastTime) || !(this.interval > 0)) return time;
    return this.lastTime + Math.max(1, Math.round((time - this.lastTime) / this.interval)) * this.interval;
  }

  /** x coordinate of a time: its bar slot, or for a later time off the grid, its bar count after the last bar */
  x(timeScale: ReturnType<IChartApi['timeScale']>, time: number): number | null {
    const x = timeScale.timeToCoordinate(time as unknown as Time);
    if (x != null) return x as number;
    if (!(time > this.lastTime) || !(this.interval > 0)) return null;
    const lastX = timeScale.timeToCoordinate(this.lastTime as unknown as Time);
    const lastLogical = lastX == null ? null : timeScale.coordinateToLogical(lastX);
    if (lastLogical == null) return null;
    const logical = Math.round(lastLogical) + (time - this.lastTime) / this.interval;
    const c = timeScale.logicalToCoordinate(logical as never);
    return c == null ? null : (c as number);
  }
}

/** Fill of a port result; per-bar colours may hold na (null) values */
type PlotFill = FillData & { colors?: Array<string | null | undefined> };

/** Gradient of a fill (FillData / FillConfig `gradient`), one entry per bar index; na: null / NaN */
type FillGradientData = {
  topValue: Array<number | null | undefined>;
  bottomValue: Array<number | null | undefined>;
  topColor: Array<string | null | undefined>;
  bottomColor: Array<string | null | undefined>;
};

/** Gradient part of bar `i` of a gradient fill (null: nothing drawn on that part) */
function gradientAt(g: FillGradientData, i: number): GradientPart | null {
  return gradientPart(g.topValue[i], g.bottomValue[i], g.topColor[i], g.bottomColor[i]);
}

/** Plot fill colour when the port gives none (renderer default, not a Pine value) */
const DEFAULT_PLOT_FILL_COLOR = '#2962FF40';

/** Marker shapes of the lightweight-charts markers plugin */
const BUILTIN_MARKER_SHAPES = new Set(['arrowUp', 'arrowDown', 'circle', 'square']);

/** Marker size multiplier of a Pine size */
const PINE_SIZE_MULT: Record<PineSize, number> = { auto: 1, tiny: 0.5, small: 0.75, normal: 1, large: 1.5, huge: 2 };

function markerSizeMult(size: MarkerData['size']): number {
  if (size == null) return 1;
  if (typeof size === 'number') return Math.max(0, size);
  return PINE_SIZE_MULT[size] ?? 1;
}

/**
 * Anchor line data (invisible series that holds a primitive): one point per time, sorted, future times on the
 * bar grid, so the time scale and the autoscale include the drawings.
 */
function anchorData(points: Array<{ time: number; value: number }>, grid: BarGrid): LineData<Time>[] {
  const byTime = new Map<number, number>();
  for (const p of points) {
    if (p.value == null || Number.isNaN(p.value) || p.time == null || Number.isNaN(p.time)) continue;
    const t = grid.snap(p.time);
    if (!byTime.has(t)) byTime.set(t, p.value);
  }
  return Array.from(byTime.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([t, v]) => ({ time: t as unknown as Time, value: v }));
}

// ─── Series Primitives ──────────────────────────────────────────────────────

/**
 * Base class for Series Primitives that need access to chart/series references
 */
class BasePrimitive implements ISeriesPrimitive<Time> {
  protected _chart: IChartApi | null = null;
  protected _series: ISeriesApi<SeriesType, Time> | null = null;
  protected _requestUpdate: (() => void) | null = null;

  attached(param: SeriesAttachedParameter<Time, SeriesType>): void {
    this._chart = param.chart as IChartApi;
    this._series = param.series as ISeriesApi<SeriesType, Time>;
    this._requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
  }
}

/**
 * Line-break primitive — draws a line that breaks at NaN gaps.
 * Used for plot.style_linebr where the line disappears during NaN runs.
 * Per-point colours follow Pine: the segment that leads into a point has the colour of that point;
 * with steps, the horizontal part at the previous value keeps the previous
 * point colour and the vertical part into the point has the point colour.
 */
class LineBrPrimitive extends BasePrimitive {
  private _data: Array<{ time: number; value: number; color?: string }> = [];
  private _color: string = '#2962FF';
  private _lineWidth: number = 2;
  private _lineStyle: number = 0; // LineStyle.Solid
  private _withSteps: boolean = false;
  private _views: IPrimitivePaneView[] = [new LineBrPaneView(this)];

  setData(data: Array<{ time: number; value: number; color?: string }>, color: string, lineWidth: number = 2, lineStyle: number = 0, withSteps: boolean = false): void {
    this._data = data;
    this._color = color;
    this._lineWidth = lineWidth;
    this._lineStyle = lineStyle;
    this._withSteps = withSteps;
    this._requestUpdate?.();
  }

  getData() { return this._data; }
  getColor() { return this._color; }
  getLineWidth() { return this._lineWidth; }
  getLineStyle() { return this._lineStyle; }
  getWithSteps() { return this._withSteps; }
  getChart() { return this._chart; }
  getSeries() { return this._series; }

  updateAllViews(): void {}

  paneViews(): readonly IPrimitivePaneView[] {
    return this._views;
  }
}

class LineBrPaneView implements IPrimitivePaneView {
  constructor(private _source: LineBrPrimitive) {}

  zOrder(): 'normal' { return 'normal'; }

  renderer(): IPrimitivePaneRenderer | null {
    return new LineBrRenderer(this._source);
  }
}

class LineBrRenderer implements IPrimitivePaneRenderer {
  constructor(private _source: LineBrPrimitive) {}

  draw(target: CanvasRenderingTarget2D): void {
    const chart = this._source.getChart();
    const series = this._source.getSeries();
    if (!chart || !series) return;

    const data = this._source.getData();
    const defaultColor = this._source.getColor();
    const lineWidth = this._source.getLineWidth();
    const lineStyle = this._source.getLineStyle();
    const withSteps = this._source.getWithSteps();
    const timeScale = chart.timeScale();

    target.useMediaCoordinateSpace(({ context: ctx }) => {
      ctx.lineWidth = lineWidth;
      if (lineStyle === 1) { // Dashed
        ctx.setLineDash([4, 4]);
      } else if (lineStyle === 2) { // Dotted
        ctx.setLineDash([2, 2]);
      }

      // Path pieces of the same colour are stroked together (dash pattern continues along a run)
      let pathColor: string | null = null;
      const setColor = (color: string, x: number, y: number) => {
        if (color === pathColor) return;
        if (pathColor !== null) ctx.stroke();
        pathColor = color;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y);
      };
      const flush = () => {
        if (pathColor !== null) ctx.stroke();
        pathColor = null;
      };

      let prev: { x: number; y: number; color: string } | null = null;
      for (const point of data) {
        const isNaN = point.value == null || Number.isNaN(point.value);
        const x = isNaN ? null : timeScale.timeToCoordinate(point.time as unknown as Time);
        const y = isNaN ? null : series.priceToCoordinate(point.value);
        if (x == null || y == null) {
          // gap: end the current line
          flush();
          prev = null;
          continue;
        }
        const color = point.color ?? defaultColor;
        if (prev) {
          if (withSteps) {
            setColor(prev.color, prev.x, prev.y);
            ctx.lineTo(x as number, prev.y);
            setColor(color, x as number, prev.y);
            ctx.lineTo(x as number, y as number);
          } else {
            setColor(color, prev.x, prev.y);
            ctx.lineTo(x as number, y as number);
          }
        }
        prev = { x: x as number, y: y as number, color };
      }
      flush();

      ctx.setLineDash([]);
    });
  }
}

/**
 * Cross marker plot style — draws X marks at data points
 */
class CrossPlotPrimitive extends BasePrimitive {
  private _data: Array<{ time: number; value: number }> = [];
  private _color: string = '#2962FF';
  private _size: number = 6;
  private _views: IPrimitivePaneView[] = [new CrossPlotPaneView(this)];

  setData(data: Array<{ time: number; value: number }>, color: string, size: number = 6): void {
    this._data = data;
    this._color = color;
    this._size = size;
    this._requestUpdate?.();
  }

  getData() { return this._data; }
  getColor() { return this._color; }
  getSize() { return this._size; }
  getChart() { return this._chart; }
  getSeries() { return this._series; }

  updateAllViews(): void {}

  paneViews(): readonly IPrimitivePaneView[] {
    return this._views;
  }
}

class CrossPlotPaneView implements IPrimitivePaneView {
  constructor(private _source: CrossPlotPrimitive) {}

  zOrder(): 'normal' { return 'normal'; }

  renderer(): IPrimitivePaneRenderer | null {
    return new CrossPlotRenderer(this._source);
  }
}

class CrossPlotRenderer implements IPrimitivePaneRenderer {
  constructor(private _source: CrossPlotPrimitive) {}

  draw(target: CanvasRenderingTarget2D): void {
    const chart = this._source.getChart();
    const series = this._source.getSeries();
    if (!chart || !series) return;

    const data = this._source.getData();
    const color = this._source.getColor();
    const halfSize = this._source.getSize();
    const timeScale = chart.timeScale();

    target.useMediaCoordinateSpace(({ context: ctx }) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      for (const point of data) {
        if (point.value == null || Number.isNaN(point.value)) continue;
        const x = timeScale.timeToCoordinate(point.time as unknown as Time);
        const y = series.priceToCoordinate(point.value);
        if (x == null || y == null) continue;

        ctx.beginPath();
        ctx.moveTo(x - halfSize, y - halfSize);
        ctx.lineTo(x + halfSize, y + halfSize);
        ctx.moveTo(x + halfSize, y - halfSize);
        ctx.lineTo(x - halfSize, y + halfSize);
        ctx.stroke();
      }
    });
  }
}

/**
 * Background color primitive — fills rectangular areas behind bars
 */
class BgColorPrimitive extends BasePrimitive {
  private _data: BgColorData[] = [];
  private _views: IPrimitivePaneView[] = [new BgColorPaneView(this)];

  setData(data: BgColorData[]): void {
    this._data = data;
    this._requestUpdate?.();
  }

  getData() { return this._data; }
  getChart() { return this._chart; }
  getSeries() { return this._series; }

  updateAllViews(): void {}

  paneViews(): readonly IPrimitivePaneView[] {
    return this._views;
  }
}

class BgColorPaneView implements IPrimitivePaneView {
  constructor(private _source: BgColorPrimitive) {}

  zOrder(): 'bottom' { return 'bottom'; }

  renderer(): IPrimitivePaneRenderer | null {
    return new BgColorRenderer(this._source);
  }
}

class BgColorRenderer implements IPrimitivePaneRenderer {
  constructor(private _source: BgColorPrimitive) {}

  draw(target: CanvasRenderingTarget2D): void {
    const chart = this._source.getChart();
    if (!chart) return;

    const data = this._source.getData();
    const timeScale = chart.timeScale();

    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const barWidth = getBarWidth(timeScale, mediaSize.width);
      for (const bar of data) {
        const x = timeScale.timeToCoordinate(bar.time as unknown as Time);
        if (x == null) continue;
        ctx.fillStyle = bar.color;
        ctx.fillRect(x - barWidth / 2, 0, barWidth, mediaSize.height);
      }
    });
  }
}

/**
 * Plot fill primitive: Pine fill(plot1, plot2, color) between two plots.
 * Pine fills the polygon between the two plot lines; the part between bar i - 1 and bar i has the colour of bar i,
 * and an na colour on
 * bar i removes that part only. A bar where either plot is na breaks the fill (fillgaps = false).
 * Gradient fills: the part between bar i - 1 and bar i gets the vertical gradient of bar i (a canvas linear
 * gradient from the y of top_value to the y of bottom_value; the canvas keeps the end colours outside it, which is
 * the Pine clamping), see drawGradient.
 * Drawn as a primitive (not AreaSeries pairs) to avoid masking overlay candlesticks.
 */
interface PlotFillPoint {
  time: number;
  /** plot1 / plot2 values (NaN = na) */
  v1: number;
  v2: number;
  /** fill colour of the part that leads into this point (CSS colour with its final alpha); null = na, no fill */
  color: string | null;
  /**
   * Gradient fill (Pine fill(p1, p2, top_value, bottom_value, top_color, bottom_color)): gradient of the part that
   * leads into this point, used instead of `color`; null = nothing drawn on that part (see gradientPart)
   */
  gradient?: GradientPart | null;
}

class PlotFillPrimitive extends BasePrimitive {
  private _data: PlotFillPoint[] = [];
  private _views: IPrimitivePaneView[] = [new PlotFillPaneView(this)];

  setData(data: PlotFillPoint[]): void {
    this._data = data;
    this._requestUpdate?.();
  }

  getData() { return this._data; }
  getChart() { return this._chart; }
  getSeries() { return this._series; }

  updateAllViews(): void {}

  paneViews(): readonly IPrimitivePaneView[] {
    return this._views;
  }
}

class PlotFillPaneView implements IPrimitivePaneView {
  constructor(private _source: PlotFillPrimitive) {}

  zOrder(): 'bottom' { return 'bottom'; }

  renderer(): IPrimitivePaneRenderer | null {
    return new PlotFillRenderer(this._source);
  }
}

class PlotFillRenderer implements IPrimitivePaneRenderer {
  constructor(private _source: PlotFillPrimitive) {}

  draw(target: CanvasRenderingTarget2D): void {
    const chart = this._source.getChart();
    const series = this._source.getSeries();
    if (!chart || !series) return;

    const data = this._source.getData();
    const timeScale = chart.timeScale();
    const isGradient = data.some(p => p.gradient !== undefined);

    target.useMediaCoordinateSpace(({ context: ctx }) => {
      type Pt = { x: number; y1: number; y2: number };
      const pointAt = (p: PlotFillPoint): Pt | null => {
        if (!Number.isFinite(p.v1) || !Number.isFinite(p.v2)) return null;
        const x = timeScale.timeToCoordinate(p.time as unknown as Time);
        const y1 = series.priceToCoordinate(p.v1);
        const y2 = series.priceToCoordinate(p.v2);
        return x != null && y1 != null && y2 != null ? { x: x as number, y1: y1 as number, y2: y2 as number } : null;
      };

      if (isGradient) {
        this.drawGradient(ctx, data, pointAt, series);
        return;
      }

      // consecutive parts of the same colour are filled as one polygon (no seam between bars)
      let run: { color: string; pts: Pt[] } | null = null;
      const flush = () => {
        if (run && run.pts.length >= 2) {
          const pts = run.pts;
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y1);
          for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y1);
          for (let k = pts.length - 1; k >= 0; k--) ctx.lineTo(pts[k].x, pts[k].y2);
          ctx.closePath();
          ctx.fillStyle = run.color;
          ctx.fill();
        }
        run = null;
      };

      let prev: Pt | null = null;
      for (const p of data) {
        const cur = pointAt(p);
        if (!cur) {
          flush();
          prev = null;
          continue;
        }
        if (prev && p.color) {
          if (!run || run.color !== p.color) {
            flush();
            run = { color: p.color, pts: [prev] };
          }
          run.pts.push(cur);
        } else {
          flush();
        }
        prev = cur;
      }
      flush();
    });
  }

  /**
   * Gradient fill: each stretch of bars where both plots have a value is clipped to its polygon, and each part
   * (bar i - 1 to bar i) is painted with the vertical gradient of bar i as a rectangle between the two bar x (rounded
   * to device pixels, so neighbour parts neither overlap nor leave a seam). Consecutive parts with the same gradient
   * share one rectangle.
   */
  private drawGradient(
    ctx: CanvasRenderingContext2D,
    data: PlotFillPoint[],
    pointAt: (p: PlotFillPoint) => { x: number; y1: number; y2: number } | null,
    series: ISeriesApi<SeriesType>
  ): void {
    type Pt = { x: number; y1: number; y2: number };
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const snap = (x: number) => Math.round(x * dpr) / dpr;
    const keyOf = (g: GradientPart) => `${g.top}|${g.bottom}|${g.topColor}|${g.bottomColor}`;

    const paintStretch = (pts: Pt[], parts: Array<GradientPart | null>) => {
      if (pts.length < 2) return;
      let yMin = Infinity;
      let yMax = -Infinity;
      for (const p of pts) {
        yMin = Math.min(yMin, p.y1, p.y2);
        yMax = Math.max(yMax, p.y1, p.y2);
      }
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y1);
      for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y1);
      for (let k = pts.length - 1; k >= 0; k--) ctx.lineTo(pts[k].x, pts[k].y2);
      ctx.closePath();
      ctx.clip();
      // parts[k] is the part from pts[k - 1] to pts[k]
      let k = 1;
      while (k < pts.length) {
        const g = parts[k];
        let end = k;
        if (g) {
          const key = keyOf(g);
          while (end + 1 < pts.length && parts[end + 1] && keyOf(parts[end + 1]!) === key) end++;
          const yTop = series.priceToCoordinate(g.top);
          const yBottom = series.priceToCoordinate(g.bottom);
          if (yTop != null && yBottom != null) {
            const grad = ctx.createLinearGradient(0, yTop as number, 0, yBottom as number);
            grad.addColorStop(0, g.topColor);
            grad.addColorStop(1, g.bottomColor);
            const x0 = snap(pts[k - 1].x);
            const x1 = snap(pts[end].x);
            ctx.fillStyle = grad;
            ctx.fillRect(x0, yMin - 1, x1 - x0, yMax - yMin + 2);
          }
        }
        k = end + 1;
      }
      ctx.restore();
    };

    let pts: Pt[] = [];
    let parts: Array<GradientPart | null> = [];
    for (const p of data) {
      const cur = pointAt(p);
      if (!cur) {
        paintStretch(pts, parts);
        pts = [];
        parts = [];
        continue;
      }
      pts.push(cur);
      parts.push(pts.length > 1 ? p.gradient ?? null : null);
    }
    paintStretch(pts, parts);
  }
}

/**
 * Extended marker primitive — draws the markers that the lightweight-charts markers plugin cannot draw:
 * shapes beyond the 4 built-in ones, a text colour different from the shape colour (Pine textcolor), shapes with
 * a transparent colour (Pine color = na: text only), multi-line text and label shapes (text inside the label).
 * Positions: aboveBar / belowBar / inBar next to the bar of the price series (markers of one bar stacked away from
 * the bar), atPriceTop / atPriceBottom / atPriceMiddle at marker.price (see MarkerData).
 * Pine layout: a label has its text inside and its tip on the bar / price;
 * other shapes have the text on the far side of the shape (above for abovebar, below for belowbar).
 */
class ExtendedMarkerPrimitive extends BasePrimitive {
  private _markers: MarkerData[] = [];
  private _views: IPrimitivePaneView[] = [new ExtendedMarkerPaneView(this)];

  constructor(private _grid: BarGrid) {
    super();
  }

  setMarkers(markers: MarkerData[]): void {
    this._markers = markers;
    this._requestUpdate?.();
  }

  getMarkers() { return this._markers; }
  getGrid() { return this._grid; }
  getChart() { return this._chart; }
  getSeries() { return this._series; }

  updateAllViews(): void {}

  paneViews(): readonly IPrimitivePaneView[] {
    return this._views;
  }
}

class ExtendedMarkerPaneView implements IPrimitivePaneView {
  constructor(private _source: ExtendedMarkerPrimitive) {}

  zOrder(): 'normal' { return 'normal'; }

  renderer(): IPrimitivePaneRenderer | null {
    return new ExtendedMarkerRenderer(this._source);
  }
}

/** Font size (px) of the text of a marker */
function markerFontSize(size: MarkerData['size']): number {
  if (typeof size === 'string') {
    return ({ tiny: 9, small: 10, normal: 12, large: 14, huge: 18, auto: 11 } as Record<string, number>)[size] ?? 11;
  }
  return Math.max(7, Math.round(11 * (size ?? 1)));
}

const MARKER_BAR_GAP = 4; // px between the bar and the first marker
const MARKER_STACK_GAP = 2; // px between two stacked markers
const LABEL_PAD = 3;
const LABEL_POINTER = 5;

class ExtendedMarkerRenderer implements IPrimitivePaneRenderer {
  constructor(private _source: ExtendedMarkerPrimitive) {}

  draw(target: CanvasRenderingTarget2D): void {
    const chart = this._source.getChart();
    const series = this._source.getSeries();
    if (!chart || !series) return;

    const markers = this._source.getMarkers();
    const grid = this._source.getGrid();
    const timeScale = chart.timeScale();

    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      // height already used above / below each bar (and from the pane top / bottom) by earlier markers
      const usedAbove = new Map<number, number>();
      const usedBelow = new Map<number, number>();
      const usedTop = new Map<number, number>();
      const usedBottom = new Map<number, number>();

      for (const marker of markers) {
        const x = grid.x(timeScale, marker.time);
        if (x == null) continue;

        const mult = markerSizeMult(marker.size);
        const fontSize = markerFontSize(marker.size);
        const lineHeight = Math.round(fontSize * 1.2);
        const lines = marker.text ? marker.text.split('\n') : [];
        ctx.font = `${fontSize}px sans-serif`;
        const textWidth = lines.reduce((w, l) => Math.max(w, ctx.measureText(l).width), 0);
        const isLabel = marker.shape === 'labelUp' || marker.shape === 'labelDown';
        const half = 6 * mult; // half size of a shape
        const textH = lines.length ? 2 + lines.length * lineHeight : 0;

        // Height of the marker (shape and text)
        const height = isLabel
          ? Math.max(lines.length, 1) * lineHeight + LABEL_PAD * 2 + LABEL_POINTER
          : half * 2 + textH;

        // Anchor y and direction: -1 = the marker extends upward from the anchor, 1 = downward, 0 = centred
        let anchorY: number | null = null;
        let dir: -1 | 0 | 1 = 0;
        if (marker.position === 'top' || marker.position === 'bottom') {
          // pane edge: stacked from the top edge downward / from the bottom edge upward
          const edgeMap = marker.position === 'top' ? usedTop : usedBottom;
          const used = edgeMap.get(marker.time) ?? 0;
          edgeMap.set(marker.time, used + height + MARKER_STACK_GAP);
          anchorY = marker.position === 'top' ? MARKER_BAR_GAP + used : mediaSize.height - MARKER_BAR_GAP - used;
          dir = marker.position === 'top' ? 1 : -1;
        } else if (marker.position === 'atPriceTop' || marker.position === 'atPriceBottom' || marker.position === 'atPriceMiddle') {
          if (marker.price == null || Number.isNaN(marker.price)) continue;
          anchorY = series.priceToCoordinate(marker.price);
          dir = marker.position === 'atPriceTop' ? -1 : marker.position === 'atPriceBottom' ? 1 : 0;
        } else {
          const bar = grid.byTime.get(marker.time);
          if (!bar) continue;
          if (marker.position === 'aboveBar') {
            const y = series.priceToCoordinate(bar.high);
            if (y == null) continue;
            const used = usedAbove.get(marker.time) ?? 0;
            anchorY = (y as number) - MARKER_BAR_GAP - used;
            usedAbove.set(marker.time, used + height + MARKER_STACK_GAP);
            dir = -1;
          } else if (marker.position === 'belowBar') {
            const y = series.priceToCoordinate(bar.low);
            if (y == null) continue;
            const used = usedBelow.get(marker.time) ?? 0;
            anchorY = (y as number) + MARKER_BAR_GAP + used;
            usedBelow.set(marker.time, used + height + MARKER_STACK_GAP);
            dir = 1;
          } else {
            anchorY = series.priceToCoordinate(bar.close);
          }
        }
        if (anchorY == null) continue;
        const top = dir === -1 ? anchorY - height : dir === 1 ? anchorY : anchorY - height / 2;
        const showShape = !isTransparent(marker.color);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (isLabel) {
          // label: box with the text inside and a pointer (on top for labelUp, below for labelDown)
          const boxW = Math.max(textWidth + LABEL_PAD * 2, 2 * half);
          const boxH = height - LABEL_POINTER;
          const up = marker.shape === 'labelUp';
          const boxTop = up ? top + LABEL_POINTER : top;
          if (showShape) {
            ctx.fillStyle = marker.color;
            ctx.beginPath();
            ctx.roundRect(x - boxW / 2, boxTop, boxW, boxH, 2);
            ctx.fill();
            ctx.beginPath();
            if (up) {
              ctx.moveTo(x, top);
              ctx.lineTo(x - LABEL_POINTER, boxTop + 0.5);
              ctx.lineTo(x + LABEL_POINTER, boxTop + 0.5);
            } else {
              ctx.moveTo(x, top + height);
              ctx.lineTo(x - LABEL_POINTER, boxTop + boxH - 0.5);
              ctx.lineTo(x + LABEL_POINTER, boxTop + boxH - 0.5);
            }
            ctx.closePath();
            ctx.fill();
          }
          if (lines.length) {
            ctx.fillStyle = marker.textColor ?? '#ffffff';
            lines.forEach((l, k) => ctx.fillText(l, x, boxTop + LABEL_PAD + lineHeight * (k + 0.5)));
          }
          continue;
        }

        // other shapes: the shape on the anchor side, the text on the far side (above when the marker extends
        // upward, below otherwise)
        const shapeCy = dir === -1 ? top + textH + half : top + half;
        if (showShape && marker.char) {
          // plotchar: the character in place of the shape
          ctx.font = `${Math.round(half * 2.4)}px sans-serif`;
          ctx.fillStyle = marker.color;
          ctx.fillText(marker.char, x, shapeCy);
          ctx.font = `${fontSize}px sans-serif`;
        } else if (showShape) {
          ctx.fillStyle = marker.color;
          ctx.strokeStyle = marker.color;
          ctx.lineWidth = 2;
          drawExtendedShape(ctx, marker.shape, x, shapeCy, half);
        }
        if (lines.length) {
          ctx.fillStyle = marker.textColor ?? marker.color;
          const textTop = dir === -1 ? top : top + half * 2 + 2;
          lines.forEach((l, k) => ctx.fillText(l, x, textTop + lineHeight * (k + 0.5)));
        }
      }
    });
  }
}

function drawExtendedShape(
  ctx: CanvasRenderingContext2D,
  shape: string,
  x: number,
  y: number,
  size: number
): void {
  switch (shape) {
    case 'triangleUp':
      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.lineTo(x - size, y + size);
      ctx.lineTo(x + size, y + size);
      ctx.closePath();
      ctx.fill();
      break;
    case 'triangleDown':
      ctx.beginPath();
      ctx.moveTo(x, y + size);
      ctx.lineTo(x - size, y - size);
      ctx.lineTo(x + size, y - size);
      ctx.closePath();
      ctx.fill();
      break;
    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.lineTo(x + size, y);
      ctx.lineTo(x, y + size);
      ctx.lineTo(x - size, y);
      ctx.closePath();
      ctx.fill();
      break;
    case 'cross':
      ctx.beginPath();
      ctx.moveTo(x - size, y);
      ctx.lineTo(x + size, y);
      ctx.moveTo(x, y - size);
      ctx.lineTo(x, y + size);
      ctx.stroke();
      break;
    case 'xcross':
      ctx.beginPath();
      ctx.moveTo(x - size, y - size);
      ctx.lineTo(x + size, y + size);
      ctx.moveTo(x + size, y - size);
      ctx.lineTo(x - size, y + size);
      ctx.stroke();
      break;
    case 'flag':
      // Draw pole (centred on y)
      ctx.beginPath();
      ctx.moveTo(x, y + size);
      ctx.lineTo(x, y - size);
      ctx.stroke();
      // Draw flag pennant
      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.lineTo(x + size * 1.5, y - size * 0.5);
      ctx.lineTo(x, y);
      ctx.closePath();
      ctx.fill();
      break;
    // built-in lightweight-charts shapes, drawn here when the marker needs this primitive (text colour, ...)
    case 'circle':
      ctx.beginPath();
      ctx.arc(x, y, size * 0.8, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'square':
      ctx.fillRect(x - size * 0.8, y - size * 0.8, size * 1.6, size * 1.6);
      break;
    case 'arrowUp':
    case 'arrowDown': {
      const d = shape === 'arrowUp' ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(x, y + d * size);
      ctx.lineTo(x - size * 0.8, y);
      ctx.lineTo(x - size * 0.3, y);
      ctx.lineTo(x - size * 0.3, y - d * size);
      ctx.lineTo(x + size * 0.3, y - d * size);
      ctx.lineTo(x + size * 0.3, y);
      ctx.lineTo(x + size * 0.8, y);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
}

// ─── Drawings (label.new / line.new / box.new / linefill.new / polyline.new) ─

/**
 * PineScript default colour of drawings (color.blue). Drawing properties follow the oakscriptjs rules: a property
 * the script did not set is omitted and the PineScript default applies; a colour set to na is 'transparent'.
 */
const PINE_BLUE = '#2962FF';

/** Context of a drawing function (media coordinates) */
interface DrawEnv {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  series: ISeriesApi<SeriesType, Time>;
  grid: BarGrid;
  timeScale: ReturnType<IChartApi['timeScale']>;
}

/**
 * Primitive that draws a list of drawings of one kind with its draw function.
 */
class DrawingPrimitive<T> extends BasePrimitive {
  private _views: IPrimitivePaneView[];

  constructor(
    private _grid: BarGrid,
    private _items: T[],
    private _draw: (env: DrawEnv, item: T) => void,
    zOrder: 'bottom' | 'normal' | 'top'
  ) {
    super();
    const renderer: IPrimitivePaneRenderer = { draw: (target) => this.drawAll(target) };
    this._views = [{ zOrder: () => zOrder, renderer: () => renderer }];
  }

  updateAllViews(): void {}

  paneViews(): readonly IPrimitivePaneView[] {
    return this._views;
  }

  private drawAll(target: CanvasRenderingTarget2D): void {
    const chart = this._chart;
    const series = this._series;
    if (!chart || !series) return;
    const timeScale = chart.timeScale();
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const env: DrawEnv = { ctx, width: mediaSize.width, height: mediaSize.height, series, grid: this._grid, timeScale };
      for (const item of this._items) {
        ctx.save();
        this._draw(env, item);
        ctx.restore();
      }
    });
  }
}

/** A colour that draws something: set and not fully transparent */
function shown(color: string | undefined): color is string {
  return !!color && !isTransparent(color);
}

/** Canvas dash of a PineScript line style (the arrow styles are solid) */
function lineDash(style: string | undefined): number[] {
  if (style === 'dashed') return [6, 3];
  if (style === 'dotted') return [2, 2];
  return [];
}

/** Font size (px) of label and box text */
const TEXT_SIZES: Record<PineSize, number> = { auto: 13, tiny: 9, small: 11, normal: 13, large: 16, huge: 20 };

/** Font size (px) of a PineScript size: a size.* constant or a size in points */
function textPx(size: PineSize | number | undefined): number {
  if (typeof size === 'number') return Math.max(1, size);
  return TEXT_SIZES[size ?? 'normal'] ?? 13;
}

/** Canvas / CSS font: PineScript font family (font.family_*) and text.format_* flags (1 bold, 2 italic) */
function fontOf(px: number, family?: 'default' | 'monospace', formatting?: number): string {
  const f = formatting ?? 0;
  return `${f & 2 ? 'italic ' : ''}${f & 1 ? 'bold ' : ''}${px}px ${family === 'monospace' ? 'monospace' : 'sans-serif'}`;
}

/** Open arrow head at (tipX, tipY), pointing away from (fromX, fromY) */
function arrowHead(ctx: CanvasRenderingContext2D, tipX: number, tipY: number, fromX: number, fromY: number, width: number): void {
  const a = Math.atan2(tipY - fromY, tipX - fromX);
  const len = 6 + 2 * width;
  ctx.beginPath();
  ctx.moveTo(tipX - len * Math.cos(a - Math.PI / 7), tipY - len * Math.sin(a - Math.PI / 7));
  ctx.lineTo(tipX, tipY);
  ctx.lineTo(tipX - len * Math.cos(a + Math.PI / 7), tipY - len * Math.sin(a + Math.PI / 7));
  ctx.stroke();
}

/**
 * End points (x1, y1, x2, y2) of a line as drawn: point 1 and point 2, moved to the left / right edge of the pane by
 * the line extension (extend.left continues the line beyond its left point). null when a point is not on the chart.
 */
function linePoints(env: DrawEnv, line: LineDrawingData): [number, number, number, number] | null {
  const x1 = env.grid.x(env.timeScale, line.time1);
  const y1 = env.series.priceToCoordinate(line.price1);
  const x2 = env.grid.x(env.timeScale, line.time2);
  const y2 = env.series.priceToCoordinate(line.price2);
  if (x1 == null || y1 == null || x2 == null || y2 == null) return null;
  const extend = line.extend ?? 'none';
  const left = extend === 'left' || extend === 'both';
  const right = extend === 'right' || extend === 'both';
  if (x1 === x2) {
    // vertical line: an extension continues it to the pane edges
    return extend === 'none' ? [x1, y1, x2, y2] : [x1, y1 <= y2 ? 0 : env.height, x2, y1 <= y2 ? env.height : 0];
  }
  const slope = (y2 - y1) / (x2 - x1);
  let [ax, ay, bx, by]: number[] = x1 < x2 ? [x1, y1, x2, y2] : [x2, y2, x1, y1];
  if (left) { ay -= slope * ax; ax = 0; }
  if (right) { by += slope * (env.width - bx); bx = env.width; }
  return x1 < x2 ? [ax, ay, bx, by] : [bx, by, ax, ay];
}

function drawLine(env: DrawEnv, line: LineDrawingData): void {
  const color = line.color ?? PINE_BLUE;
  const width = line.width ?? 1;
  const p = linePoints(env, line);
  if (!p || !shown(color) || width <= 0) return;
  const { ctx } = env;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(lineDash(line.style));
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  ctx.lineTo(p[2], p[3]);
  ctx.stroke();
  ctx.setLineDash([]);
  if (line.style === 'arrow_left' || line.style === 'arrow_both') arrowHead(ctx, p[0], p[1], p[2], p[3], width);
  if (line.style === 'arrow_right' || line.style === 'arrow_both') arrowHead(ctx, p[2], p[3], p[0], p[1], width);
}

/** linefill.new: the area between the two lines as drawn (their extensions included) */
function drawLinefill(env: DrawEnv, fill: LinefillData): void {
  const color = fill.color ?? PINE_BLUE;
  if (!shown(color)) return;
  const a = linePoints(env, fill.line1);
  const b = linePoints(env, fill.line2);
  if (!a || !b) return;
  // each line from its left point to its right point, so the polygon does not cross itself
  const [al, ar] = a[0] <= a[2] ? [[a[0], a[1]], [a[2], a[3]]] : [[a[2], a[3]], [a[0], a[1]]];
  const [bl, br] = b[0] <= b[2] ? [[b[0], b[1]], [b[2], b[3]]] : [[b[2], b[3]], [b[0], b[1]]];
  const { ctx } = env;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(al[0], al[1]);
  ctx.lineTo(ar[0], ar[1]);
  ctx.lineTo(br[0], br[1]);
  ctx.lineTo(bl[0], bl[1]);
  ctx.closePath();
  ctx.fill();
}

/** Path through the points: straight segments, or a curve through the points (Catmull-Rom spline) */
function polylinePath(pts: Array<[number, number]>, curved: boolean, closed: boolean): Path2D {
  const path = new Path2D();
  path.moveTo(pts[0][0], pts[0][1]);
  const n = pts.length;
  if (!curved) {
    for (let i = 1; i < n; i++) path.lineTo(pts[i][0], pts[i][1]);
  } else {
    const at = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
      path.bezierCurveTo(
        p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
        p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
        p2[0], p2[1]
      );
    }
  }
  if (closed) path.closePath();
  return path;
}

/** polyline.new: line through the points (curved, closed), fill of the area inside */
function drawPolyline(env: DrawEnv, poly: PolylineData): void {
  const pts: Array<[number, number]> = [];
  for (const p of poly.points) {
    const x = env.grid.x(env.timeScale, p.time);
    const y = env.series.priceToCoordinate(p.price);
    if (x != null && y != null) pts.push([x, y as number]);
  }
  if (pts.length < 2) return;
  const { ctx } = env;
  const path = polylinePath(pts, !!poly.curved, !!poly.closed);
  if (shown(poly.fillColor)) {
    ctx.fillStyle = poly.fillColor;
    ctx.fill(path);
  }
  const color = poly.lineColor ?? PINE_BLUE;
  const width = poly.lineWidth ?? 1;
  if (!shown(color) || width <= 0) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(lineDash(poly.lineStyle));
  ctx.stroke(path);
  ctx.setLineDash([]);
  if (poly.closed) return;
  const n = pts.length;
  if (poly.lineStyle === 'arrow_left' || poly.lineStyle === 'arrow_both') arrowHead(ctx, pts[0][0], pts[0][1], pts[1][0], pts[1][1], width);
  if (poly.lineStyle === 'arrow_right' || poly.lineStyle === 'arrow_both') {
    arrowHead(ctx, pts[n - 1][0], pts[n - 1][1], pts[n - 2][0], pts[n - 2][1], width);
  }
}

/** The arrows of one plotarrow */
interface ArrowSeries {
  arrows: ArrowData[];
  minheight: number;
  maxheight: number;
  forceOverlay: boolean;
  /** Drawn at the bars (price pane); otherwise from the pane edge */
  onBars: boolean;
}

const ARROW_BAR_GAP = 4; // px between the bar and the tip of an arrow

/**
 * plotarrow: an up arrow for a positive value (below the bar, pointing up), a down arrow for a negative value (above
 * the bar, pointing down). Height proportional to the absolute value relative to the largest absolute value of the
 * visible arrows, between minheight and maxheight.
 */
function drawArrowSeries(env: DrawEnv, s: ArrowSeries): void {
  const visible: Array<{ a: ArrowData; x: number }> = [];
  for (const a of s.arrows) {
    const x = env.grid.x(env.timeScale, a.time as number);
    if (x != null && x >= 0 && x <= env.width && a.value !== 0 && Number.isFinite(a.value)) visible.push({ a, x });
  }
  if (!visible.length) return;
  const maxAbs = visible.reduce((m, p) => Math.max(m, Math.abs(p.a.value)), 0);
  const { ctx } = env;
  for (const { a, x } of visible) {
    if (!shown(a.color)) continue;
    const up = a.value > 0;
    const h = Math.min(s.maxheight, Math.max(s.minheight, (Math.abs(a.value) / maxAbs) * s.maxheight));
    let tip: number;
    if (s.onBars) {
      const bar = env.grid.byTime.get(a.time as number);
      const y = bar ? env.series.priceToCoordinate(up ? bar.low : bar.high) : null;
      if (y == null) continue;
      tip = (y as number) + (up ? ARROW_BAR_GAP : -ARROW_BAR_GAP);
    } else {
      tip = up ? env.height - ARROW_BAR_GAP - h : ARROW_BAR_GAP + h;
    }
    const d = up ? 1 : -1; // direction from the tip to the base
    const head = Math.min(8, h);
    ctx.fillStyle = a.color;
    ctx.strokeStyle = a.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, tip + d * head);
    ctx.lineTo(x, tip + d * h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, tip);
    ctx.lineTo(x - 4, tip + d * head);
    ctx.lineTo(x + 4, tip + d * head);
    ctx.closePath();
    ctx.fill();
  }
}

const BOX_TEXT_PAD = 4;

/** Words of a text line wrapped to `width` (PineScript text.wrap_auto) */
function wrapLine(ctx: CanvasRenderingContext2D, line: string, width: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const word of line.split(' ')) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && ctx.measureText(next).width > width) {
      out.push(cur);
      cur = word;
    } else {
      cur = next;
    }
  }
  out.push(cur);
  return out;
}

/** Text of a box (clipped to the box): size auto fits the text in the box */
function drawBoxText(ctx: CanvasRenderingContext2D, box: BoxData, left: number, top: number, w: number, h: number): void {
  const color = box.textColor ?? '#000000';
  if (!box.text || !shown(color)) return;
  const innerW = w - BOX_TEXT_PAD * 2;
  const innerH = h - BOX_TEXT_PAD * 2;
  if (innerW <= 0 || innerH <= 0) return;
  let lines = box.text.split('\n');
  let px: number;
  if (box.textSize == null || box.textSize === 'auto') {
    // largest size (up to 64 px) at which the lines fit in the box
    ctx.font = fontOf(100, box.fontFamily, box.textFormatting);
    const widest = lines.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0) / 100;
    px = Math.min(64, innerH / (lines.length * 1.2), widest > 0 ? innerW / widest : 64);
    if (px < 4) return;
  } else {
    px = textPx(box.textSize);
  }
  ctx.font = fontOf(px, box.fontFamily, box.textFormatting);
  if (box.textWrap === 'auto') lines = lines.flatMap((l) => wrapLine(ctx, l, innerW));
  const lineHeight = px * 1.2;
  const textH = lines.length * lineHeight;
  const valign = box.textVAlign ?? 'center';
  const halign = box.textHAlign ?? 'center';
  const y0 = valign === 'top' ? top + BOX_TEXT_PAD : valign === 'bottom' ? top + h - BOX_TEXT_PAD - textH : top + (h - textH) / 2;
  const x = halign === 'left' ? left + BOX_TEXT_PAD : halign === 'right' ? left + w - BOX_TEXT_PAD : left + w / 2;
  ctx.beginPath();
  ctx.rect(left, top, w, h);
  ctx.clip();
  ctx.fillStyle = color;
  ctx.textAlign = halign;
  ctx.textBaseline = 'middle';
  lines.forEach((l, k) => ctx.fillText(l, x, y0 + lineHeight * (k + 0.5)));
}

function drawBox(env: DrawEnv, box: BoxData): void {
  const x1 = env.grid.x(env.timeScale, box.time1);
  const y1 = env.series.priceToCoordinate(box.price1);
  const x2 = env.grid.x(env.timeScale, box.time2);
  const y2 = env.series.priceToCoordinate(box.price2);
  if (x1 == null || y1 == null || x2 == null || y2 == null) return;
  const { ctx } = env;

  // PineScript box extend: the box continues to the left / right edge of the pane
  const extend = box.extend ?? 'none';
  const left = extend === 'left' || extend === 'both' ? 0 : Math.min(x1, x2);
  const right = extend === 'right' || extend === 'both' ? env.width : Math.max(x1, x2);
  const top = Math.min(y1, y2);
  const width = right - left;
  const height = Math.abs(y2 - y1);

  const bg = box.bgColor ?? PINE_BLUE;
  if (shown(bg)) {
    ctx.fillStyle = bg;
    ctx.fillRect(left, top, width, height);
  }
  const border = box.borderColor ?? PINE_BLUE;
  const borderWidth = box.borderWidth ?? 1;
  if (shown(border) && borderWidth > 0) {
    ctx.strokeStyle = border;
    ctx.lineWidth = borderWidth;
    ctx.setLineDash(lineDash(box.borderStyle));
    ctx.strokeRect(left, top, width, height);
    ctx.setLineDash([]);
  }
  drawBoxText(ctx, box, left, top, width, height);
}

const LABEL_BAR_GAP = 4; // px between the bar and a yloc.abovebar / belowbar label
const LABEL_PADDING = 4;
const LABEL_TIP = 6;

/** Label styles drawn as a shape (label.style_xcross ...): marker shape name */
const LABEL_SHAPES: Record<string, string> = {
  xcross: 'xcross', cross: 'cross', triangleup: 'triangleUp', triangledown: 'triangleDown', flag: 'flag',
  circle: 'circle', arrowup: 'arrowUp', arrowdown: 'arrowDown', square: 'square', diamond: 'diamond',
};

/** Half size (px) of a label shape */
const LABEL_SHAPE_HALF: Record<PineSize, number> = { auto: 5, tiny: 3, small: 4, normal: 6, large: 9, huge: 13 };

/** Corner label styles: side of the box from the point (x: 1 right, -1 left; y: 1 below, -1 above) */
const LABEL_CORNERS: Record<string, [number, number]> = {
  label_lower_left: [1, -1], label_lower_right: [-1, -1], label_upper_left: [1, 1], label_upper_right: [-1, 1],
};

/**
 * Label geometry (PineScript label styles, default label_down): label_down = box above the point with a tip down to
 * it, label_up = box below with a tip up, label_left / label_right = box right / left of the point, the corner styles
 * (label_lower_left ...) = box with that corner at the point, label_center = box centred on the point; the shape
 * styles (xcross, triangleup, ...) draw the shape at the point with the text above it (below for arrowup /
 * triangleup); none = text only; text_outline = text outlined with the label colour. yloc abovebar / belowbar: the
 * point is the bar high / low, and a centred box, a shape or a text is moved above / below it.
 */
function drawLabel(env: DrawEnv, label: LabelData): void {
  const x = env.grid.x(env.timeScale, label.time);
  if (x == null) return;
  const yloc = label.yloc ?? 'price';
  let y: number | null;
  if (yloc === 'price') {
    y = env.series.priceToCoordinate(label.price);
  } else {
    const bar = env.grid.byTime.get(label.time);
    if (!bar) return;
    const by = env.series.priceToCoordinate(yloc === 'abovebar' ? bar.high : bar.low);
    y = by == null ? null : (by as number) + (yloc === 'abovebar' ? -LABEL_BAR_GAP : LABEL_BAR_GAP);
  }
  if (y == null) return;

  const { ctx } = env;
  const style = label.style ?? 'label_down';
  const color = label.color ?? PINE_BLUE;
  const textColor = label.textColor ?? '#ffffff';
  const px = textPx(label.size);
  ctx.font = fontOf(px, label.fontFamily, label.textFormatting);
  const lines = label.text.split('\n');
  const lineHeight = Math.round(px * 1.2);
  const textWidth = lines.reduce((w, l) => Math.max(w, ctx.measureText(l).width), 0);
  const textH = lines.length * lineHeight;
  const align = label.textAlign ?? 'center';

  // text lines in the column [left, left + w] from `top`; outline: stroke with `outline` before the fill
  const writeLines = (left: number, w: number, top: number, outline?: string) => {
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    const tx = align === 'left' ? left : align === 'right' ? left + w : left + w / 2;
    lines.forEach((l, k) => {
      const ty = top + lineHeight * (k + 0.5);
      if (outline) {
        ctx.strokeStyle = outline;
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.strokeText(l, tx, ty);
      }
      if (shown(textColor)) {
        ctx.fillStyle = textColor;
        ctx.fillText(l, tx, ty);
      }
    });
  };

  const shape = LABEL_SHAPES[style];
  if (shape) {
    const half = typeof label.size === 'number' ? Math.max(2, label.size / 2) : LABEL_SHAPE_HALF[label.size ?? 'normal'] ?? 6;
    const cy = yloc === 'abovebar' ? y - half : yloc === 'belowbar' ? y + half : y;
    if (shown(color)) {
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      drawExtendedShape(ctx, shape, x, cy, half);
    }
    const below = style === 'arrowup' || style === 'triangleup';
    writeLines(x - textWidth / 2, textWidth, below ? cy + half + 2 : cy - half - 2 - textH);
    return;
  }

  if (style === 'none' || style === 'text_outline') {
    const top = yloc === 'abovebar' ? y - textH : yloc === 'belowbar' ? y : y - textH / 2;
    writeLines(x - textWidth / 2, textWidth, top, style === 'text_outline' && shown(color) ? color : undefined);
    return;
  }

  // box styles: box position (left, top) and the tip triangle
  const w = textWidth + LABEL_PADDING * 2;
  const h = textH + LABEL_PADDING * 2;
  let left = x - w / 2;
  let top = y - h / 2;
  let tip: Array<[number, number]> | null = null;
  const corner = LABEL_CORNERS[style];
  if (style === 'label_down') {
    top = y - LABEL_TIP - h;
    tip = [[x, y], [x - LABEL_TIP, top + h - 0.5], [x + LABEL_TIP, top + h - 0.5]];
  } else if (style === 'label_up') {
    top = y + LABEL_TIP;
    tip = [[x, y], [x - LABEL_TIP, top + 0.5], [x + LABEL_TIP, top + 0.5]];
  } else if (style === 'label_left') {
    left = x + LABEL_TIP;
    tip = [[x, y], [left + 0.5, y - LABEL_TIP], [left + 0.5, y + LABEL_TIP]];
  } else if (style === 'label_right') {
    left = x - LABEL_TIP - w;
    tip = [[x, y], [left + w - 0.5, y - LABEL_TIP], [left + w - 0.5, y + LABEL_TIP]];
  } else if (corner) {
    const [sx, sy] = corner;
    const cx = x + sx * LABEL_TIP;
    const cy = y + sy * LABEL_TIP;
    left = sx > 0 ? cx : cx - w;
    top = sy > 0 ? cy : cy - h;
    tip = [[x, y], [cx + sx * LABEL_TIP * 1.5, cy], [cx, cy + sy * LABEL_TIP * 1.5]];
  } else if (yloc === 'abovebar') {
    top = y - h;
  } else if (yloc === 'belowbar') {
    top = y;
  }

  if (shown(color)) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(left, top, w, h, 3);
    ctx.fill();
    if (tip) {
      ctx.beginPath();
      ctx.moveTo(tip[0][0], tip[0][1]);
      ctx.lineTo(tip[1][0], tip[1][1]);
      ctx.lineTo(tip[2][0], tip[2][1]);
      ctx.closePath();
      ctx.fill();
    }
  }
  writeLines(left + LABEL_PADDING, w - LABEL_PADDING * 2, top + LABEL_PADDING);
}

/** Font size (px) of table text */
const TABLE_TEXT_SIZES: Record<PineSize, number> = { auto: 11, tiny: 9, small: 10, normal: 11, large: 13, huge: 16 };

/**
 * DOM table of a table.new table: merged cells (table.merge_cells), frame and cell borders, cell width / height in %
 * of the plotting area (0: fit the text).
 */
function buildTable(table: TableData, area: { width: number; height: number }): HTMLTableElement {
  const el = document.createElement('table');
  el.style.borderCollapse = 'collapse';
  if (shown(table.bgColor)) el.style.background = table.bgColor;
  if ((table.frameWidth ?? 0) > 0 && shown(table.frameColor)) el.style.border = `${table.frameWidth}px solid ${table.frameColor}`;
  const border = (table.borderWidth ?? 0) > 0 && shown(table.borderColor) ? `${table.borderWidth}px solid ${table.borderColor}` : '';

  const cells = new Map(table.cells.map((c) => [`${c.row}_${c.column}`, c]));
  const spans = new Map<string, { rows: number; cols: number }>();
  const covered = new Set<string>();
  for (const m of table.merges ?? []) {
    spans.set(`${m.startRow}_${m.startColumn}`, { rows: m.endRow - m.startRow + 1, cols: m.endColumn - m.startColumn + 1 });
    for (let r = m.startRow; r <= m.endRow; r++) {
      for (let c = m.startColumn; c <= m.endColumn; c++) {
        if (r !== m.startRow || c !== m.startColumn) covered.add(`${r}_${c}`);
      }
    }
  }

  for (let r = 0; r < table.rows; r++) {
    const tr = el.insertRow();
    for (let c = 0; c < table.columns; c++) {
      const key = `${r}_${c}`;
      if (covered.has(key)) continue;
      const td = tr.insertCell();
      const span = spans.get(key);
      if (span) {
        td.rowSpan = span.rows;
        td.colSpan = span.cols;
      }
      td.style.padding = '2px 6px';
      td.style.whiteSpace = 'pre';
      if (border) td.style.border = border;
      const cell = cells.get(key);
      if (!cell) continue;
      td.textContent = cell.text;
      const px = typeof cell.textSize === 'number' ? Math.max(1, cell.textSize) : TABLE_TEXT_SIZES[cell.textSize ?? 'normal'] ?? 11;
      td.style.font = fontOf(px, cell.fontFamily, cell.textFormatting);
      td.style.color = cell.textColor ?? '#000000';
      if (shown(cell.bgColor)) td.style.background = cell.bgColor;
      td.style.textAlign = cell.textHAlign ?? 'center';
      td.style.verticalAlign = cell.textVAlign === 'top' ? 'top' : cell.textVAlign === 'bottom' ? 'bottom' : 'middle';
      if (cell.width) td.style.width = `${(cell.width * area.width) / 100}px`;
      if (cell.height) td.style.height = `${(cell.height * area.height) / 100}px`;
      if (cell.tooltip) {
        td.title = cell.tooltip;
        td.style.pointerEvents = 'auto';
      }
    }
  }
  return el;
}

// ─── Utility ──────────────────────────────────────────────────────────────

/**
 * Estimate bar width from the time scale's visible range
 */
function getBarWidth(timeScale: ReturnType<IChartApi['timeScale']>, mediaWidth: number): number {
  const visibleRange = timeScale.getVisibleLogicalRange();
  if (!visibleRange) return 8;
  const barsCount = visibleRange.to - visibleRange.from;
  if (barsCount <= 0) return 8;
  return Math.max(1, mediaWidth / barsCount);
}

// ─── Series configuration ─────────────────────────────────────────────────

/**
 * Series configuration
 */
export interface SeriesConfig {
  color?: string;
  lineWidth?: number;
  lineStyle?: number;
  lineType?: number;
  overlay?: boolean;
  paneIndex?: number;
  pointMarkersVisible?: boolean;
  lineVisible?: boolean;
  /** When true, NaN values create gaps (whitespace) instead of being filtered out */
  preserveGaps?: boolean;
  /** Base value of histogram / columns plots (Pine histbase, default 0) */
  histBase?: number;
}

/**
 * Chart wrapper class
 */
export class ChartManager {
  private chart: IChartApi;
  private container: HTMLElement;
  private candlestickSeries: ISeriesApi<'Candlestick'>;
  private indicatorSeries: Map<string, ISeriesApi<'Line'>> = new Map();
  /** fill primitives of plot.style_area plots, attached to their line series in indicatorSeries */
  private areaFills: Map<string, PlotFillPrimitive> = new Map();
  private histogramSeriesMap: Map<string, ISeriesApi<'Histogram'>> = new Map();
  private indicatorPanes: Map<string, number> = new Map();
  private hlineSeries: Map<string, ISeriesApi<'Line'>> = new Map();
  private fillSeries: Map<string, ISeriesApi<'Baseline'>> = new Map();
  private plotFillPrimitives: PlotFillPrimitive[] = [];
  private plotFillAnchorSeries: ISeriesApi<'Line'>[] = [];
  /** gradient fills between hlines: primitive + anchor series */
  private hlineGradientFills: Array<{ anchor: ISeriesApi<'Line'>; primitive: PlotFillPrimitive }> = [];
  private markerPlugin: ISeriesMarkersPluginApi<Time> | null = null;
  // New display component state
  private crossPrimitives: Map<string, CrossPlotPrimitive> = new Map();
  private crossAnchorSeries: Map<string, ISeriesApi<'Line'>> = new Map();
  private lineBrPrimitives: Map<string, LineBrPrimitive> = new Map();
  private lineBrAnchorSeries: Map<string, ISeriesApi<'Line'>> = new Map();
  private candlePlotSeries: Map<string, ISeriesApi<'Candlestick'>> = new Map();
  // one background primitive per pane (indicator pane, price pane for forceOverlay entries)
  private bgColorLayers: Array<{ primitive: BgColorPrimitive; anchor: ISeriesApi<'Line'> }> = [];
  private extendedMarkerPrimitive: ExtendedMarkerPrimitive | null = null;
  // atPrice* markers of a non-overlay indicator, in the indicator pane
  private paneMarkerAnchor: ISeriesApi<'Line'> | null = null;
  private paneMarkerPlugin: ISeriesMarkersPluginApi<Time> | null = null;
  private paneExtendedMarkerPrimitive: ExtendedMarkerPrimitive | null = null;
  private barPlotSeries: Map<string, ISeriesApi<'Bar'>> = new Map();
  // drawings by kind (labels, lines, ...): one primitive per pane (forceOverlay drawings go to the price pane)
  private drawingLayers: Map<string, Array<{ primitive: ISeriesPrimitive<Time>; anchor: ISeriesApi<'Line'> }>> = new Map();
  private tables: Array<{ table: TableData; pane: number; el: HTMLElement }> = [];
  private tableLayoutFrame = 0;
  private originalBarColors: CandlestickData<Time>[] | null = null;
  private grid = new BarGrid();
  // whitespace points after the last bar (future bar slots)
  private futureSeries: ISeriesApi<'Line'> | null = null;

  constructor(container: HTMLElement) {
    this.container = container;

    // Create chart with dark theme
    this.chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#1e222d' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2b2b43' },
        horzLines: { color: '#2b2b43' },
      },
      crosshair: {
        mode: 1, // Normal mode
      },
      rightPriceScale: {
        borderColor: '#2b2b43',
      },
      timeScale: {
        borderColor: '#2b2b43',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // Create candlestick series
    this.candlestickSeries = this.chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      this.chart.resize(width, height);
      this.scheduleTableLayout();
    });
    resizeObserver.observe(container);
  }

  /**
   * Replace the candle data. lightweight-charts 5.0.9 / 5.2.1 bug (lightweight-charts issue 2154): a setData
   * with the same times on a series that is alone keeps a stale list of time points, and a later setData after other
   * series were added empties the time scale (blank chart). Clearing first (setData([])) rebuilds the time points on
   * every call (client-side avoidance given in the issue). Remove when the library fix is released.
   */
  private setCandles(data: CandlestickData<Time>[]): void {
    this.candlestickSeries.setData([]);
    this.candlestickSeries.setData(data);
  }

  /**
   * Set candlestick data
   */
  setCandlestickData(bars: Bar[]): void {
    const data = toCandlestickData(bars) as CandlestickData<Time>[];
    this.grid.setBars(bars);
    this.originalBarColors = data.map(d => ({ ...d }));
    this.setCandles(data);
    this.chart.timeScale().fitContent();
  }

  // ─── Phase 1: Plot Styles ──────────────────────────────────────────────

  /**
   * Add or update an indicator series (line, linebr, stepline, steplinebr, circles)
   */
  setIndicatorData(
    id: string,
    data: Array<{ time: number; value: number; color?: string }>,
    config: SeriesConfig = {}
  ): void {
    let series = this.indicatorSeries.get(id);

    if (!series) {
      // Pine widths go above 4 (e.g. 6, 8, 10 for glow lines): the canvas draws any width, the LineWidth type
      // of lightweight-charts only lists 1..4
      const lineWidth = (config.lineWidth && config.lineWidth >= 1 ? config.lineWidth : 2) as LineWidth;
      series = this.chart.addSeries(LineSeries, {
        color: config.color || '#2962FF',
        lineWidth,
        lineStyle: config.lineStyle ?? LineStyle.Solid,
        lineType: config.lineType ?? LineType.Simple,
        pointMarkersVisible: config.pointMarkersVisible ?? false,
        lineVisible: config.lineVisible ?? true,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
      });

      if (config.overlay === false) {
        const paneIndex = config.paneIndex ?? this.getNextPaneIndex();
        series.moveToPane(paneIndex);
        this.indicatorPanes.set(id, paneIndex);
      } else {
        series.moveToPane(0);
        this.indicatorPanes.set(id, 0);
      }

      this.indicatorSeries.set(id, series);
    }

    if (config.preserveGaps) {
      // linebr/steplinebr: NaN values become whitespace entries to create gaps
      const lineData: (LineData<Time> | WhitespaceData<Time>)[] = [];
      let run: LineData<Time>[] = [];
      const endRun = () => {
        lineData.push(...this.segmentColors(run, config));
        run = [];
      };
      for (const d of data) {
        if (d.value == null || Number.isNaN(d.value)) {
          endRun();
          lineData.push({ time: d.time as unknown as Time });
          continue;
        }
        const pt: LineData<Time> = { time: d.time as unknown as Time, value: d.value };
        if (d.color) pt.color = d.color;
        run.push(pt);
      }
      endRun();
      series.setData(lineData);
    } else {
      const lineData = data.filter(d =>
        d.value != null && !Number.isNaN(d.value)
      ) as LineData<Time>[];
      series.setData(this.segmentColors(lineData, config) as LineData<Time>[]);
    }
  }

  /**
   * Per-point colours of a line plot. Pine colours the segment that leads into a point with the colour of
   * that point (also across na points of plot.style_line); lightweight-charts
   * colours the segment from a point to the next one with the colour of the first point. So each point gets the
   * colour of the next point. Only for a visible simple line: a stepline already matches Pine (horizontal
   * part in the colour of its point, vertical part in the colour of the next point) and circles have no segments.
   */
  private segmentColors<T extends { color?: string }>(data: T[], config: SeriesConfig): T[] {
    const simpleLine = (config.lineType ?? LineType.Simple) === LineType.Simple && config.lineVisible !== false
      && !config.pointMarkersVisible;
    if (!simpleLine || !data.some(d => d.color)) return data;
    const base = config.color || '#2962FF';
    return data.map((d, i) => {
      const next = data[i + 1];
      if (!next) return d;
      const out = { ...d };
      out.color = next.color ?? base;
      return out;
    });
  }

  /**
   * Pine plot.style_area: the line of the plot and, per bar, the area between the plot value and `histBase` (Pine
   * histbase, default 0) filled with the colour of that bar (its own alpha). The line is a normal line plot
   * (setIndicatorData: per-point colours, na points skipped, as Pine area connects over na); the fill is a primitive
   * attached to it. histBase is not part of the price scale (only the plot values are).
   */
  setAreaPlotData(
    id: string,
    data: Array<{ time: number; value: number; color?: string }>,
    config: SeriesConfig = {}
  ): void {
    this.setIndicatorData(id, data, config);
    const series = this.indicatorSeries.get(id);
    if (!series) return;
    let primitive = this.areaFills.get(id);
    if (!primitive) {
      primitive = new PlotFillPrimitive();
      series.attachPrimitive(primitive);
      this.areaFills.set(id, primitive);
    }
    const base = config.histBase ?? 0;
    const fallback = config.color || '#2962FF';
    primitive.setData(
      data
        .filter(d => d.value != null && !Number.isNaN(d.value))
        .map(d => {
          const raw = d.color ?? fallback;
          return { time: d.time, v1: d.value, v2: base, color: isTransparent(raw) ? null : withOpacity(raw, 1) };
        })
    );
  }

  /**
   * Add or update a cross marker series (for 'cross' plot style)
   */
  setCrossPlotData(
    id: string,
    data: Array<{ time: number; value: number }>,
    config: SeriesConfig = {}
  ): void {
    let primitive = this.crossPrimitives.get(id);

    if (!primitive) {
      // Create invisible anchor series to attach the primitive
      const anchor = this.chart.addSeries(LineSeries, {
        color: 'transparent',
        lineVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
      });

      if (config.overlay === false) {
        const paneIndex = config.paneIndex ?? this.getNextPaneIndex();
        anchor.moveToPane(paneIndex);
        this.indicatorPanes.set(id, paneIndex);
      } else {
        anchor.moveToPane(0);
        this.indicatorPanes.set(id, 0);
      }

      // Set minimal data so the series exists
      const anchorData = data.filter(d =>
        d.value != null && !Number.isNaN(d.value)
      ) as LineData<Time>[];
      anchor.setData(anchorData);
      this.crossAnchorSeries.set(id, anchor);

      primitive = new CrossPlotPrimitive();
      anchor.attachPrimitive(primitive as ISeriesPrimitive<Time>);
      this.crossPrimitives.set(id, primitive);
    }

    primitive.setData(data, config.color || '#2962FF', (config.lineWidth ?? 2) * 3);
  }

  /**
   * Add or update a line-break series (linebr/steplinebr) using a canvas primitive.
   * The line breaks at NaN gaps instead of connecting across them.
   */
  setLineBrData(
    id: string,
    data: Array<{ time: number; value: number; color?: string }>,
    config: SeriesConfig = {}
  ): void {
    let primitive = this.lineBrPrimitives.get(id);

    if (!primitive) {
      const anchor = this.chart.addSeries(LineSeries, {
        color: 'transparent',
        lineVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
      });

      if (config.overlay === false) {
        const paneIndex = config.paneIndex ?? this.getNextPaneIndex();
        anchor.moveToPane(paneIndex);
        this.indicatorPanes.set(id, paneIndex);
      } else {
        anchor.moveToPane(0);
        this.indicatorPanes.set(id, 0);
      }

      const anchorData = data.filter(d =>
        d.value != null && !Number.isNaN(d.value)
      ) as LineData<Time>[];
      anchor.setData(anchorData);
      this.lineBrAnchorSeries.set(id, anchor);

      primitive = new LineBrPrimitive();
      anchor.attachPrimitive(primitive as ISeriesPrimitive<Time>);
      this.lineBrPrimitives.set(id, primitive);
    }

    const withSteps = config.lineType === LineType.WithSteps;
    primitive.setData(data, config.color || '#2962FF', config.lineWidth ?? 2, config.lineStyle ?? 0, withSteps);
  }

  /**
   * Clear all area series
   */
  private clearAreaSeries(): void {
    // the line series (and the attached fills) are removed with indicatorSeries
    this.areaFills.clear();
  }

  /**
   * Clear all cross plot primitives
   */
  private clearCrossPlots(): void {
    for (const [id, primitive] of this.crossPrimitives) {
      const anchor = this.crossAnchorSeries.get(id);
      if (anchor) {
        anchor.detachPrimitive(primitive as ISeriesPrimitive<Time>);
        this.chart.removeSeries(anchor);
      }
      this.indicatorPanes.delete(id);
    }
    this.crossPrimitives.clear();
    this.crossAnchorSeries.clear();
  }

  private clearLineBrPlots(): void {
    for (const [id, primitive] of this.lineBrPrimitives) {
      const anchor = this.lineBrAnchorSeries.get(id);
      if (anchor) {
        anchor.detachPrimitive(primitive as ISeriesPrimitive<Time>);
        this.chart.removeSeries(anchor);
      }
      this.indicatorPanes.delete(id);
    }
    this.lineBrPrimitives.clear();
    this.lineBrAnchorSeries.clear();
  }

  // ─── Phase 2: barcolor ─────────────────────────────────────────────────

  /**
   * Apply per-bar colors to the main candlestick series
   */
  setBarColors(barColors: BarColorData[]): void {
    if (!this.originalBarColors) return;

    const colorMap = new Map(barColors.map(bc => [bc.time, bc.color]));
    const data = this.originalBarColors.map(bar => {
      const color = colorMap.get(bar.time as unknown as number);
      if (color) {
        return { ...bar, color, borderColor: color, wickColor: color };
      }
      return bar;
    });
    this.setCandles(data);
  }

  /**
   * Reset candlestick colors to defaults
   */
  private clearBarColors(): void {
    if (this.originalBarColors) {
      this.setCandles(this.originalBarColors);
    }
  }

  // ─── Phase 3: bgcolor ──────────────────────────────────────────────────

  /**
   * Apply background colors behind bars
   */
  setBgColors(bgColors: BgColorData[], paneIndex: number): void {
    this.clearBgColors();

    // Pine bgcolor(force_overlay = true): those bars go to the price pane (pane 0)
    const byPane = new Map<number, BgColorData[]>();
    for (const bg of bgColors) {
      const pane = bg.forceOverlay ? 0 : paneIndex;
      if (!byPane.has(pane)) byPane.set(pane, []);
      byPane.get(pane)!.push(bg);
    }

    for (const [pane, list] of byPane) {
      // Create invisible anchor series (its value 0 must not take part in the price scale range)
      const anchor = this.chart.addSeries(LineSeries, {
        color: 'transparent',
        lineVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
        autoscaleInfoProvider: () => null,
      });
      anchor.moveToPane(pane);

      // Set minimal data (one point when the layer has one bar: times must be ascending)
      const first = list[0].time;
      const last = list[list.length - 1].time;
      anchor.setData((first === last ? [first] : [first, last]).map((time) => ({
        time: time as unknown as Time,
        value: 0,
      })) as LineData<Time>[]);

      const primitive = new BgColorPrimitive();
      anchor.attachPrimitive(primitive as ISeriesPrimitive<Time>);
      primitive.setData(list);
      this.bgColorLayers.push({ primitive, anchor });
    }
  }

  /**
   * Clear background colors
   */
  private clearBgColors(): void {
    for (const { primitive, anchor } of this.bgColorLayers) {
      anchor.detachPrimitive(primitive as ISeriesPrimitive<Time>);
      this.chart.removeSeries(anchor);
    }
    this.bgColorLayers = [];
  }

  // ─── Phase 4: plotcandle ───────────────────────────────────────────────

  /**
   * Add an overlay candlestick series
   */
  setCandlePlotData(
    id: string,
    data: PlotCandleData[],
    paneIndex: number
  ): void {
    let series = this.candlePlotSeries.get(id);

    if (!series) {
      series = this.chart.addSeries(CandlestickSeries, {
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: true,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      });
      // candles with forceOverlay (Pine force_overlay) go to the price pane
      const pane = data.some(d => d.forceOverlay) ? 0 : paneIndex;
      series.moveToPane(pane);
      this.indicatorPanes.set(`candle_${id}`, pane);
      this.candlePlotSeries.set(id, series);
    }

    // Pine plotcandle: a bar with one na value of open / high / low / close draws no candle (whitespace point;
    // lightweight-charts rejects NaN values)
    const candleData: (CandlestickData<Time> | WhitespaceData<Time>)[] = data.map(d => {
      const time = d.time as unknown as Time;
      if (![d.open, d.high, d.low, d.close].every(v => Number.isFinite(v))) return { time };
      return {
        time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        ...(d.color && { color: d.color, borderColor: d.borderColor ?? d.color, wickColor: d.wickColor ?? d.color }),
      };
    });
    series.setData(candleData);
  }

  /**
   * Clear all plotcandle series
   */
  private clearCandlePlots(): void {
    for (const [id, series] of this.candlePlotSeries) {
      this.chart.removeSeries(series);
      this.indicatorPanes.delete(`candle_${id}`);
    }
    this.candlePlotSeries.clear();
  }

  /**
   * Add an OHLC bar series (plotbar in PineScript): vertical line from low to high, open tick on the left, close tick
   * on the right, in the bar colour (PineScript default colour when the script sets none)
   */
  setBarPlotData(id: string, data: PlotBarData[], paneIndex: number): void {
    let series = this.barPlotSeries.get(id);
    if (!series) {
      series = this.chart.addSeries(BarSeries, { upColor: PINE_BLUE, downColor: PINE_BLUE, openVisible: true, thinBars: false });
      // bars with forceOverlay (PineScript force_overlay) go to the price pane
      const pane = data.some(d => d.forceOverlay) ? 0 : paneIndex;
      series.moveToPane(pane);
      this.indicatorPanes.set(`bar_${id}`, pane);
      this.barPlotSeries.set(id, series);
    }
    // a bar with one na value of open / high / low / close draws no bar (whitespace point)
    series.setData(data.map((d): BarData<Time> | WhitespaceData<Time> => {
      const time = d.time as unknown as Time;
      if (![d.open, d.high, d.low, d.close].every(v => Number.isFinite(v))) return { time };
      return { time, open: d.open, high: d.high, low: d.low, close: d.close, ...(d.color && { color: d.color }) };
    }));
  }

  private clearBarPlots(): void {
    for (const [id, series] of this.barPlotSeries) {
      this.chart.removeSeries(series);
      this.indicatorPanes.delete(`bar_${id}`);
    }
    this.barPlotSeries.clear();
  }

  // ─── Phase 5: Markers ──────────────────────────────────────────────────

  /**
   * Draw the markers of an indicator.
   * Pane: bar positions (aboveBar / belowBar / inBar) and the atPrice* markers of an overlay indicator (or with
   * forceOverlay) are drawn on the price pane; the atPrice* markers of a non-overlay indicator in the indicator pane
   * (their price is an indicator value). top / bottom markers: at the edge of the indicator pane (price pane for an
   * overlay indicator or with forceOverlay).
   * Drawing: the lightweight-charts markers plugin (native API, atPrice* positions included) for its 4 shapes
   * when the text has the shape colour and one line; the extended primitive otherwise (other shapes, plotchar characters, textColor,
   * transparent shape colour, labels, multi-line text, top / bottom).
   */
  setIndicatorMarkers(markers: MarkerData[], paneIndex: number, overlay: boolean): void {
    this.clearMarkers();
    const isPrice = (m: MarkerData) => m.position.startsWith('atPrice');
    // Pine location.top / location.bottom: edge of the pane, drawn by the extended marker primitive
    const isEdge = (m: MarkerData) => m.position === 'top' || m.position === 'bottom';
    const inPane = (m: MarkerData) => (isPrice(m) || isEdge(m)) && !overlay && !m.forceOverlay && paneIndex !== 0;
    const priceMarkers = markers.filter(m => !inPane(m));
    const paneMarkers = markers.filter(inPane);

    const split = (list: MarkerData[]) => {
      const native: SeriesMarker<Time>[] = [];
      const extended: MarkerData[] = [];
      for (const m of list) {
        if (isPrice(m) && (m.price == null || Number.isNaN(m.price))) continue;
        const nativeOk = !isEdge(m)
          && !m.char
          && BUILTIN_MARKER_SHAPES.has(m.shape)
          && (m.textColor == null || m.textColor === m.color)
          && !isTransparent(m.color)
          && !(m.text ?? '').includes('\n');
        if (!nativeOk) {
          extended.push(m);
          continue;
        }
        const base = {
          time: m.time as unknown as Time,
          shape: m.shape as 'arrowUp' | 'arrowDown' | 'circle' | 'square',
          color: m.color,
          text: m.text ?? '',
          size: markerSizeMult(m.size),
        };
        native.push(isPrice(m)
          ? { ...base, position: m.position as 'atPriceTop' | 'atPriceBottom' | 'atPriceMiddle', price: m.price! }
          : { ...base, position: m.position as 'aboveBar' | 'belowBar' | 'inBar' });
      }
      native.sort((a, b) => (a.time as unknown as number) - (b.time as unknown as number));
      return { native, extended };
    };

    // price pane: on the candlestick series
    const main = split(priceMarkers);
    if (main.native.length) {
      if (!this.markerPlugin) {
        this.markerPlugin = createSeriesMarkers(this.candlestickSeries, main.native);
      } else {
        this.markerPlugin.setMarkers(main.native);
      }
    }
    if (main.extended.length) {
      this.extendedMarkerPrimitive = new ExtendedMarkerPrimitive(this.grid);
      this.candlestickSeries.attachPrimitive(this.extendedMarkerPrimitive as ISeriesPrimitive<Time>);
      this.extendedMarkerPrimitive.setMarkers(main.extended);
    }

    // indicator pane: on an invisible anchor series that holds the marker prices
    if (paneMarkers.length) {
      const pane = split(paneMarkers);
      const anchor = this.addAnchorSeries(paneIndex);
      anchor.setData(anchorData(paneMarkers.map(m => ({ time: m.time, value: m.price! })), this.grid));
      this.paneMarkerAnchor = anchor;
      if (pane.native.length) {
        this.paneMarkerPlugin = createSeriesMarkers(anchor, pane.native);
      }
      if (pane.extended.length) {
        this.paneExtendedMarkerPrimitive = new ExtendedMarkerPrimitive(this.grid);
        anchor.attachPrimitive(this.paneExtendedMarkerPrimitive as ISeriesPrimitive<Time>);
        this.paneExtendedMarkerPrimitive.setMarkers(pane.extended);
      }
    }
  }

  /**
   * Clear all markers
   */
  clearMarkers(): void {
    if (this.markerPlugin) {
      this.markerPlugin.setMarkers([]);
    }
    if (this.extendedMarkerPrimitive) {
      this.candlestickSeries.detachPrimitive(this.extendedMarkerPrimitive as ISeriesPrimitive<Time>);
      this.extendedMarkerPrimitive = null;
    }
    if (this.paneMarkerAnchor) {
      if (this.paneMarkerPlugin) this.paneMarkerPlugin.detach();
      if (this.paneExtendedMarkerPrimitive) {
        this.paneMarkerAnchor.detachPrimitive(this.paneExtendedMarkerPrimitive as ISeriesPrimitive<Time>);
      }
      this.chart.removeSeries(this.paneMarkerAnchor);
    }
    this.paneMarkerAnchor = null;
    this.paneMarkerPlugin = null;
    this.paneExtendedMarkerPrimitive = null;
  }

  /** Invisible line series in a pane, used to hold primitives and markers */
  private addAnchorSeries(paneIndex: number): ISeriesApi<'Line'> {
    const anchor = this.chart.addSeries(LineSeries, {
      color: 'transparent',
      lineVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    anchor.moveToPane(paneIndex);
    return anchor;
  }

  // ─── Future bars ──────────────────────────────────────────────────────

  /**
   * Add bar slots after the last bar up to `maxTime` (whitespace points at lastTime + k * interval, the times that
   * ports give to future bars, src/bar-time.ts), so drawings and plot points on future bars are placed on their bar.
   */
  setFutureSlots(maxTime: number): void {
    const k = this.grid.slotsAfter(maxTime);
    if (k <= 0) {
      this.clearFutureSlots();
      return;
    }
    if (!this.futureSeries) {
      this.futureSeries = this.addAnchorSeries(0);
    }
    const last = this.grid.lastTime;
    const data: WhitespaceData<Time>[] = [];
    for (let i = 1; i <= k; i++) data.push({ time: (last + i * this.grid.interval) as unknown as Time });
    this.futureSeries.setData(data);
  }

  private clearFutureSlots(): void {
    if (this.futureSeries) {
      this.chart.removeSeries(this.futureSeries);
      this.futureSeries = null;
    }
  }

  // ─── Phase 6: Drawings ────────────────────────────────────────────────

  /**
   * Draw a list of drawings of one kind: one primitive per pane, on an invisible anchor series that holds the
   * drawing prices (time scale and autoscale include the drawings; autoscale false: the time scale only). Drawings
   * with forceOverlay go to the price pane, the others to `paneIndex`.
   */
  private setDrawings<T>(
    kind: string,
    items: T[],
    paneIndex: number,
    forceOverlay: (item: T) => boolean | undefined,
    points: (item: T) => Array<{ time: number; value: number }>,
    draw: (env: DrawEnv, item: T) => void,
    zOrder: 'bottom' | 'normal' | 'top',
    autoscale = true
  ): void {
    this.clearDrawings(kind);
    const groups = new Map<number, T[]>();
    for (const item of items) {
      const pane = forceOverlay(item) ? 0 : paneIndex;
      if (!groups.has(pane)) groups.set(pane, []);
      groups.get(pane)!.push(item);
    }
    const layers: Array<{ primitive: ISeriesPrimitive<Time>; anchor: ISeriesApi<'Line'> }> = [];
    for (const [pane, group] of groups) {
      const anchor = this.addAnchorSeries(pane);
      if (!autoscale) anchor.applyOptions({ autoscaleInfoProvider: () => null });
      anchor.setData(anchorData(group.flatMap(points), this.grid));
      const primitive = new DrawingPrimitive(this.grid, group, draw, zOrder) as ISeriesPrimitive<Time>;
      anchor.attachPrimitive(primitive);
      layers.push({ primitive, anchor });
    }
    this.drawingLayers.set(kind, layers);
  }

  private clearDrawings(kind?: string): void {
    for (const k of kind ? [kind] : [...this.drawingLayers.keys()]) {
      for (const { primitive, anchor } of this.drawingLayers.get(k) ?? []) {
        anchor.detachPrimitive(primitive);
        this.chart.removeSeries(anchor);
      }
      this.drawingLayers.delete(k);
    }
  }

  /** label.new labels */
  setLabels(labels: LabelData[], paneIndex: number): void {
    this.setDrawings('labels', labels, paneIndex, (l) => l.forceOverlay, (l) => [{ time: l.time, value: l.price }], drawLabel, 'top');
  }

  /** line.new lines */
  setLineDrawings(lines: LineDrawingData[], paneIndex: number): void {
    this.setDrawings('lines', lines, paneIndex, (l) => l.forceOverlay, (l) => [
      { time: l.time1, value: l.price1 },
      { time: l.time2, value: l.price2 },
    ], drawLine, 'normal');
  }

  /** box.new boxes */
  setBoxes(boxes: BoxData[], paneIndex: number): void {
    this.setDrawings('boxes', boxes, paneIndex, (b) => b.forceOverlay, (b) => [
      { time: b.time1, value: b.price1 },
      { time: b.time2, value: b.price2 },
    ], drawBox, 'bottom');
  }

  /** linefill.new fills (pane of the first line) */
  setLinefills(fills: LinefillData[], paneIndex: number): void {
    this.setDrawings('linefills', fills, paneIndex, (f) => f.line1.forceOverlay, (f) => [
      { time: f.line1.time1, value: f.line1.price1 },
      { time: f.line1.time2, value: f.line1.price2 },
      { time: f.line2.time1, value: f.line2.price1 },
      { time: f.line2.time2, value: f.line2.price2 },
    ], drawLinefill, 'bottom');
  }

  /** polyline.new polylines */
  setPolylines(polylines: PolylineData[], paneIndex: number): void {
    this.setDrawings('polylines', polylines, paneIndex, (p) => p.forceOverlay,
      (p) => p.points.map((pt) => ({ time: pt.time, value: pt.price })), drawPolyline, 'normal');
  }

  /**
   * plotarrow arrows, one group per plotarrow (`configs`: minheight / maxheight / forceOverlay by id; PineScript
   * defaults 5 / 100 px when the indicator gives none). On the price pane (overlay indicator or forceOverlay) the
   * arrows point at the bar; in an indicator pane they start at the pane edge.
   */
  setArrows(arrows: ArrowData[], configs: ArrowConfig[], paneIndex: number, overlay: boolean): void {
    const byId = new Map<string, ArrowData[]>();
    for (const a of arrows) {
      if (!byId.has(a.id)) byId.set(a.id, []);
      byId.get(a.id)!.push(a);
    }
    const series: ArrowSeries[] = [...byId].map(([id, list]) => {
      const cfg = configs.find((c) => c.id === id);
      const forceOverlay = !!cfg?.forceOverlay;
      return {
        arrows: list,
        minheight: cfg?.minheight ?? 5,
        maxheight: cfg?.maxheight ?? 100,
        forceOverlay,
        onBars: overlay || forceOverlay || paneIndex === 0,
      };
    });
    this.setDrawings('arrows', series, paneIndex, (s) => s.forceOverlay,
      (s) => s.arrows.map((a) => ({ time: a.time as number, value: 0 })), drawArrowSeries, 'normal', false);
  }

  // ─── Phase 9: Tables ──────────────────────────────────────────────────

  /**
   * Display the tables (table.new) as DOM overlays on their pane (the price pane with forceOverlay), at their
   * position inside the plotting area. PineScript defaults: no background, frame or borders; black cell text.
   */
  setTables(tables: TableData[], paneIndex: number): void {
    this.clearTable();
    this.container.style.position = 'relative';
    for (const table of tables) {
      const el = document.createElement('div');
      el.className = 'chart-table-overlay';
      el.style.cssText = 'position:absolute;z-index:10;pointer-events:none;visibility:hidden';
      this.container.appendChild(el);
      this.tables.push({ table, pane: table.forceOverlay ? 0 : paneIndex, el });
    }
    this.scheduleTableLayout();
  }

  /** Lay out the tables after the chart has laid out its panes */
  private scheduleTableLayout(): void {
    if (!this.tables.length || this.tableLayoutFrame) return;
    this.tableLayoutFrame = requestAnimationFrame(() => {
      this.tableLayoutFrame = 0;
      this.layoutTables();
    });
  }

  private layoutTables(): void {
    const cr = this.container.getBoundingClientRect();
    const panes = this.chart.panes();
    const leftScale = this.chart.priceScale('left').width();
    const rightScale = this.chart.priceScale('right').width();
    for (const { table, pane, el } of this.tables) {
      const pr = (panes[pane] ?? panes[0])?.getHTMLElement()?.getBoundingClientRect() ?? cr;
      // plotting area of the pane (without the price scales)
      const area = { left: pr.left - cr.left + leftScale, top: pr.top - cr.top, width: pr.width - leftScale - rightScale, height: pr.height };
      el.replaceChildren(buildTable(table, area));
      const margin = 8;
      const [v, h] = table.position.split('_');
      const left = h === 'left' ? margin : h === 'right' ? area.width - el.offsetWidth - margin : (area.width - el.offsetWidth) / 2;
      const top = v === 'top' ? margin : v === 'bottom' ? area.height - el.offsetHeight - margin : (area.height - el.offsetHeight) / 2;
      el.style.left = `${area.left + left}px`;
      el.style.top = `${area.top + top}px`;
      el.style.visibility = 'visible';
    }
  }

  /**
   * Remove the table overlays
   */
  clearTable(): void {
    for (const { el } of this.tables) el.remove();
    this.tables = [];
    if (this.tableLayoutFrame) cancelAnimationFrame(this.tableLayoutFrame);
    this.tableLayoutFrame = 0;
  }

  // ─── Existing methods ──────────────────────────────────────────────────

  /**
   * Add or update a histogram series (per-bar colored)
   */
  setHistogramData(
    id: string,
    data: Array<{ time: number; value: number; color?: string }>,
    config: SeriesConfig = {}
  ): void {
    let series = this.histogramSeriesMap.get(id);

    if (!series) {
      series = this.chart.addSeries(HistogramSeries, {
        color: config.color || '#26A69A',
        base: config.histBase ?? 0,
        lastValueVisible: false,
        priceLineVisible: false,
      });

      const paneIndex = config.paneIndex ?? (config.overlay === false ? this.getNextPaneIndex() : 0);
      series.moveToPane(paneIndex);
      this.indicatorPanes.set(id, paneIndex);
      this.histogramSeriesMap.set(id, series);
    }

    const histData = data.filter(d =>
      d.value != null && !Number.isNaN(d.value)
    ) as HistogramData<Time>[];
    series.setData(histData);
  }

  /**
   * Remove all histogram series
   */
  clearHistograms(): void {
    for (const [id, series] of this.histogramSeriesMap) {
      this.chart.removeSeries(series);
      this.indicatorPanes.delete(id);
    }
    this.histogramSeriesMap.clear();
  }

  /**
   * Get the next available pane index
   */
  private getNextPaneIndex(): number {
    const usedPanes = new Set(this.indicatorPanes.values());
    let nextPane = 1;
    while (usedPanes.has(nextPane)) {
      nextPane++;
    }
    return nextPane;
  }

  /**
   * Remove an indicator series
   */
  removeIndicator(id: string): void {
    const series = this.indicatorSeries.get(id);
    if (series) {
      this.chart.removeSeries(series);
      this.indicatorSeries.delete(id);
      this.indicatorPanes.delete(id);
    }
  }

  /**
   * Draw horizontal lines (hlines) in a specific pane
   */
  setHLines(hlines: HLineConfig[], paneIndex: number, bars: Bar[]): void {
    this.clearHLines();
    if (!bars.length) return;
    const firstTime = bars[0].time as unknown as Time;
    const lastTime = bars[bars.length - 1].time as unknown as Time;

    const lineStyleMap: Record<string, LineStyle> = {
      solid: LineStyle.Solid,
      dashed: LineStyle.Dashed,
      dotted: LineStyle.Dotted,
    };

    for (const hline of hlines) {
      // Pine hline(..., display = display.none): not drawn (it can still bound a fill)
      if (hline.display === 'none') continue;
      const series = this.chart.addSeries(LineSeries, {
        color: hline.color ?? '#787B86',
        lineWidth: (hline.linewidth ?? 1) as 1 | 2 | 3 | 4,
        lineStyle: lineStyleMap[hline.linestyle ?? 'solid'] ?? LineStyle.Solid,
        crosshairMarkerVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      series.moveToPane(paneIndex);
      series.setData([
        { time: firstTime, value: hline.price },
        { time: lastTime, value: hline.price },
      ] as LineData<Time>[]);
      this.hlineSeries.set(hline.id, series);
    }
  }

  /**
   * Remove all hline series
   */
  clearHLines(): void {
    for (const [, series] of this.hlineSeries) {
      this.chart.removeSeries(series);
    }
    this.hlineSeries.clear();
  }

  /**
   * Draw filled regions between hline pairs using BaselineSeries.
   * A gradient fill (FillConfig.gradient, per-bar arrays) is drawn by the plot fill primitive over the bars, with the
   * gradient of each bar (Pine fill(hline1, hline2, top_value, bottom_value, top_color, bottom_color)).
   */
  setFills(fills: FillConfig[], hlines: HLineConfig[], paneIndex: number, bars: Bar[]): void {
    this.clearFills();
    if (!bars.length) return;
    const firstTime = bars[0].time as unknown as Time;
    const lastTime = bars[bars.length - 1].time as unknown as Time;

    const hlineMap = new Map(hlines.map(h => [h.id, h.price]));

    for (const fill of fills) {
      const price1 = hlineMap.get(fill.plot1);
      const price2 = hlineMap.get(fill.plot2);
      if (price1 == null || price2 == null) continue;

      // gradient or per-bar colours (Pine fill colour series): drawn bar by bar
      if (fill.gradient || fill.colors) {
        const gradient = fill.gradient as FillGradientData | undefined;
        const colors = fill.colors;
        const anchor = this.chart.addSeries(LineSeries, {
          color: 'transparent',
          lineVisible: false,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        });
        anchor.moveToPane(paneIndex);
        anchor.setData(bars.map(b => ({ time: b.time as unknown as Time, value: Math.max(price1, price2) })));
        const primitive = new PlotFillPrimitive();
        primitive.setData(bars.map((b, i) => ({
          time: b.time,
          v1: price1,
          v2: price2,
          color: colors && !isTransparent(colors[i]) ? colors[i] : null,
          gradient: gradient ? gradientAt(gradient, i) : undefined,
        })));
        anchor.attachPrimitive(primitive);
        this.hlineGradientFills.push({ anchor, primitive });
        continue;
      }

      const upperPrice = Math.max(price1, price2);
      const lowerPrice = Math.min(price1, price2);
      const color = fill.color ?? 'rgba(41,98,255,0.1)';

      const series = this.chart.addSeries(BaselineSeries, {
        baseValue: { type: 'price', price: lowerPrice },
        topFillColor1: color,
        topFillColor2: color,
        bottomFillColor1: 'transparent',
        bottomFillColor2: 'transparent',
        topLineColor: 'transparent',
        bottomLineColor: 'transparent',
        lineVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
      });
      series.moveToPane(paneIndex);
      series.setData([
        { time: firstTime, value: upperPrice },
        { time: lastTime, value: upperPrice },
      ] as BaselineData<Time>[]);
      this.fillSeries.set(fill.id, series);
    }
  }

  /**
   * Remove all fill series
   */
  clearFills(): void {
    for (const [, series] of this.fillSeries) {
      this.chart.removeSeries(series);
    }
    this.fillSeries.clear();
    for (const { anchor, primitive } of this.hlineGradientFills) {
      anchor.detachPrimitive(primitive);
      this.chart.removeSeries(anchor);
    }
    this.hlineGradientFills = [];
  }

  /**
   * Remove all indicator series and display components
   */
  clearIndicators(): void {
    for (const [, series] of this.indicatorSeries) {
      this.chart.removeSeries(series);
    }
    this.indicatorSeries.clear();
    this.indicatorPanes.clear();
    this.clearAreaSeries();
    this.clearCrossPlots();
    this.clearLineBrPlots();
    this.clearHistograms();
    this.clearHLines();
    this.clearFills();
    this.clearPlotFills();
    this.clearMarkers();
    this.clearBarColors();
    this.clearBgColors();
    this.clearCandlePlots();
    this.clearBarPlots();
    this.clearDrawings();
    this.clearTable();
    this.clearFutureSlots();

    // Remove empty panes (keep pane 0 which is the main price chart)
    this.removeEmptyPanes();
  }

  /**
   * Draw the plot-to-plot fills (Pine fill(plot1, plot2, color)) of a port result.
   * Colour of bar i: `fill.colors[i]` when the port gives per-bar colours (index of the plot1 data, which is the bar
   * index in the ports), else `fill.options.color`. A null, empty or fully transparent colour is Pine na: no fill on
   * that bar. `fill.options.transp` (Pine v4 transp, 0..100) multiplies the alpha the colour already has; without
   * transp the colour is drawn as given (Pine draws fill(p1, p2, color.blue) opaque).
   * `fill.gradient` (Pine fill(p1, p2, top_value, bottom_value, top_color, bottom_color)) replaces the colour: bar i
   * (index in `bars`, found by the time of the plot1 point) gets the vertical gradient of gradient[...][i].
   * Pane: `paneIndex`, or the price pane when both plots are in `forceOverlayPlots` (Pine plot force_overlay).
   */
  setPlotFills(
    fills: PlotFill[],
    plotData: Record<string, Array<{ time: number; value: number }>>,
    paneIndex: number,
    bars: Bar[],
    forceOverlayPlots: Set<string> = new Set()
  ): void {
    this.clearPlotFills();
    const barIndex = new Map(bars.map((b, i) => [b.time, i]));

    for (const fill of fills) {
      const p1Data = plotData[fill.plot1];
      const p2Data = plotData[fill.plot2];
      if (!p1Data?.length || !p2Data?.length) continue;

      const transp = fill.options?.transp;
      const opacity = transp != null ? 1 - transp / 100 : 1;
      // no colour from the port: renderer default (not a Pine value)
      const staticColor = fill.options?.color ?? DEFAULT_PLOT_FILL_COLOR;
      const resolved = new Map<string, string | null>();
      const resolve = (raw: string | null | undefined): string | null => {
        if (raw == null) return null;
        let c = resolved.get(raw);
        if (c === undefined) {
          c = withOpacity(raw, opacity);
          if (c === null && !isTransparent(raw)) {
            console.warn(`plot fill ${fill.plot1} / ${fill.plot2}: colour '${raw}' is not readable, not drawn`);
          }
          resolved.set(raw, c);
        }
        return c;
      };

      // Points aligned by time; NaN where either plot is na
      const p2Map = new Map(p2Data.map(d => [d.time, d.value]));
      const gradient = fill.gradient as FillGradientData | undefined;
      const points: PlotFillPoint[] = p1Data.map((d1, i) => {
        const v2 = p2Map.get(d1.time);
        if (gradient) {
          const bi = barIndex.get(d1.time);
          return {
            time: d1.time,
            v1: d1.value ?? NaN,
            v2: v2 ?? NaN,
            color: null,
            gradient: bi === undefined ? null : gradientAt(gradient, bi),
          };
        }
        const raw = fill.colors && i < fill.colors.length ? fill.colors[i] : staticColor;
        return {
          time: d1.time,
          v1: d1.value ?? NaN,
          v2: v2 ?? NaN,
          color: resolve(raw),
        };
      });
      const valid = points.filter(p => Number.isFinite(p.v1) && Number.isFinite(p.v2));
      if (!valid.length) continue;

      // Create anchor series + primitive for this fill
      const anchor = this.chart.addSeries(LineSeries, {
        color: 'transparent',
        lineVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
      });
      // a fill between two force_overlay plots follows its plots to the price pane
      const bothOverlay = forceOverlayPlots.has(String(fill.plot1)) && forceOverlayPlots.has(String(fill.plot2));
      anchor.moveToPane(bothOverlay ? 0 : paneIndex);
      // Set anchor data to all valid fill bars so price scale includes the fill range
      anchor.setData(valid.map(p => ({ time: p.time as unknown as Time, value: Math.max(p.v1, p.v2) })));

      const primitive = new PlotFillPrimitive();
      primitive.setData(points);
      anchor.attachPrimitive(primitive);

      this.plotFillPrimitives.push(primitive);
      this.plotFillAnchorSeries.push(anchor);
    }
  }

  /**
   * Remove all plot-to-plot fill primitives
   */
  clearPlotFills(): void {
    for (let i = 0; i < this.plotFillAnchorSeries.length; i++) {
      const series = this.plotFillAnchorSeries[i];
      const primitive = this.plotFillPrimitives[i];
      if (primitive) {
        series.detachPrimitive(primitive);
      }
      this.chart.removeSeries(series);
    }
    this.plotFillPrimitives = [];
    this.plotFillAnchorSeries = [];
  }

  /**
   * Remove any empty panes except the main chart (pane 0)
   */
  private removeEmptyPanes(): void {
    const panes = this.chart.panes();
    for (let i = panes.length - 1; i > 0; i--) {
      const pane = panes[i];
      const seriesInPane = pane.getSeries();
      if (seriesInPane.length === 0) {
        this.chart.removePane(i);
      }
    }
  }

  /**
   * Get the chart instance
   */
  getChart(): IChartApi {
    return this.chart;
  }

  /**
   * Fit content to view
   */
  fitContent(): void {
    this.chart.timeScale().fitContent();
  }
}
