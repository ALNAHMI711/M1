/**
 * Effective FVG Indicator
 *
 * A bullish fair value gap is low[2] > high, a bearish one high[2] < low. A gap is valid when the volume is above
 * 1.5 times its 20-bar SMA and the body |close - open| is above its 20-bar SMA. A valid bullish gap draws a green
 * "BUY" label below the bar and a green background, a valid bearish gap a red "SELL" label above the bar and a red
 * background; every valid gap also draws a purple circle below the bar.
 *
 * Reference: "Effective FVG Indicator" by imrancrypto
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taCore, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';

// The Pine script has no inputs
export interface EffectiveFVGIndicatorInputs {}

export const defaultInputs: EffectiveFVGIndicatorInputs = {};

export const inputConfig: InputConfig[] = [];

// No plot(): the outputs are three plotshape markers and two bgcolor layers
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Effective FVG Indicator',
  shortTitle: 'Effective FVG Indicator',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

/** Pine default text colour of plotshape (textcolor not set) */
const PINE_TEXT = '#2962FF';

export function calculate(
  bars: Bar[],
  _inputs: Partial<EffectiveFVGIndicatorInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } {
  // ma50 / ma200 (trend) are computed in the Pine script but not used by any output
  const volume = bars.map((b) => b.volume ?? NaN);
  const body = bars.map((b) => Math.abs(b.close - b.open));
  const volumeSma = taCore.sma(volume, 20);
  const bodySma = taCore.sma(body, 20);

  const green = String(color.green);
  const red = String(color.red);
  const purple = String(color.purple);
  const bullBg = String(color.new(color.green, 85));
  const bearBg = String(color.new(color.red, 85));

  const markers: MarkerData[] = [];
  const bgColors: BgColorData[] = [];
  for (let i = 0; i < bars.length; i++) {
    const { high, low, time } = bars[i];
    const highVolume = gt(volume[i], volumeSma[i] * 1.5);
    const strongImbalance = gt(body[i], bodySma[i]);
    // low[2] / high[2] are na on the first two bars: the comparison is false
    const fvgUp = i >= 2 && gt(bars[i - 2].low, high);
    const fvgDown = i >= 2 && gt(low, bars[i - 2].high);
    const validBullFVG = fvgUp && highVolume && strongImbalance;
    const validBearFVG = fvgDown && highVolume && strongImbalance;

    if (validBullFVG) {
      markers.push({ time, position: 'belowBar', shape: 'labelUp', color: green, text: 'BUY', textColor: PINE_TEXT,
        size: 'auto' });
    }
    if (validBearFVG) {
      markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: red, text: 'SELL', textColor: PINE_TEXT,
        size: 'auto' });
    }
    // bgcolor layers: bullish then bearish (both cannot be true on one bar)
    if (validBullFVG) bgColors.push({ time, color: bullBg });
    if (validBearFVG) bgColors.push({ time, color: bearBg });
    // plotshape 'FVG Debug'
    if (validBullFVG || validBearFVG) {
      markers.push({ time, position: 'belowBar', shape: 'circle', color: purple, size: 'auto' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    bgColors,
  };
}

export const EffectiveFVGIndicator = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
