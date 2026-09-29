// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Barbara Gendron
// Data loading, persisted UI state and filtering.

import { ms, rankOf, conferenceDayMs, DAY } from './util.js';

const KEY = 'nc.v2';

const DEFAULTS = {
  view: 'timeline',
  domains: [],          // empty = all
  ranks: [],            // empty = all
  neurosym: false,
  hideClosed: true,
  months: 12,
  layers: { deadlines: true, conference: true },
  tz: 'local',
  stars: [],
  notes: {},            // edition id -> free text, kept even if the venue is later un-starred
};

export const state = applyHash(load());
export const listeners = new Set();

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch { return { ...DEFAULTS }; }
}

/** `#view=plan&stars=emnlp26,iswc26` opens a view / shared plan; it overrides the saved state for this visit. */
function applyHash(st) {
  try {
    const p = new URLSearchParams(location.hash.slice(1));
    if (['timeline', 'list', 'plan'].includes(p.get('view'))) st.view = p.get('view');
    if (p.get('stars')) st.stars = p.get('stars').split(',').filter(Boolean);
  } catch { /* no location */ }
  return st;
}

export const shareUrl = () => `${location.origin}${location.pathname}#view=plan&stars=${state.stars.join(',')}`;

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
}

export function update(patch) {
  Object.assign(state, patch);
  persist();
  listeners.forEach((fn) => fn());
}

export const getNote = (id) => state.notes?.[id] || '';

/** Saves without re-rendering, so typing in a textarea never loses focus. */
export function setNote(id, text) {
  state.notes = { ...state.notes };
  if (text.trim()) state.notes[id] = text; else delete state.notes[id];
  persist();
}

export const isStarred = (id) => state.stars.includes(id);
export const toggleStar = (id) =>
  update({ stars: isStarred(id) ? state.stars.filter((s) => s !== id) : [...state.stars, id] });

// ------------------------------------------------------------ dataset ----

export async function loadData() {
  const get = async (u) => (await fetch(u, { cache: 'no-cache' })).json();
  const [data, changes] = await Promise.all([get('data/conferences.json'), get('data/changelog.json').catch(() => [])]);
  return { ...enrich(data), changes };
}

/** Flatten venues -> editions and precompute the timestamps every view needs. */
function enrich(data) {
  const editions = [];
  for (const v of data.venues) {
    for (const e of v.editions) {
      const cycles = e.cycles.map((c) => ({
        ...c,
        dl: ms(c.deadline), ab: ms(c.abstract), nt: ms(c.notification),
      }));
      editions.push({
        id: e.id, v, e, cycles,
        rank: rankOf(v),
        confStart: conferenceDayMs(e.start),
        confEnd: e.end ? conferenceDayMs(e.end) + DAY : null,   // exclusive end -> covers the last day
        search: `${v.acronym} ${v.name} ${e.year} ${e.place || ''}`.toLowerCase(),
      });
    }
  }
  return { generatedAt: data.generatedAt, venues: data.venues, editions };
}

// ------------------------------------------------------------ filters ----

export function matches(ed, now = Date.now()) {
  const s = state;
  if (s.domains.length && !ed.v.domains.some((d) => s.domains.includes(d))) return false;
  if (s.neurosym && !ed.v.neurosym) return false;
  if (s.ranks.length && !s.ranks.includes(ed.rank)) return false;
  if (s.q && !ed.search.includes(s.q.toLowerCase())) return false;
  if (s.hideClosed && isClosed(ed, now)) return false;
  return true;
}

/** An edition is "closed" when everything about it is in the past. */
export function isClosed(ed, now = Date.now()) {
  const last = Math.max(0, ...ed.cycles.flatMap((c) => [c.dl, c.nt].filter(Boolean)), ed.confEnd || 0);
  return last > 0 && last < now;
}

export const nextDeadline = (ed, now = Date.now()) =>
  ed.cycles.filter((c) => c.dl && c.dl >= now).sort((a, b) => a.dl - b.dl)[0] || null;

export const hasDates = (ed) => ed.cycles.some((c) => c.dl || c.nt) || ed.confStart;

/** Sort key for "what matters next": upcoming deadline, else pending notification, else conference start. */
export function sortKey(ed, now = Date.now()) {
  const nd = nextDeadline(ed, now);
  if (nd) return nd.dl;
  const nt = ed.cycles.map((c) => c.nt).filter((t) => t && t >= now).sort((a, b) => a - b)[0];
  if (nt) return 1e13 + nt;                       // tier 2: waiting for a decision
  return ed.confStart && ed.confStart >= now ? 2e13 + ed.confStart : 9e15;   // tier 3: conference only
}

/** All dated milestones of an edition, flattened. */
export function milestones(ed) {
  const out = [];
  ed.cycles.forEach((c, i) => {
    const tag = c.label || '';
    if (c.ab) out.push({ kind: 'abstract', t: c.ab, ed, cycle: c, label: tag });
    if (c.dl) out.push({ kind: 'deadline', t: c.dl, ed, cycle: c, label: tag });
    if (c.nt) out.push({ kind: 'notification', t: c.nt, ed, cycle: c, label: tag, estimated: c.notificationEstimated });
  });
  if (ed.confStart) out.push({ kind: 'conference', t: ed.confStart, end: ed.confEnd, ed, label: '' });
  return out.sort((a, b) => a.t - b.t);
}

/** Venue-level filter (used for venues that have no edition announced at all). */
export function matchesVenue(v) {
  const s = state;
  if (s.domains.length && !v.domains.some((d) => s.domains.includes(d))) return false;
  if (s.neurosym && !v.neurosym) return false;
  if (s.ranks.length && !s.ranks.includes(rankOf(v))) return false;
  if (s.q && !`${v.acronym} ${v.name}`.toLowerCase().includes(s.q.toLowerCase())) return false;
  return true;
}
