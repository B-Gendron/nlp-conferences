// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Barbara Gendron
// Pure helpers for the sync pipeline (no I/O, so they can be unit-tested).

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const DAY = 86400000;

/** Offset (hours) of an IANA zone at a given UTC instant, via Intl. */
function zoneOffsetHours(timeZone, atMs) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(atMs));
  const g = (t) => Number(parts.find((p) => p.type === t).value);
  const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'));
  return (asUtc - atMs) / 3600000;
}

/**
 * Resolve the timezone labels used upstream ("AoE", "UTC-12", "UTC+8", "PT"...)
 * to a UTC offset in hours for a given wall-clock time. Returns null if unknown.
 */
export function offsetHours(tz, wallMs) {
  if (!tz) return 0;
  const t = String(tz).trim();
  if (/^aoe$/i.test(t)) return -12;
  if (/^utc$/i.test(t)) return 0;
  const m = t.match(/^(?:UTC|GMT)\s*([+-]\d{1,2})(?::?(\d{2}))?$/i);
  if (m) return Number(m[1]) + Math.sign(Number(m[1])) * (Number(m[2] || 0) / 60);
  if (/^p[sd]?t$/i.test(t)) return zoneOffsetHours('America/Los_Angeles', wallMs);
  if (/^e[sd]?t$/i.test(t)) return zoneOffsetHours('America/New_York', wallMs);
  if (/^c?et$/i.test(t)) return zoneOffsetHours('Europe/Paris', wallMs);
  try { return zoneOffsetHours(t, wallMs); } catch { return null; }
}

/**
 * "2026-05-25 23:59:59" (or a Date-only string/YAML date) in `tz` -> ISO UTC string.
 * Returns null for TBD / unparseable values.
 */
export function toUtcIso(value, tz) {
  if (value == null) return null;
  const s = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  // A bare date means "end of day" for deadlines.
  const [H, M, S] = m[4] ? [Number(m[4]), Number(m[5]), Number(m[6] || 0)] : [23, 59, 59];
  const wall = Date.UTC(y, mo, d, H, M, S);
  const off = offsetHours(tz, wall);
  if (off == null) return null;
  return new Date(wall - off * 3600000).toISOString();
}

const ymd = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

/** A bare calendar date (no time-of-day semantics), e.g. conference days. */
const iso = (y, m, d) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);

/**
 * Best-effort parse of free-text conference dates:
 * "October 24 - 29, 2026", "29 June - 3 July, 2026", "July 31-August 8, 2022", "May 2027 (exact dates TBD)".
 * Returns { start, end } as YYYY-MM-DD, or null when no exact day is present.
 */
export function parseDateRange(text, fallbackYear) {
  if (!text) return null;
  const str = String(text).replace(/\([^)]*\)/g, ' ');
  const tokens = str.match(/[A-Za-z]+\.?|\d+/g) || [];
  const dayFirst = /^\s*\d{1,2}\s+[A-Za-z]/.test(str);
  let year = null, month = null;
  const days = [];
  let pending = [];
  for (const tok of tokens) {
    if (/^\d+$/.test(tok)) {
      const n = Number(tok);
      if (n >= 1900) { year = n; continue; }
      if (n < 1 || n > 31) continue;
      if (dayFirst || month == null) pending.push(n);
      else days.push([month, n]);
    } else {
      const key = tok.toLowerCase().replace('.', '').slice(0, 3);
      if (!(key in MONTHS) || tok.length < 3) continue;
      month = MONTHS[key];
      for (const d of pending) days.push([month, d]);
      pending = [];
    }
  }
  if (!days.length) return null;
  const y = year ?? fallbackYear;
  if (y == null) return null;
  const [first, last] = [days[0], days[days.length - 1]];
  let end = iso(y, last[0], last[1]);
  let start = iso(y, first[0], first[1]);
  if (start > end) start = iso(y - 1, first[0], first[1]); // "Dec 29 - Jan 2, 2027"
  return { start, end };
}

/**
 * Normalize one upstream timeline entry into a cycle:
 *   { label, abstract, deadline, notification, notificationEstimated, tbd }
 */
