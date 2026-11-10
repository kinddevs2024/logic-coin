import test from 'node:test';
import assert from 'node:assert/strict';
import { activity, dayKey, dayStart, periodBounds, scenario, remaining } from '../public/activity.mjs';

test('weekly activity allows two misses and excludes on the third, never before today closes', () => {
  const completed = ['2026-11-09'];
  let value = activity('week', Date.parse('2026-11-12T23:59:59+05:00'), completed);
  assert.equal(value.misses, 2); assert.equal(value.eligible, true); assert.equal(value.left, 0);
  value = activity('week', Date.parse('2026-11-13T00:00:00+05:00'), completed);
  assert.equal(value.misses, 3); assert.equal(value.eligible, false);
});

test('monthly activity allows four cumulative misses, including gaps that are not consecutive', () => {
  const completed = ['2026-11-02', '2026-11-04', '2026-11-06', '2026-11-08'];
  let value = activity('month', Date.parse('2026-11-09T12:00:00+05:00'), completed);
  assert.equal(value.misses, 4); assert.equal(value.eligible, true);
  value = activity('month', Date.parse('2026-11-10T00:00:00+05:00'), completed);
  assert.equal(value.misses, 5); assert.equal(value.eligible, false);
});

test('everyone begins eligible at period start and each period resets independently', () => {
  const monday = activity('week', Date.parse('2026-11-16T00:00:00+05:00'), []);
  assert.equal(monday.misses, 0); assert.equal(monday.done, 0); assert.equal(monday.eligible, true);
  assert.equal(activity('month', Date.parse('2026-11-16T00:00:00+05:00'), []).eligible, false);
  const month = activity('month', Date.parse('2026-12-01T00:00:00+05:00'), ['2026-11-30']);
  assert.equal(month.misses, 0); assert.equal(month.done, 0); assert.equal(month.eligible, true);
});

test('completion today counts immediately, duplicates and future/outside-period days do not', () => {
  const now = Date.parse('2026-11-10T15:00:00+05:00');
  const value = activity('week', now, ['2026-11-09', '2026-11-10', '2026-11-10', '2026-11-11', '2026-11-01']);
  assert.equal(value.done, 2); assert.equal(value.misses, 0); assert.equal(value.closedDays, 1);
  assert.equal(value.cells[1].state, 'complete'); assert.equal(value.cells[2].state, 'future');
});

test('all time boundaries use Tashkent, including leap months and year changes', () => {
  assert.equal(dayKey(Date.parse('2026-11-08T19:00:00Z')), '2026-11-09');
  assert.equal(dayStart('2026-11-09'), Date.parse('2026-11-08T19:00:00Z'));
  assert.deepEqual(periodBounds('week', '2027-01-01'), { start: '2026-12-28', next: '2027-01-04', days: 7 });
  for (const [day, days] of [['2028-02-05',29], ['2027-02-05',28], ['2026-11-05',30], ['2026-12-05',31]]) {
    const value = activity('month', dayStart(day), []);
    assert.equal(value.days, days); assert.equal(value.required, days - 4);
  }
  assert.deepEqual(remaining(0, 1), { days: 0, hours: 0, minutes: 0, seconds: 0 });
});

test('preview scenarios use a coherent shared history and demonstrate every approved boundary', () => {
  const base = Date.parse('2026-11-10T12:00:00+05:00');
  for (const [name, weekly, monthly, weekIn, monthIn] of [
    ['week-limit',2,2,true,true], ['week-out',3,3,false,true], ['month-limit',2,4,true,true], ['both-out',3,5,false,false], ['new-week',0,5,true,false],
  ]) {
    const state = scenario(name, base), week = activity('week', state.now, state.completedDays), month = activity('month', state.now, state.completedDays);
    assert.equal(week.misses, weekly, name); assert.equal(month.misses, monthly, name);
    assert.equal(week.eligible, weekIn, name); assert.equal(month.eligible, monthIn, name);
  }
  const first = scenario('first-day', base);
  assert.equal(activity('week', first.now, first.completedDays).misses, 0);
});

test('completing later games cannot undo exclusion from earlier missed days', () => {
  const state = scenario('week-out', Date.parse('2026-11-10T12:00:00+05:00'));
  const completed = [...state.completedDays, dayKey(state.now)];
  assert.equal(activity('week', state.now, completed).eligible, false);
  assert.equal(activity('month', state.now, completed).eligible, true);
});
