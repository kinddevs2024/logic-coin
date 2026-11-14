import {describe,it,expect} from 'vitest';
import {resolveThemePreference} from '../src/lib/theme-preference';
describe('device appearance',()=>{
 it.each([0,6,12,19,23])('follows light device at hour %s',hour=>expect(resolveThemePreference('auto','light',new Date(2026,10,5,hour))).toBe('sky'));
 it.each([0,12,23])('follows dark device at hour %s',hour=>expect(resolveThemePreference('auto','dark',new Date(2026,10,5,hour))).toBe('dark'));
 it('keeps explicit preference despite device switch',()=>{expect(resolveThemePreference('pink','light')).toBe('pink');expect(resolveThemePreference('blue','dark')).toBe('blue');});
});
