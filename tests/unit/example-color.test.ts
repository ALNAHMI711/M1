/**
 * Colour helper of the example renderer (example/src/color.ts), used for plot fills and markers
 */
import { describe, it, expect } from 'vitest';
import { parseColor, withOpacity, isTransparent } from '../../example/src/color';

describe('example colour helper', () => {
  it('reads hex, rgb() and rgba() colours', () => {
    expect(parseColor('#2962FF')).toEqual({ r: 41, g: 98, b: 255, a: 1 });
    expect(parseColor('#ae4ce633')).toEqual({ r: 174, g: 76, b: 230, a: 0x33 / 255 });
    expect(parseColor('#fff8')).toEqual({ r: 255, g: 255, b: 255, a: 0x88 / 255 });
    expect(parseColor('rgb(1, 2, 3)')).toEqual({ r: 1, g: 2, b: 3, a: 1 });
    expect(parseColor('rgba(255,0,0,0.25)')).toEqual({ r: 255, g: 0, b: 0, a: 0.25 });
    expect(parseColor('rgb(10 20 30 / 50%)')).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
    expect(parseColor('transparent')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    expect(parseColor(null)).toBeNull();
    expect(parseColor('')).toBeNull();
    expect(parseColor('#12345')).toBeNull();
  });

  it('keeps the alpha a colour already has and multiplies it (no second alpha suffix)', () => {
    expect(withOpacity('#ae4ce633')).toBe('rgba(174, 76, 230, 0.2)');
    expect(withOpacity('rgba(255,0,0,0.25)')).toBe('rgba(255, 0, 0, 0.25)');
    expect(withOpacity('#cccccc33', 0.5)).toBe('rgba(204, 204, 204, 0.1)');
    // Pine v4 transp 90 on an opaque colour
    expect(withOpacity('#089981', 1 - 90 / 100)).toBe('rgba(8, 153, 129, 0.1)');
    // a colour without alpha and no transp stays opaque
    expect(withOpacity('#2962FF')).toBe('rgba(41, 98, 255, 1)');
  });

  it('gives null for na colours (nothing drawn)', () => {
    expect(withOpacity('transparent')).toBeNull();
    expect(withOpacity('rgba(156, 39, 176, 0.0)')).toBeNull();
    expect(withOpacity('#ff000000')).toBeNull();
    expect(withOpacity(null)).toBeNull();
    expect(withOpacity(undefined)).toBeNull();
    expect(isTransparent('transparent')).toBe(true);
    expect(isTransparent('#ff000000')).toBe(true);
    expect(isTransparent(undefined)).toBe(true);
    expect(isTransparent('#ff0000')).toBe(false);
  });
});
