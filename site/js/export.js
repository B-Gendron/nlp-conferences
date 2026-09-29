// Export / import of the publication plan: CSV, Markdown, JSON backup. Pure functions (no DOM) so they can be unit-tested.

const pad = (n) => String(n).padStart(2, '0');

/** UTC offset (hours) for the fixed-offset timezone labels used by the data; null if not a fixed offset. */
function fixedOffset(tz) {
  if (!tz) return 0;
  if (/^aoe$/i.test(tz)) return -12;
  const m = /^(?:UTC|GMT)\s*([+-]\d{1,2})?$/i.exec(tz.trim());
  return m ? Number(m[1] || 0) : null;
}

/** "2026-05-25 23:59 AoE": the deadline as the official call states it (venue's own timezone). */
export function wallClock(iso, tz) {
  if (!iso) return '';
  const off = fixedOffset(tz);
  const d = new Date(Date.parse(iso) + (off ?? 0) * 3600000);
  const label = off == null ? 'UTC' : tz || 'UTC';
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} ${label}`;
}

const utc = (iso) => (iso ? new Date(iso).toISOString().replace(/\.\d{3}Z$/, 'Z') : '');

function decisionStatus(c) {
  if (!c.notification) return 'unknown';
  return c.notificationEstimated ? 'estimated' : 'confirmed';
}

/** One row per submission cycle of each planned edition, in chronological order of deadline. */
export function planRows(editions, getNote = () => '') {
  const rows = [];
  for (const ed of editions) {
    const base = {
      venue: ed.v.acronym, year: ed.e.year, name: ed.v.name, core_rank: ed.rank === '—' ? '' : ed.rank,
      domains: ed.v.domains.join(';'),
    };
    const tail = {
      conference_start: ed.e.start || '', conference_end: ed.e.end || '', location: ed.e.place || '',
      website: ed.e.link || '', notes: getNote(ed.id) || '',
    };
    const cycles = ed.cycles.length ? ed.cycles : [{}];
    for (const c of cycles) {
      rows.push({
        ...base,
        cycle: c.label || '',
        abstract_utc: utc(c.abstract),
        deadline_utc: utc(c.deadline),
        deadline_venue_time: wallClock(c.deadline, ed.e.tz),
        decision_utc: utc(c.notification),
        decision_status: decisionStatus(c),
        ...tail,
        _key: c.deadline ? Date.parse(c.deadline) : 9e15,
      });
    }
  }
  rows.sort((a, b) => a._key - b._key || a.venue.localeCompare(b.venue));
  rows.forEach((r) => delete r._key);
  return rows;
}

// ---------------------------------------------------------------- CSV ----

/** Spreadsheet apps execute cells starting with = + - @ as formulas; neutralise user-provided text. */
const defuse = (s) => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);

export function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const cell = (v) => {
    const s = defuse(String(v ?? ''));
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM so Excel opens the file as UTF-8; CRLF per RFC 4180.
  return '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n') + '\r\n';
}

// ----------------------------------------------------------- Markdown ----

const mdCell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim() || '—';

function mdDate(iso, status, tz) {
  if (!iso) return 'unknown';
  const day = wallClock(iso, tz).slice(0, 10);
  return status === 'estimated' ? `${day} (est.)` : day;
}

export function toMarkdown(editions, getNote = () => '', today = new Date()) {
  const rows = planRows(editions, getNote);
  const out = ['# My publication plan', '',
    `_Exported from Venue Radar on ${today.toISOString().slice(0, 10)}. Deadlines are shown in each venue's own timezone; ` +
    `"est." marks estimated decision dates. Always confirm on the official call for papers._`, ''];
  if (!rows.length) return out.concat('No venues in the plan yet.', '').join('\n');

  out.push('## Timeline', '', '| Venue | Cycle | Deadline | Decision date | Conference |', '|---|---|---|---|---|');
  const byKey = new Map(editions.map((e) => [`${e.v.acronym}|${e.e.year}`, e]));
  for (const r of rows) {
    const ed = byKey.get(`${r.venue}|${r.year}`);
    const conf = r.conference_start ? `${r.conference_start}${r.conference_end && r.conference_end !== r.conference_start ? ' → ' + r.conference_end : ''}` : 'TBD';
    out.push(`| ${mdCell(`${r.venue} ${r.year}${r.core_rank ? ` (${r.core_rank})` : ''}`)} | ${mdCell(r.cycle)} | ` +
      `${mdCell(r.deadline_venue_time || 'TBD')} | ${mdCell(mdDate(r.decision_utc, r.decision_status, ed?.e.tz))} | ${mdCell(conf)} |`);
  }

  out.push('', '## Venues & notes', '');
  for (const ed of [...editions].sort((a, b) => a.v.acronym.localeCompare(b.v.acronym))) {
    out.push(`### ${ed.v.acronym} ${ed.e.year}${ed.rank !== '—' ? ` · CORE ${ed.rank}` : ''}`, '');
    out.push(`${ed.v.name}` + (ed.e.place ? ` · ${ed.e.place}` : ''));
    if (ed.e.link) out.push('', `<${ed.e.link}>`);
    const note = getNote(ed.id).trim();
    out.push('', note ? note.split('\n').map((l) => `> ${l}`).join('\n') : '_No notes yet._', '');
  }
  return out.join('\n');
}

// --------------------------------------------------------------- JSON ----

export const BACKUP_VERSION = 1;

/** Full backup (stars + notes) plus a readable copy of the plan. Only `stars` and `notes` are read back on import. */
export function toBackupJson(editions, state, today = new Date()) {
  return JSON.stringify({
    app: 'venue-radar', version: BACKUP_VERSION, exportedAt: today.toISOString(),
    stars: state.stars, notes: state.notes || {},
    plan: planRows(editions, (id) => state.notes?.[id] || ''),
  }, null, 2);
}

const MAX_NOTE = 20000;

/**
 * Validate an uploaded backup. Returns { stars, notes, ignored } restricted to known edition ids,
 * or throws an Error with a user-readable message.
 */
export function parseBackup(text, validIds) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('That file is not valid JSON.'); }
  if (!data || data.app !== 'venue-radar' || typeof data.version !== 'number') throw new Error('That file is not a Venue Radar backup.');
  if (data.version > BACKUP_VERSION) throw new Error('This backup comes from a newer version of Venue Radar.');
  const known = new Set(validIds);
  const stars = [], notes = {};
  let ignored = 0;
  for (const id of Array.isArray(data.stars) ? data.stars : []) {
    if (typeof id === 'string' && known.has(id)) stars.push(id); else ignored++;
  }
  for (const [id, note] of Object.entries(data.notes && typeof data.notes === 'object' ? data.notes : {})) {
    if (typeof note === 'string' && known.has(id) && note.trim()) notes[id] = note.slice(0, MAX_NOTE); else ignored++;
  }
  return { stars, notes, ignored };
}

/** Merge into current state without destroying anything: union of stars; imported notes only fill empty slots. */
export function mergeBackup(state, imported) {
  const stars = [...new Set([...state.stars, ...imported.stars])];
  const notes = { ...(state.notes || {}) };
  let added = 0, kept = 0;
  for (const [id, note] of Object.entries(imported.notes)) {
    if (notes[id]?.trim() && notes[id] !== note) kept++; else if (!notes[id]) { notes[id] = note; added++; }
  }
  return { stars, notes, addedStars: stars.length - state.stars.length, addedNotes: added, keptNotes: kept };
}
