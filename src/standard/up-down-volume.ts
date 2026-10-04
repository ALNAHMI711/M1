/**
 * Up/Down Volume
 *
 * Splits each bar's volume into "up" and "down" components: up volume as green columns above zero, down volume as
 * red columns below zero, and the delta (up - down) as a "—" character at its value, green when positive and red
 * otherwise.
 *
 * The values are an estimate: the standard indicator splits the volume of each bar into up and down volume from
 * lower-timeframe (intrabar) volume, which the chart bars do not have. This implementation gives all the volume of a
 * bar to "up" when it closes at or above the previous close (first bar: the open), else to "down". The design
 * (columns, colours, delta character) is the one of the standard indicator.
 *
 * PineScript display:
 *   plot(upVolume, "Up Volume", style = plot.style_columns, color = color.new(color.green, 60))
 *   plot(downVolume, "Down Volume", style = plot.style_columns, color = color.new(color.red, 60))
 *   plotchar(delta, "delta", "—", location.absolute, color = delta > 0 ? color.green : color.red, size = size.tiny)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface UpDownVolumeInputs {
  // No inputs.
}

export const defaultInputs: UpDownVolumeInputs = {};

export const inputConfig: InputConfig[] = [];

// color.new(color.green, 60) / color.new(color.red, 60): alpha 0.4 = 102 = 0x66
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Up Volume', color: '#4CAF5066', lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Down Volume', color: '#F2364566', lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'Up/Down Volume',
  shortTitle: 'Up/Dn Vol',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(
  bars: Bar[],
  _inputs: Partial<UpDownVolumeInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const up: { time: number; value: number }[] = [];
  const down: { time: number; value: number }[] = [];
  const markers: MarkerData[] = [];

  for (let i = 0; i < bars.length; i++) {
    const vol = bars[i].volume ?? 0;
    // Direction from close vs previous close; first bar falls back to close vs open.
    const ref = i > 0 ? bars[i - 1].close : bars[i].open;
    const isUp = bars[i].close >= ref;
    const upVol = isUp ? vol : 0;
    const downVol = isUp ? 0 : vol;
    const delta = upVol - downVol;

    up.push({ time: bars[i].time, value: upVol });
    down.push({ time: bars[i].time, value: -downVol }); // plotted below zero
    // plotchar(delta, "delta", "—", location.absolute, color = delta > 0 ? color.green : color.red, size = size.tiny)
    markers.push({
      time: bars[i].time,
      position: 'atPriceMiddle',
      price: delta,
      shape: 'circle',
      color: 'transparent',
      text: '—',
      textColor: gt(delta, 0) ? '#4CAF50' : '#F23645',
      size: 'tiny',
    });
  }

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': up,
      'plot1': down,
    },
    markers,
  };
}

export const UpDownVolume = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