export function normalizeCycle(entry, tz) {
  const label = entry.comment ? String(entry.comment).trim() : '';
  const deadline = toUtcIso(entry.deadline, tz);
  return {
    label,
    abstract: toUtcIso(entry.abstract_deadline, tz),
    deadline,
    notification: toUtcIso(entry.decision_deadline, tz),
    tbd: deadline == null,
    ...(entry.rebuttal_deadline ? { rebuttal: toUtcIso(entry.rebuttal_deadline, tz) } : {}),
  };
}

/**
 * Apply hand-written overrides to an edition. Override shape (all optional):
 *   place, link, start, end,
 *   notification: <date>            -> shorthand for the last cycle
 *   cycles: [ {label?, abstract?, deadline?, notification?, ...} | null, ... ]  (merged by index)
 *   add_cycles: [ {label, deadline, ...} ]                                        (appended)
 * Dates are interpreted in `override.tz` if given, else the edition tz.
 */
export function applyOverride(edition, ov) {
  if (!ov) return edition;
  const tz = ov.tz || edition.tz;
  const out = { ...edition, cycles: edition.cycles.map((c) => ({ ...c })), overridden: true };
  if (ov.place) out.place = ov.place;
  if (ov.link) out.link = ov.link;
  if (ov.start) out.start = ymd(ov.start);
  if (ov.end) out.end = ymd(ov.end);
  const patch = (cycle, p) => {
    for (const k of ['abstract', 'deadline', 'notification', 'rebuttal']) {
      if (p[k] === undefined) continue;
      cycle[k] = p[k] === null ? null : toUtcIso(p[k], tz);
      if (k === 'notification') { cycle.notificationEstimated = false; cycle.notificationSource = 'manual'; }
      if (k === 'deadline') cycle.tbd = cycle[k] == null;
    }
    if (p.label) cycle.label = p.label;
  };
  if (ov.notification !== undefined && out.cycles.length) patch(out.cycles[out.cycles.length - 1], { notification: ov.notification });
  (ov.cycles || []).forEach((p, i) => { if (p && out.cycles[i]) patch(out.cycles[i], p); });
  for (const p of ov.add_cycles || []) {
    const c = { label: '', abstract: null, deadline: null, notification: null, tbd: true };
    patch(c, p);
    out.cycles.push(c);
  }
  return out;
}

/** Fill in missing notification dates from a venue's typical review duration (flagged as estimates). */
export function estimateNotifications(edition, reviewDays) {
  if (!reviewDays) return edition;
  for (const c of edition.cycles) {
    if (c.notification || !c.deadline) continue;
    c.notification = new Date(Date.parse(c.deadline) + reviewDays * DAY).toISOString();
    c.notificationEstimated = true;
    c.notificationSource = 'estimate';
  }
  return edition;
}

/** Stable identity of a cycle for change detection. */
const cycleKey = (edId, i) => `${edId}#${i}`;

/** Diff two published datasets into human-readable change records. */
export function diffDatasets(prev, next, nowIso) {
  const index = (data) => {
    const m = new Map();
    for (const v of data?.venues || []) for (const e of v.editions) {
      e.cycles.forEach((c, i) => m.set(cycleKey(e.id, i), { v, e, c }));
      m.set(`${e.id}#edition`, { v, e, c: null });
    }
    return m;
  };
  const a = index(prev), b = index(next);
  const changes = [];
  for (const [key, { v, e, c }] of b) {
    if (!c) {
      if (!a.has(key)) changes.push({ at: nowIso, venue: v.acronym, year: e.year, edition: e.id, type: 'new-edition' });
      continue;
    }
    const old = a.get(key)?.c;
    for (const field of ['deadline', 'notification']) {
      const from = old?.[field] ?? null, to = c[field] ?? null;
      if (from === to || (field === 'notification' && c.notificationEstimated && old?.notificationEstimated)) continue;
      if (!old && !to) continue;
      changes.push({
        at: nowIso, venue: v.acronym, year: e.year, edition: e.id, field,
        label: c.label || undefined, from, to,
        type: !from ? 'announced' : !to ? 'removed' : 'moved',
      });
    }
  }
  return changes;
}

export { buildIcs } from '../site/js/ics.js';
