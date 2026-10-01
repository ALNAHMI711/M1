/**
 * Port of "_All Candlestick Patterns_.pine": every pattern in one indicator,
 * with the per-family enable toggles, the Pattern Type filter and the three
 * label-color inputs of the original. Pattern detection is reused from the
 * individual PatternDef modules (their detection blocks are identical to the
 * composite's).
 *
 * Differences with the single-pattern scripts, as in the Pine source:
 * - no background highlight (the composite has no bgcolor);
 * - the 44 alertconditions are declared whatever the toggles and the Pattern Type;
 * - patterns are evaluated and labelled in the composite's order;
 * - a bearish Kicking label also draws a neutral "Collection" label below the bar
 *   (the Pine source creates it inside the Kicking - Bearish block).
 */
import { indicator, alertcondition, plotshape, input, color } from 'oakscriptjs/script';
import { candleProps, trendInputs } from './candle-props';
import type { PatternDef, PatternDirection } from './pattern-runner';
import { getPattern } from './registry';

/** Family toggle titles and defaults, in the order the Pine script declares them. */
const FAMILY_DEFAULTS: ReadonlyArray<readonly [string, boolean]> = [
  ['Abandoned Baby', true],
  ['Dark Cloud Cover', false],
  ['Doji', true],
  ['Doji Star', false],
  ['Downside Tasuki Gap', false],
  ['Dragonfly Doji', true],
  ['Engulfing', true],
  ['Evening Doji Star', false],
  ['Evening Star', false],
  ['Falling Three Methods', false],
  ['Falling Window', false],
  ['Gravestone Doji', false],
  ['Hammer', true],
  ['Hanging Man', false],
  ['Harami Cross', false],
  ['Harami', false],
  ['Inverted Hammer', false],
  ['Kicking', false],
  ['Long Lower Shadow', false],
  ['Long Upper Shadow', false],
  ['Marubozu Black', false],
  ['Marubozu White', false],
  ['Morning Doji Star', false],
  ['Morning Star', false],
  ['On Neck', false],
  ['Piercing', false],
  ['Rising Three Methods', false],
  ['Rising Window', false],
  ['Shooting Star', false],
  ['Spinning Top Black', false],
  ['Spinning Top White', false],
  ['Three Black Crows', false],
  ['Three White Soldiers', false],
  ['Tri-Star', false],
  ['Tweezer Bottom', false],
  ['Tweezer Top', false],
  ['Upside Tasuki Gap', false],
];

/** Pattern names in the order the composite evaluates them (and creates their labels). */
const PINE_ORDER: readonly string[] = [
  'On Neck - Bearish',
  'Rising Window - Bullish',
  'Falling Window - Bearish',
  'Falling Three Methods - Bearish',
  'Rising Three Methods - Bullish',
  'Tweezer Top - Bearish',
  'Tweezer Bottom - Bullish',
  'Dark Cloud Cover - Bearish',
  'Downside Tasuki Gap - Bearish',
  'Upside Tasuki Gap - Bullish',
  'Evening Doji Star - Bearish',
  'Doji Star - Bearish',
  'Doji Star - Bullish',
  'Morning Doji Star - Bullish',
  'Piercing - Bullish',
  'Hammer - Bullish',
  'Hanging Man - Bearish',
  'Shooting Star - Bearish',
  'Inverted Hammer - Bullish',
  'Morning Star - Bullish',
  'Evening Star - Bearish',
  'Marubozu White - Bullish',
  'Marubozu Black - Bearish',
  'Doji',
  'Gravestone Doji - Bearish',
  'Dragonfly Doji - Bullish',
  'Harami Cross - Bullish',
  'Harami Cross - Bearish',
  'Harami - Bullish',
  'Harami - Bearish',
  'Long Lower Shadow - Bullish',
  'Long Upper Shadow - Bearish',
  'Spinning Top White',
  'Spinning Top Black',
  'Three White Soldiers - Bullish',
  'Three Black Crows - Bearish',
  'Engulfing - Bullish',
  'Engulfing - Bearish',
  'Abandoned Baby - Bullish',
  'Abandoned Baby - Bearish',
  'Tri-Star - Bullish',
  'Tri-Star - Bearish',
  'Kicking - Bullish',
  'Kicking - Bearish',
];

const PATTERNS: readonly PatternDef[] = PINE_ORDER.map((name) => {
  const def = getPattern(name);
  if (!def) throw new Error(`candlestick-port: unknown pattern ${name}`);
  return def;
});

/** "Engulfing - Bullish" -> family "Engulfing"; neutral names map to themselves. */
export function familyOf(def: PatternDef): string {
  return def.name.replace(/ - (Bullish|Bearish)$/, '');
}

const LABEL_STYLE: Record<PatternDirection, { style: 'labelup' | 'labeldown'; location: 'belowbar' | 'abovebar' }> = {
  bullish: { style: 'labelup', location: 'belowbar' },
  bearish: { style: 'labeldown', location: 'abovebar' },
  neutral: { style: 'labelup', location: 'belowbar' },
};

const COLLECTION_TOOLTIP = 'All Candlestick Patterns\n';

/** Full script body for the "*All Candlestick Patterns*" indicator. */
export function allPatternsScript(): void {
  indicator('*All Candlestick Patterns*', { shorttitle: 'All Patterns', overlay: true });
  const trend = trendInputs();
  const props = candleProps();
  const labelColors: Record<PatternDirection, string> = {
    bullish: input.color(color.blue, 'Label Color Bullish'),
    bearish: input.color(color.red, 'Label Color Bearish'),
    neutral: input.color(color.gray, 'Label Color Neutral'),
  };
  const candleType = input.string('Both', 'Pattern Type', {
    options: ['Bullish', 'Bearish', 'Both'],
  });
  const toggles = new Map<string, boolean>();
  for (const [family, defval] of FAMILY_DEFAULTS) {
    toggles.set(family, input.bool(defval, family));
  }
  for (const def of PATTERNS) {
    const cond = def.detect(props, trend);
    // Pine titles use an en dash: "On Neck – Bearish"
    const title = def.name.replace(' - ', ' – ');
    alertcondition(cond, title, `New ${title} pattern detected`);
    if (!toggles.get(familyOf(def))) continue;
    // neutral patterns ignore the Pattern Type filter, as in the original
    if (def.direction === 'bullish' && candleType === 'Bearish') continue;
    if (def.direction === 'bearish' && candleType === 'Bullish') continue;
    const s = LABEL_STYLE[def.direction];
    plotshape(cond, def.name, {
      style: s.style,
      location: s.location,
      color: labelColors[def.direction],
      text: def.labelText,
      textcolor: color.white,
      tooltip: def.tooltip,
    });
    if (def.name === 'Kicking - Bearish') {
      plotshape(cond, 'All Candlestick Patterns', {
        style: 'labelup',
        location: 'belowbar',
        color: labelColors.neutral,
        text: 'Collection',
        textcolor: color.white,
        tooltip: COLLECTION_TOOLTIP,
      });
    }
  }
}
