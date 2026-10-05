/**
 * Rally Base Drop Signals
 *
 * A rally is two green bars in a row, a drop two red bars in a row, a base any other bar. The script keeps the last
 * three different phases (R / B / D) and signals the sequences Rally-Base-Drop, Rally-Base-Rally, Drop-Base-Drop and
 * Drop-Base-Rally on the bar where they appear (triangles with the sequence name). Bars are coloured by phase
 * ("Full Color") or only on the detection bars ("Color on Detection").
 *
 * Reference: "Rally Base Drop Signals [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

export interface RallyBaseDropSignalsInputs {
  /** Rally | Base | Drop */
  rbdTog: boolean;
  /** Rally | Base | Rally */
  rbrTog: boolean;
  /** Drop | Base | Drop */
  dbdTog: boolean;
  /** Drop | Base | Rally */
  dbrTog: boolean;
  /** Bar Color Logic */
  bcType: 'Full Color' | 'Color on Detection' | 'No Color';
  rallyCol: string;
  baseCol: string;
  dropCol: string;
  /** Label Color (text colour of the triangles) */
  txtCol: string;
  /** Label Size (not used by the Pine outputs: no effect) */
  labSize: 'Tiny' | 'Small' | 'Normal' | 'Large' | 'Huge';
}

// Input colour defaults: #089981c0 / #f23645c0 are stored with alpha 0.75 (byte 191)
export const defaultInputs: RallyBaseDropSignalsInputs = {
  rbdTog: true,
  rbrTog: true,
  dbdTog: true,
  dbrTog: true,
  bcType: 'Full Color',
  rallyCol: '#089981BF',
  baseCol: '#00000000',
  dropCol: '#F23645BF',
  txtCol: color.gray,
  labSize: 'Small',
};

export const inputConfig: InputConfig[] = [
  { id: 'rbdTog', type: 'bool', title: 'Rally | Base | Drop', defval: true },
  { id: 'rbrTog', type: 'bool', title: 'Rally | Base | Rally', defval: true },
  { id: 'dbdTog', type: 'bool', title: 'Drop | Base | Drop', defval: true },
  { id: 'dbrTog', type: 'bool', title: 'Drop | Base | Rally', defval: true },
  { id: 'bcType', type: 'string', title: 'Bar Color Logic', defval: 'Full Color', options: ['Full Color', 'Color on Detection', 'No Color'] },
  { id: 'rallyCol', type: 'color', title: 'Rally Color', defval: '#089981BF' },
  { id: 'baseCol', type: 'color', title: 'Base Color', defval: '#00000000' },
  { id: 'dropCol', type: 'color', title: 'Drop Color', defval: '#F23645BF' },
  { id: 'txtCol', type: 'color', title: 'Label Color', defval: color.gray },
  { id: 'labSize', type: 'string', title: 'Label Size', defval: 'Small', options: ['Tiny', 'Small', 'Normal', 'Large', 'Huge'] },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Rally Base Drop Signals [LuxAlgo]',
  shortTitle: 'LuxAlgo - RBD Signals',
  overlay: true,
};

// Pine comparison operators: a > b only when a - b > 1e-10
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;

export function calculate(
  bars: Bar[],
  inputs: Partial<RallyBaseDropSignalsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];

  // var o = array.new_string(3, "")
  const o: string[] = ['', '', ''];
  let prevReadout: string | null = null; // readout[1]: na on the first bar
  let gc1 = false; // gc[1] / rc[1]: false on the first bar (bool history)
  let rc1 = false;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const gc = gt(b.close, b.open);
    const rc = lt(b.close, b.open);
    const rally = gc && gc1;
    const drop = rc && rc1;
    const base = !rally && !drop;
    gc1 = gc;
    rc1 = rc;

    if (base && o[o.length - 1] !== 'B') { o.shift(); o.push('B'); }
    if (rally && o[o.length - 1] !== 'R') { o.shift(); o.push('R'); }
    if (drop && o[o.length - 1] !== 'D') { o.shift(); o.push('D'); }

    // str.replace_all(str.tostring(o), ", ", "")
    const readout = `[${o.join(', ')}]`.split(', ').join('');
    const isNew = (s: string) => readout === s && prevReadout !== s;
    const RBD = isNew('[RBD]') && cfg.rbdTog;
    const RBR = isNew('[RBR]') && cfg.rbrTog;
    const DBD = isNew('[DBD]') && cfg.dbdTog;
    const DBR = isNew('[DBR]') && cfg.dbrTog;
    prevReadout = readout;

    let barColor: string | null = null;
    if (cfg.bcType === 'Full Color') barColor = rally ? cfg.rallyCol : drop ? cfg.dropCol : base ? cfg.baseCol : null;
    else if (cfg.bcType === 'Color on Detection') barColor = RBR || DBR ? cfg.rallyCol : DBD || RBD ? cfg.dropCol : null;
    // barcolor(barColor, title = 'Bar Color')
    if (barColor !== null) barColors.push({ time: b.time, color: barColor });

    // plotshape(..., text, style, location (default abovebar), color, textcolor = txtCol, display = display.pane);
    // no size argument: size.auto
    if (RBD) markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: cfg.dropCol, text: 'RBD', textColor: cfg.txtCol, size: 'auto' });
    if (RBR) markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: cfg.rallyCol, text: 'RBR', textColor: cfg.txtCol, size: 'auto' });
    if (DBD) markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: cfg.dropCol, text: 'DBD', textColor: cfg.txtCol, size: 'auto' });
    if (DBR) markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: cfg.rallyCol, text: 'DBR', textColor: cfg.txtCol, size: 'auto' });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    barColors,
  };
}

export const RallyBaseDropSignals = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
