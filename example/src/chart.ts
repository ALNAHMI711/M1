/**
 * Chart Setup and Management
 * Creates and manages the LightweightCharts instance
 */

import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  type LineWidth,
  BaselineSeries,
  AreaSeries,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type ISeriesPrimitive,
  type IPrimitivePaneView,
  type IPrimitivePaneRenderer,
  type SeriesAttachedParameter,
  type SeriesMarker,
  type CandlestickData,
  type LineData,
  type HistogramData,
  type BaselineData,
  type AreaData,
  type WhitespaceData,
  type Time,
  type SeriesType,
  ColorType,
  LineStyle,
  LineType,
} from 'lightweight-charts';
import type { CanvasRenderingTarget2D } from 'fancy-canvas';
import type { Bar, HLineConfig, FillConfig, FillData } from 'oakscriptjs';
import type {
  BarColorData,
  BgColorData,
  PlotCandleData,
  LabelData,
  LineDrawingData,
  BoxData,
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
        if (showShape) {
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

/**
 * Label primitive — draws text labels with backgrounds
 */
class LabelPrimitive extends BasePrimitive {
  private _labels: LabelData[] = [];
  private _views: IPrimitivePaneView[] = [new LabelPaneView(this)];

  constructor(private _grid: BarGrid) {
    super();
  }

  setLabels(labels: LabelData[]): void {
    this._labels = labels;
    this._requestUpdate?.();
  }

  getLabels() { return this._labels; }
  getGrid() { return this._grid; }
  getChart() { return this._chart; }
  getSeries() { return this._series; }

  updateAllViews(): void {}

  paneViews(): readonly IPrimitivePaneView[] {
    return this._views;
  }
}

class LabelPaneView implements IPrimitivePaneView {
  constructor(private _source: LabelPrimitive) {}

  zOrder(): 'top' { return 'top'; }

  renderer(): IPrimitivePaneRenderer | null {
    return new LabelRenderer(this._source);
  }
}

const LABEL_FONT_SIZES: Record<string, number> = {
  tiny: 9, small: 11, normal: 13, large: 16, huge: 20,
};

const LABEL_BAR_GAP = 4; // px between the bar and a yloc.abovebar / belowbar label

/**
 * Label geometry (Pine label styles): label_down = box above the point with a pointer down to it, label_up = box
 * below with a pointer up, label_left / label_right = box right / left of the point, label_center (or no style) =
 * box centred on the point, none = text only. yloc abovebar / belowbar: the point is the bar high / low, and a
 * centred box or a text without box is moved above / below it, as in Pine.
 */
class LabelRenderer implements IPrimitivePaneRenderer {
  constructor(private _source: LabelPrimitive) {}

  draw(target: CanvasRenderingTarget2D): void {
    const chart = this._source.getChart();
    const series = this._source.getSeries();
    if (!chart || !series) return;

    const labels = this._source.getLabels();
    const grid = this._source.getGrid();
    const timeScale = chart.timeScale();

    target.useMediaCoordinateSpace(({ context: ctx }) => {
      for (const label of labels) {
        const x = grid.x(timeScale, label.time);
        if (x == null) continue;
        const yloc = label.yloc ?? 'price';
        let y: number | null;
        if (yloc === 'price') {
          y = series.priceToCoordinate(label.price);
        } else {
          const bar = grid.byTime.get(label.time);
          if (!bar) continue;
          const by = series.priceToCoordinate(yloc === 'abovebar' ? bar.high : bar.low);
          y = by == null ? null : (by as number) + (yloc === 'abovebar' ? -LABEL_BAR_GAP : LABEL_BAR_GAP);
        }
        if (y == null) continue;

        const fontSize = LABEL_FONT_SIZES[label.size ?? 'normal'] ?? 13;
        ctx.font = `${fontSize}px sans-serif`;
        const lines = label.text.split('\n');
        const lineHeight = Math.round(fontSize * 1.2);
        const textWidth = lines.reduce((w, l) => Math.max(w, ctx.measureText(l).width), 0);
        const padding = 4;
        const pointer = 6;
        const w = textWidth + padding * 2;
        const h = lines.length * lineHeight + padding * 2;
        const style = label.style ?? 'label_center';

        // box position (left, top) and pointer
        let left = x - w / 2;
        let top = y - h / 2;
        if (style === 'label_down') top = y - pointer - h;
        else if (style === 'label_up') top = y + pointer;
        else if (style === 'label_left') left = x + pointer;
        else if (style === 'label_right') left = x - pointer - w;
        else if (yloc === 'abovebar') top = y - h;
        else if (yloc === 'belowbar') top = y;

        if (style !== 'none' && label.color && !isTransparent(label.color)) {
          ctx.fillStyle = label.color;
          ctx.beginPath();
          ctx.roundRect(left, top, w, h, 3);
          ctx.fill();
          ctx.beginPath();
          if (style === 'label_down') {
            ctx.moveTo(x, y); ctx.lineTo(x - pointer, top + h - 0.5); ctx.lineTo(x + pointer, top + h - 0.5);
          } else if (style === 'label_up') {
            ctx.moveTo(x, y); ctx.lineTo(x - pointer, top + 0.5); ctx.lineTo(x + pointer, top + 0.5);
          } else if (style === 'label_left') {
            ctx.moveTo(x, y); ctx.lineTo(left + 0.5, y - pointer); ctx.lineTo(left + 0.5, y + pointer);
          } else if (style === 'label_right') {
            ctx.moveTo(x, y); ctx.lineTo(left + w - 0.5, y - pointer); ctx.lineTo(left + w - 0.5, y + pointer);
          }
          ctx.closePath();
          ctx.fill();
        }

        ctx.fillStyle = label.textColor ?? '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        lines.forEach((l, k) => ctx.fillText(l, left + w / 2, top + padding + lineHeight * (k + 0.5)));
      }
    });
  }
}

/**
 * Line drawing primitive — draws lines between two time/price points
 */
class LinePrimitive extends BasePrimitive {
  private _lines: LineDrawingData[] = [];
  private _views: IPrimitivePaneView[] = [new LinePaneView(this)];

  constructor(private _grid: BarGrid) {
    super();
  }

  setLines(lines: LineDrawingData[]): void {
    this._lines = lines;
    this._requestUpdate?.();
  }

  getLines() { return this._lines; }
  getGrid() { return this._grid; }
  getChart() { return this._chart; }
  getSeries() { return this._series; }

  updateAllViews(): void {}

  paneViews(): readonly IPrimitivePaneView[] {
    return this._views;
  }
}

class LinePaneView implements IPrimitivePaneView {
  constructor(private _source: LinePrimitive) {}

  zOrder(): 'normal' { return 'normal'; }

  renderer(): IPrimitivePaneRenderer | null {
    return new LineDrawingRenderer(this._source);
  }
}

class LineDrawingRenderer implements IPrimitivePaneRenderer {
  constructor(private _source: LinePrimitive) {}

  draw(target: CanvasRenderingTarget2D): void {
    const chart = this._source.getChart();
    const series = this._source.getSeries();
    if (!chart || !series) return;

    const lines = this._source.getLines();
    const grid = this._source.getGrid();
    const timeScale = chart.timeScale();

    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      for (const line of lines) {
        const x1 = grid.x(timeScale, line.time1);
        const y1 = series.priceToCoordinate(line.price1);
        const x2 = grid.x(timeScale, line.time2);
        const y2 = series.priceToCoordinate(line.price2);
        if (x1 == null || y1 == null || x2 == null || y2 == null) continue;

        ctx.strokeStyle = line.color ?? '#2962FF';
        ctx.lineWidth = line.width ?? 1;

        // Set line dash style
        if (line.style === 'dashed') {
          ctx.setLineDash([6, 3]);
        } else if (line.style === 'dotted') {
          ctx.setLineDash([2, 2]);
        } else {
          ctx.setLineDash([]);
        }

        ctx.beginPath();

        // Handle line extension
        const extend = line.extend ?? 'none';
        let startX: number = x1, startY: number = y1, endX: number = x2, endY: number = y2;

        if (extend === 'left' || extend === 'both') {
          const dx = (x2 as number) - (x1 as number);
          const dy = (y2 as number) - (y1 as number);
          if (dx !== 0) {
            const t = -(x1 as number) / dx;
            startX = 0;
            startY = (y1 as number) + dy * t;
          }
        }
        if (extend === 'right' || extend === 'both') {
          const dx = (x2 as number) - (x1 as number);
          const dy = (y2 as number) - (y1 as number);
          if (dx !== 0) {
            const t = (mediaSize.width - (x1 as number)) / dx;
            endX = mediaSize.width;
            endY = (y1 as number) + dy * t;
          }
        }

        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  }
}

/**
 * Box primitive — draws filled rectangles
 */
class BoxPrimitive extends BasePrimitive {
  private _boxes: BoxData[] = [];
  private _views: IPrimitivePaneView[] = [new BoxPaneView(this)];

  constructor(private _grid: BarGrid) {
    super();
  }

  setBoxes(boxes: BoxData[]): void {
    this._boxes = boxes;
    this._requestUpdate?.();
  }

  getBoxes() { return this._boxes; }
  getGrid() { return this._grid; }
  getChart() { return this._chart; }
  getSeries() { return this._series; }

  updateAllViews(): void {}

  paneViews(): readonly IPrimitivePaneView[] {
    return this._views;
  }
}

class BoxPaneView implements IPrimitivePaneView {
  constructor(private _source: BoxPrimitive) {}

  zOrder(): 'bottom' { return 'bottom'; }

  renderer(): IPrimitivePaneRenderer | null {
    return new BoxRenderer(this._source);
  }
}

class BoxRenderer implements IPrimitivePaneRenderer {
  constructor(private _source: BoxPrimitive) {}

  draw(target: CanvasRenderingTarget2D): void {
    const chart = this._source.getChart();
    const series = this._source.getSeries();
    if (!chart || !series) return;

    const boxes = this._source.getBoxes();
    const grid = this._source.getGrid();
    const timeScale = chart.timeScale();

    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      for (const box of boxes) {
        const x1 = grid.x(timeScale, box.time1);
        const y1 = series.priceToCoordinate(box.price1);
        const x2 = grid.x(timeScale, box.time2);
        const y2 = series.priceToCoordinate(box.price2);
        if (x1 == null || y1 == null || x2 == null || y2 == null) continue;

        // Pine box extend: the box continues to the left / right edge of the pane
        const extend = box.extend ?? 'none';
        const left = extend === 'left' || extend === 'both' ? 0 : Math.min(x1, x2);
        const right = extend === 'right' || extend === 'both' ? mediaSize.width : Math.max(x1, x2);
        const top = Math.min(y1, y2);
        const width = right - left;
        const height = Math.abs(y2 - y1);

        // Fill
        if (box.bgColor) {
          ctx.fillStyle = box.bgColor;
          ctx.fillRect(left, top, width, height);
        }

        // Border
        if (box.borderColor) {
          ctx.strokeStyle = box.borderColor;
          ctx.lineWidth = box.borderWidth ?? 1;
          if (box.borderStyle === 'dashed') {
            ctx.setLineDash([6, 3]);
          } else if (box.borderStyle === 'dotted') {
            ctx.setLineDash([2, 2]);
          } else {
            ctx.setLineDash([]);
          }
          ctx.strokeRect(left, top, width, height);
          ctx.setLineDash([]);
        }
      }
    });
  }
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
  private areaSeries: Map<string, ISeriesApi<'Area'>> = new Map();
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
  private labelPrimitive: LabelPrimitive | null = null;
  private labelAnchorSeries: ISeriesApi<'Line'> | null = null;
  // one line primitive per pane (lines with forceOverlay go to the price pane)
  private lineDrawings: Array<{ primitive: LinePrimitive; anchor: ISeriesApi<'Line'> }> = [];
  private boxPrimitive: BoxPrimitive | null = null;
  private boxAnchorSeries: ISeriesApi<'Line'> | null = null;
  private tableElement: HTMLElement | null = null;
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
    });
    resizeObserver.observe(container);
  }

  /**
   * Replace the candle data. lightweight-charts 5.0.9 / 5.2.1 bug (tradingview/lightweight-charts#2154): a setData
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
   * Add or update an area series (for 'area' plot style)
   */
  setAreaPlotData(
    id: string,
    data: Array<{ time: number; value: number; color?: string }>,
    config: SeriesConfig = {}
  ): void {
    let series = this.areaSeries.get(id);

    if (!series) {
      const color = config.color || '#2962FF';
      series = this.chart.addSeries(AreaSeries, {
        topColor: withOpacity(color, 0x40 / 255) ?? 'transparent',
        bottomColor: withOpacity(color, 0x10 / 255) ?? 'transparent',
        lineColor: color,
        lineWidth: (config.lineWidth && config.lineWidth >= 1 ? config.lineWidth : 2) as LineWidth,
        crosshairMarkerVisible: true,
      });

      if (config.overlay === false) {
        const paneIndex = config.paneIndex ?? this.getNextPaneIndex();
        series.moveToPane(paneIndex);
        this.indicatorPanes.set(id, paneIndex);
      } else {
        series.moveToPane(0);
        this.indicatorPanes.set(id, 0);
      }

      this.areaSeries.set(id, series);
    }

    const areaData = data.filter(d =>
      d.value != null && !Number.isNaN(d.value)
    ) as AreaData<Time>[];
    series.setData(areaData);
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
    for (const [id, series] of this.areaSeries) {
      this.chart.removeSeries(series);
      this.indicatorPanes.delete(id);
    }
    this.areaSeries.clear();
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

      // Set minimal data
      anchor.setData([
        { time: list[0].time as unknown as Time, value: 0 },
        { time: list[list.length - 1].time as unknown as Time, value: 0 },
      ] as LineData<Time>[]);

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

    const candleData = data.map(d => ({
      time: d.time as unknown as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      ...(d.color && { color: d.color, borderColor: d.borderColor ?? d.color, wickColor: d.wickColor ?? d.color }),
    })) as CandlestickData<Time>[];
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

  // ─── Phase 5: Markers ──────────────────────────────────────────────────

  /**
   * Draw the markers of an indicator.
   * Pane: bar positions (aboveBar / belowBar / inBar) and the atPrice* markers of an overlay indicator (or with
   * forceOverlay) are drawn on the price pane; the atPrice* markers of a non-overlay indicator in the indicator pane
   * (their price is an indicator value). top / bottom markers: at the edge of the indicator pane (price pane for an
   * overlay indicator or with forceOverlay).
   * Drawing: the lightweight-charts markers plugin (native API, atPrice* positions included) for its 4 shapes
   * when the text has the shape colour and one line; the extended primitive otherwise (other shapes, textColor,
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

  // ─── Phase 6: Labels ──────────────────────────────────────────────────

  /**
   * Draw text labels on the chart
   */
  setLabels(labels: LabelData[], paneIndex: number): void {
    this.clearLabels();

    const anchor = this.addAnchorSeries(paneIndex);
    anchor.setData(anchorData(labels.map(l => ({ time: l.time, value: l.price })), this.grid));

    const primitive = new LabelPrimitive(this.grid);
    anchor.attachPrimitive(primitive as ISeriesPrimitive<Time>);
    primitive.setLabels(labels);

    this.labelPrimitive = primitive;
    this.labelAnchorSeries = anchor;
  }

  private clearLabels(): void {
    if (this.labelPrimitive && this.labelAnchorSeries) {
      this.labelAnchorSeries.detachPrimitive(this.labelPrimitive as ISeriesPrimitive<Time>);
      this.chart.removeSeries(this.labelAnchorSeries);
      this.labelPrimitive = null;
      this.labelAnchorSeries = null;
    }
  }

  // ─── Phase 7: Line Drawings ───────────────────────────────────────────

  /**
   * Draw lines on the chart: lines with forceOverlay on the price pane, the others in `paneIndex`
   */
  setLineDrawings(lines: LineDrawingData[], paneIndex: number): void {
    this.clearLineDrawings();

    const groups = new Map<number, LineDrawingData[]>();
    for (const line of lines) {
      const pane = line.forceOverlay ? 0 : paneIndex;
      if (!groups.has(pane)) groups.set(pane, []);
      groups.get(pane)!.push(line);
    }
    for (const [pane, group] of groups) {
      const anchor = this.addAnchorSeries(pane);
      anchor.setData(anchorData(group.flatMap(l => [
        { time: l.time1, value: l.price1 },
        { time: l.time2, value: l.price2 },
      ]), this.grid));
      const primitive = new LinePrimitive(this.grid);
      anchor.attachPrimitive(primitive as ISeriesPrimitive<Time>);
      primitive.setLines(group);
      this.lineDrawings.push({ primitive, anchor });
    }
  }

  private clearLineDrawings(): void {
    for (const { primitive, anchor } of this.lineDrawings) {
      anchor.detachPrimitive(primitive as ISeriesPrimitive<Time>);
      this.chart.removeSeries(anchor);
    }
    this.lineDrawings = [];
  }

  // ─── Phase 8: Boxes ───────────────────────────────────────────────────

  /**
   * Draw boxes on the chart
   */
  setBoxes(boxes: BoxData[], paneIndex: number): void {
    this.clearBoxes();

    const anchor = this.addAnchorSeries(paneIndex);
    anchor.setData(anchorData(boxes.flatMap(b => [
      { time: b.time1, value: b.price1 },
      { time: b.time2, value: b.price2 },
    ]), this.grid));

    const primitive = new BoxPrimitive(this.grid);
    anchor.attachPrimitive(primitive as ISeriesPrimitive<Time>);
    primitive.setBoxes(boxes);

    this.boxPrimitive = primitive;
    this.boxAnchorSeries = anchor;
  }

  private clearBoxes(): void {
    if (this.boxPrimitive && this.boxAnchorSeries) {
      this.boxAnchorSeries.detachPrimitive(this.boxPrimitive as ISeriesPrimitive<Time>);
      this.chart.removeSeries(this.boxAnchorSeries);
      this.boxPrimitive = null;
      this.boxAnchorSeries = null;
    }
  }

  // ─── Phase 9: Tables ──────────────────────────────────────────────────

  /**
   * Display a data table as a DOM overlay
   */
  setTable(table: TableData): void {
    this.clearTable();

    const el = document.createElement('div');
    el.className = 'chart-table-overlay';

    // Position mapping
    const positionStyles: Record<string, string> = {
      top_left: 'top:8px;left:8px',
      top_center: 'top:8px;left:50%;transform:translateX(-50%)',
      top_right: 'top:8px;right:8px',
      middle_left: 'top:50%;left:8px;transform:translateY(-50%)',
      middle_center: 'top:50%;left:50%;transform:translate(-50%,-50%)',
      middle_right: 'top:50%;right:8px;transform:translateY(-50%)',
      bottom_left: 'bottom:8px;left:8px',
      bottom_center: 'bottom:8px;left:50%;transform:translateX(-50%)',
      bottom_right: 'bottom:8px;right:8px',
    };

    el.style.cssText = `
      position:absolute;${positionStyles[table.position] ?? 'top:8px;right:8px'};
      z-index:10;pointer-events:none;
      background:rgba(30,34,45,0.9);border:1px solid #2b2b43;border-radius:4px;
      padding:4px;font-family:monospace;font-size:11px;color:#d1d4dc;
    `;

    // Build table HTML
    const grid: string[][] = Array.from({ length: table.rows }, () =>
      Array.from({ length: table.columns }, () => '')
    );
    const cellStyles: Record<string, { bgColor?: string; textColor?: string; textSize?: string }> = {};

    for (const cell of table.cells) {
      if (cell.row < table.rows && cell.column < table.columns) {
        grid[cell.row][cell.column] = cell.text;
        cellStyles[`${cell.row}_${cell.column}`] = {
          bgColor: cell.bgColor,
          textColor: cell.textColor,
          textSize: cell.textSize,
        };
      }
    }

    const fontSizes: Record<string, string> = {
      tiny: '9px', small: '10px', normal: '11px', large: '13px', huge: '16px',
    };

    let html = '<table style="border-collapse:collapse">';
    for (let r = 0; r < table.rows; r++) {
      html += '<tr>';
      for (let c = 0; c < table.columns; c++) {
        const style = cellStyles[`${r}_${c}`] ?? {};
        const bg = style.bgColor ? `background:${style.bgColor};` : '';
        const tc = style.textColor ? `color:${style.textColor};` : '';
        const fs = style.textSize ? `font-size:${fontSizes[style.textSize] ?? '11px'};` : '';
        html += `<td style="padding:2px 6px;${bg}${tc}${fs}">${grid[r][c]}</td>`;
      }
      html += '</tr>';
    }
    html += '</table>';
    el.innerHTML = html;

    this.container.style.position = 'relative';
    this.container.appendChild(el);
    this.tableElement = el;
  }

  /**
   * Remove table overlay
   */
  clearTable(): void {
    if (this.tableElement) {
      this.tableElement.remove();
      this.tableElement = null;
    }
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
    this.clearLabels();
    this.clearLineDrawings();
    this.clearBoxes();
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
