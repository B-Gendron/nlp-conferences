// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Barbara Gendron
import test from 'node:test';
import assert from 'node:assert/strict';
import { toUtcIso, parseDateRange, applyOverride, estimateNotifications, diffDatasets, buildIcs, normalizeCycle } from './lib.mjs';

test('AoE / UTC offsets convert to UTC', () => {
  assert.equal(toUtcIso('2026-05-25 23:59:59', 'AoE'), '2026-05-26T11:59:59.000Z');
  assert.equal(toUtcIso('2026-05-25 23:59:59', 'UTC-12'), '2026-05-26T11:59:59.000Z');
  assert.equal(toUtcIso('2026-05-25 12:00:00', 'UTC+8'), '2026-05-25T04:00:00.000Z');
  assert.equal(toUtcIso('2026-05-25 12:00:00', 'UTC'), '2026-05-25T12:00:00.000Z');
});

test('PT honours daylight saving', () => {
  assert.equal(toUtcIso('2026-07-01 12:00:00', 'PT'), '2026-07-01T19:00:00.000Z');
  assert.equal(toUtcIso('2026-01-15 12:00:00', 'PT'), '2026-01-15T20:00:00.000Z');
});

test('TBD and garbage give null', () => {
  assert.equal(toUtcIso('TBD', 'AoE'), null);
  assert.equal(toUtcIso(undefined, 'AoE'), null);
});

test('bare dates mean end of day', () => {
  assert.equal(toUtcIso('2026-12-08', 'AoE'), '2026-12-09T11:59:59.000Z');
});

test('conference date ranges', () => {
  assert.deepEqual(parseDateRange('October 24 - 29, 2026', 2026), { start: '2026-10-24', end: '2026-10-29' });
  assert.deepEqual(parseDateRange('July 31-August 8, 2022', 2022), { start: '2022-07-31', end: '2022-08-08' });
  assert.deepEqual(parseDateRange('29 June - 3 July, 2026', 2026), { start: '2026-06-29', end: '2026-07-03' });
  assert.deepEqual(parseDateRange('Nov. 25-27, 2021', 2021), { start: '2021-11-25', end: '2021-11-27' });
  assert.deepEqual(parseDateRange('December 5, 2022', 2022), { start: '2022-12-05', end: '2022-12-05' });
  assert.deepEqual(parseDateRange('December 29 - January 2, 2027', 2027), { start: '2026-12-29', end: '2027-01-02' });
  assert.deepEqual(parseDateRange('September 26- October 01, 2022', 2022), { start: '2022-09-26', end: '2022-10-01' });
  assert.equal(parseDateRange('May 2027 (exact dates TBD)', 2027), null);
  assert.equal(parseDateRange('TBD', 2027), null);
});

test('override sets notification on the last cycle and clears the estimate flag', () => {
  const ed = { id: 'x26', tz: 'AoE', cycles: [
    { label: 'a', deadline: '2026-01-01T00:00:00.000Z', notification: null, tbd: false },
    { label: 'b', deadline: '2026-03-01T00:00:00.000Z', notification: null, tbd: false }] };
  estimateNotifications(ed, 30);
  assert.equal(ed.cycles[1].notificationEstimated, true);
  const out = applyOverride(ed, { notification: '2026-04-01' });
  assert.equal(out.cycles[1].notification, '2026-04-02T11:59:59.000Z');
  assert.equal(out.cycles[1].notificationEstimated, false);
  assert.equal(out.cycles[0].notificationEstimated, true);
});

test('override can add and patch cycles by index', () => {
  const ed = { id: 'x', tz: 'UTC', cycles: [{ label: '', deadline: null, notification: null, tbd: true }] };
  const out = applyOverride(ed, { cycles: [{ deadline: '2026-05-01 10:00:00' }], add_cycles: [{ label: 'late', deadline: '2026-06-01 10:00:00' }] });
  assert.equal(out.cycles.length, 2);
  assert.equal(out.cycles[0].deadline, '2026-05-01T10:00:00.000Z');
  assert.equal(out.cycles[0].tbd, false);
});

test('changes are detected when a deadline moves or is announced', () => {
  const mk = (deadline, notification = null) => ({ venues: [{ acronym: 'V', editions: [{ id: 'v26', year: 2026, cycles: [{ label: '', deadline, notification }] }] }] });
  const c = diffDatasets(mk(null), mk('2026-01-01T00:00:00.000Z'), 'now');
  assert.equal(c[0].type, 'announced');
  const m = diffDatasets(mk('2026-01-01T00:00:00.000Z'), mk('2026-01-08T00:00:00.000Z'), 'now');
  assert.equal(m[0].type, 'moved');
  assert.equal(diffDatasets(mk('2026-01-01T00:00:00.000Z'), mk('2026-01-01T00:00:00.000Z'), 'now').length, 0);
});

test('ICS output is well-formed', () => {
  const cyc = normalizeCycle({ deadline: '2026-05-25 23:59:59', comment: 'ARR, main' }, 'AoE');
  const ics = buildIcs([{ acronym: 'EMNLP', name: 'EMNLP', editions: [{ id: 'emnlp26', year: 2026, cycles: [cyc], start: '2026-10-24', end: '2026-10-29', place: 'Budapest' }] }], '2026-01-01T00:00:00.000Z');
  assert.match(ics, /^BEGIN:VCALENDAR/);
  assert.match(ics, /DTSTART:20260526T105959Z/);
  assert.match(ics, /DTEND;VALUE=DATE:20261030/);
  assert.match(ics, /ARR\\, main/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, (ics.match(/END:VEVENT/g) || []).length);
});
