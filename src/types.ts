/**
 * Pine size constant (size.auto, size.tiny, ...)
 */
export type PineSize = 'auto' | 'tiny' | 'small' | 'normal' | 'large' | 'huge';

/**
 * Marker data for candlestick pattern indicators and plotshape/plotchar/plotarrow
 */
export interface MarkerData {
  time: number;
  /**
   * aboveBar / belowBar / inBar: next to the bar (Pine location.abovebar / location.belowbar).
   * atPriceTop / atPriceBottom / atPriceMiddle: at `price` (Pine location.absolute), with the meaning of the
   * lightweight-charts price positions:
   * - atPriceTop: the shape is above the price, its bottom (the tip of a label) on the price (Pine shape.labeldown)
   * - atPriceBottom: the shape is below the price, its top (the tip of a label) on the price (Pine shape.labelup)
   * - atPriceMiddle: the shape is centred on the price (other Pine shapes)
   */
  position: 'aboveBar' | 'belowBar' | 'inBar' | 'atPriceTop' | 'atPriceBottom' | 'atPriceMiddle';
  /** Price of the atPrice* positions (required with them) */
  price?: number;
  shape: 'arrowUp' | 'arrowDown' | 'circle' | 'square'
    | 'labelUp' | 'labelDown' | 'triangleUp' | 'triangleDown'
    | 'cross' | 'xcross' | 'diamond' | 'flag';
  /**
   * Shape colour. A fully transparent colour ('transparent', '#rrggbb00', 'rgba(r, g, b, 0)') draws no shape, as
   * Pine `color = na`; the text is still drawn with `textColor`.
   */
  color: string;
  /** Text; a line feed starts a new line */
  text?: string;
  /**
   * Text colour (Pine textcolor). When omitted: white inside label shapes (labelUp / labelDown), the shape colour for
   * the other shapes. Pine's own default is #2962FF (blue), so a port sets it when Pine uses the default.
   */
  textColor?: string;
  /** Size multiplier (1 = default size) or a Pine size */
  size?: number | PineSize;
  /**
   * Pine force_overlay = true: an atPrice* marker of a non-overlay indicator is drawn on the price pane. Without it
   * the atPrice* markers of a non-overlay indicator are drawn in the indicator pane (the price is an indicator value).
   */
  forceOverlay?: boolean;
}

/**
 * Per-bar candle coloring (barcolor in PineScript)
 */
export interface BarColorData {
  time: number;
  color: string;
}

/**
 * Background coloring (bgcolor in PineScript)
 */
export interface BgColorData {
  time: number;
  color: string; // includes alpha
}

/**
 * Overlay candlestick data (plotcandle in PineScript)
 */
export interface PlotCandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  color?: string;
  borderColor?: string;
  wickColor?: string;
  /** Pine force_overlay = true: the candles of a non-overlay indicator are drawn on the price pane */
  forceOverlay?: boolean;
}

/**
 * Dynamic text labels (label.new in PineScript)
 */
export interface LabelData {
  time: number;
  price: number;
  text: string;
  color?: string;       // background color
  textColor?: string;
  /** 'none': text only, no background (Pine label.style_none) */
  style?: 'label_up' | 'label_down' | 'label_left' | 'label_right' | 'label_center' | 'none';
  size?: 'tiny' | 'small' | 'normal' | 'large' | 'huge';
  /**
   * Pine yloc: 'price' (default) places the label at `price`; 'abovebar' / 'belowbar' place it above the bar high /
   * below the bar low and ignore `price` (the renderer reads the bar at `time`).
   */
  yloc?: 'price' | 'abovebar' | 'belowbar';
}

/**
 * Dynamic lines (line.new in PineScript).
 * A point on a bar after the last bar (Pine bar_index + k) has the time of that future bar: barTime(bars, index)
 * of src/bar-time.ts. The same applies to labels, boxes, markers and plot points.
 */
export interface LineDrawingData {
  time1: number;
  price1: number;
  time2: number;
  price2: number;
  color?: string;
  width?: number;
  style?: 'solid' | 'dashed' | 'dotted';
  extend?: 'none' | 'left' | 'right' | 'both';
  /** Pine force_overlay = true: the line of a non-overlay indicator is drawn on the price pane */
  forceOverlay?: boolean;
}

/**
 * Rectangular regions (box.new in PineScript)
 */
export interface BoxData {
  time1: number;
  price1: number;
  time2: number;
  price2: number;
  bgColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  text?: string;
  textColor?: string;
  textSize?: 'tiny' | 'small' | 'normal' | 'large' | 'huge';
  textHAlign?: 'left' | 'center' | 'right';
  /** Pine box extend: the box continues to the left / right edge of the chart */
  extend?: 'none' | 'left' | 'right' | 'both';
}

/**
 * Table cell data (table.new in PineScript)
 */
export interface TableCell {
  row: number;
  column: number;
  text: string;
  bgColor?: string;
  textColor?: string;
  textSize?: 'tiny' | 'small' | 'normal' | 'large' | 'huge';
}

/**
 * Data table (table.new in PineScript)
 */
export interface TableData {
  position: 'top_left' | 'top_center' | 'top_right'
    | 'middle_left' | 'middle_center' | 'middle_right'
    | 'bottom_left' | 'bottom_center' | 'bottom_right';
  columns: number;
  rows: number;
  cells: TableCell[];
}
