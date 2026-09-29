import test from 'node:test';
import assert from 'node:assert/strict';
import { wallClock, planRows, toCsv, toMarkdown, toBackupJson, parseBackup, mergeBackup } from '../site/js/export.js';

const ed = (over = {}) => ({
  id: 'iclr27', rank: 'A*',
  v: { acronym: 'ICLR', name: 'International Conference on Learning Representations', domains: ['ml'] },
  e: { year: 2027, tz: 'AoE', start: '2027-04-26', end: '2027-04-30', place: 'Somewhere', link: 'https://iclr.cc' },
  cycles: [{ label: 'Main', abstract: '2026-09-19T11:59:59.000Z', deadline: '2026-09-26T11:59:59.000Z', notification: '2026-12-17T11:59:59.000Z', notificationEstimated: false }],
  ...over,
});

test('wallClock shows the deadline in the venue timezone', () => {
  assert.equal(wallClock('2026-05-26T11:59:59.000Z', 'AoE'), '2026-05-25 23:59 AoE');
  assert.equal(wallClock('2026-05-25T04:00:00.000Z', 'UTC+8'), '2026-05-25 12:00 UTC+8');
  assert.equal(wallClock(null, 'AoE'), '');
});

test('rows are sorted by deadline and flag decision status', () => {
  const later = ed({ id: 'x', v: { acronym: 'LATE', name: 'n', domains: [] }, cycles: [{ deadline: '2027-01-01T00:00:00.000Z', notification: '2027-03-01T00:00:00.000Z', notificationEstimated: true }] });
  const none = ed({ id: 'y', v: { acronym: 'NONE', name: 'n', domains: [] }, cycles: [] });
  const rows = planRows([none, later, ed()]);
  assert.deepEqual(rows.map((r) => r.venue), ['ICLR', 'LATE', 'NONE']);
  assert.equal(rows[0].decision_status, 'confirmed');
  assert.equal(rows[1].decision_status, 'estimated');
  assert.equal(rows[2].decision_status, 'unknown');
  assert.equal(rows[0].deadline_venue_time, '2026-09-25 23:59 AoE');
});

test('CSV quotes fields, keeps unicode, and defuses spreadsheet formulas in notes', () => {
  const csv = toCsv(planRows([ed()], () => '=HYPERLINK("http://evil")\nsecond, line'));
  assert.ok(csv.startsWith('﻿'));
  assert.match(csv, /"'=HYPERLINK\(""http:\/\/evil""\)\nsecond, line"/);
  assert.equal(csv.split('\r\n')[0].split(',')[0], '﻿venue');
});

test('Markdown escapes pipes and quotes notes', () => {
  const md = toMarkdown([ed({ cycles: [{ label: 'a|b', deadline: '2026-09-26T11:59:59.000Z' }] })], () => 'line1\nline2', new Date('2026-10-01T00:00:00Z'));
  assert.match(md, /a\\\|b/);
  assert.match(md, /> line1\n> line2/);
  assert.match(md, /\| unknown \|/);
  assert.match(toMarkdown([], () => ''), /No venues/);
});

test('backup round-trips and rejects foreign or hostile input', () => {
  const state = { stars: ['iclr27'], notes: { iclr27: 'my paper' } };
  const parsed = parseBackup(toBackupJson([ed()], state), ['iclr27']);
  assert.deepEqual(parsed, { stars: ['iclr27'], notes: { iclr27: 'my paper' }, ignored: 0 });
  assert.throws(() => parseBackup('nope', []), /not valid JSON/);
  assert.throws(() => parseBackup('{"a":1}', []), /not a Venue Radar backup/);
  assert.throws(() => parseBackup('{"app":"venue-radar","version":99}', []), /newer version/);
  const dirty = parseBackup(JSON.stringify({ app: 'venue-radar', version: 1, stars: ['iclr27', 'gone', 5], notes: { iclr27: 'ok', gone: 'x', bad: 3 } }), ['iclr27']);
  assert.deepEqual(dirty.stars, ['iclr27']);
  assert.equal(dirty.ignored, 4);
});

test('import never overwrites an existing note', () => {
  const m = mergeBackup({ stars: ['a'], notes: { a: 'mine' } }, { stars: ['a', 'b'], notes: { a: 'theirs', b: 'new' } });
  assert.deepEqual(m.stars, ['a', 'b']);
  assert.equal(m.notes.a, 'mine');
  assert.equal(m.notes.b, 'new');
  assert.deepEqual([m.addedStars, m.addedNotes, m.keptNotes], [1, 1, 1]);
});
