// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Barbara Gendron
// "My plan": the starred venues as an agenda, with crunch warnings and "if rejected, where next?" fallbacks.

import { h, DAY, debounce, fmtWeekday, fmtDay, fmtMonth, fmtDate, fmtRange, relative, rankClass } from './util.js';
import { state, update, matches, milestones, isStarred, toggleStar, shareUrl, getNote, setNote, nextDeadline } from './model.js';
import { buildIcs } from './ics.js';
import { planRows, toCsv, toMarkdown, toBackupJson, parseBackup, mergeBackup } from './export.js';

/** Textarea that autosaves a private note for an edition (stored in this browser only). */
export function noteEditor(ed, { rows = 3 } = {}) {
  const status = h('span.muted.small.saved', '');
  const save = debounce((text) => {
    setNote(ed.id, text);
    status.textContent = 'Saved';
    setTimeout(() => { status.textContent = ''; }, 1500);
  }, 350);
  const ta = h('textarea.note', {
    rows, placeholder: 'What do you plan to submit here? Paper title, status, co-authors, to-dos…',
    'aria-label': `Notes for ${ed.v.acronym} ${ed.e.year}`,
    oninput: (e) => { status.textContent = ''; save(e.target.value); },
  });
  ta.value = getNote(ed.id);
  return h('div.note-box', ta, status);
}

const ICON = { abstract: '◇', deadline: '◆', notification: '●', conference: '▬' };
const NAME = { abstract: 'Abstract due', deadline: 'Submission deadline', notification: 'Decision date', conference: 'Conference' };

export function renderPlan(root, data, { openDetail, download }) {
  const now = Date.now();
  const starred = data.editions.filter((e) => isStarred(e.id));
  root.replaceChildren();

  if (!starred.length) {
    root.append(flashNode(), h('div.empty',
      h('h3', 'Build your publication strategy'),
      h('p', 'Star the venues you’re considering (☆ in the timeline or deadlines view). This page then lays out your year, flags deadline crunches, and shows where you could resubmit if a decision goes the wrong way.'),
      h('div.row-actions.center', importControl(data))));
    return;
  }

  // Chronological across all starred venues; drop anything that ended more than two weeks ago.
  const events = starred.flatMap(milestones).filter((m) => (m.end ?? m.t) >= now - 14 * DAY).sort((a, b) => a.t - b.t);

  // ---- header / export
  root.append(flashNode(), h('div.plan-head',
    h('p.muted', `${starred.length} venue${starred.length > 1 ? 's' : ''} in your plan.`),
    h('div.row-actions',
      h('button.btn', {
        onclick: (ev) => {
          navigator.clipboard?.writeText(shareUrl()).then(() => { ev.target.textContent = 'Link copied ✓'; setTimeout(() => { ev.target.textContent = 'Copy share link'; }, 1800); });
        },
      }, 'Copy share link'),
      exportMenu(starred, data, download),
      importControl(data))));

  // ---- heads-up
  const warnings = crunches(events, now);
  if (warnings.length) {
    root.append(h('section.plan-sec.warn', h('h3', 'Heads-up'), h('ul', warnings.map((w) => h('li', w)))));
  }

  // ---- fallbacks
  const fallbacks = buildFallbacks(starred, data, now);
  // ---- agenda
  const agenda = h('section.plan-sec', h('h3', 'Your agenda'));
  let month = '';
  for (const m of events) {
    const iso = new Date(m.t).toISOString();
    const mon = fmtMonth(iso);
    if (mon !== month) { month = mon; agenda.append(h('h4.month', mon)); }
    agenda.append(h('div.ev.' + m.kind + (m.t < now && !(m.end > now) ? '.past' : ''), { onclick: () => openDetail(m.ed) },
      h('span.ic', ICON[m.kind]),
      h('span.d', fmtWeekday(iso)),
      h('span.t', h('strong', `${m.ed.v.acronym} ${m.ed.e.year}`), ' ', NAME[m.kind], m.estimated ? ' (estimated)' : '', m.label ? h('span.muted', ` · ${m.label}`) : ''),
      h('span.r.muted', m.kind === 'conference' ? fmtRange(m.ed.e.start, m.ed.e.end) : relative(iso, now)),
      m.estimated ? h('span.badge.est', 'est.') : null));
  }
  root.append(notesSection(starred, now, openDetail));
  root.append(h('div.plan-cols', agenda, fallbacks));

  root.append(h('p.muted.small', 'Tip: click any entry to open the venue. Remove venues from your plan with ★.'));
}

/** Warn when two of my submission deadlines are close together. */
function crunches(events, now) {
  const dls = events.filter((m) => m.kind === 'deadline' && m.t >= now).sort((a, b) => a.t - b.t);
  const out = [];
  for (let i = 0; i < dls.length - 1; i++) {
    const [a, b] = [dls[i], dls[i + 1]];
    if (a.ed.id === b.ed.id) continue;
    const gap = Math.round((b.t - a.t) / DAY);
    if (gap <= 10) {
      out.push(`${a.ed.v.acronym} (${fmtDay(new Date(a.t).toISOString())}) and ${b.ed.v.acronym} (${fmtDay(new Date(b.t).toISOString())}) are only ${gap} day${gap === 1 ? '' : 's'} apart.`);
    }
  }
  return out;
}

/**
 * For each of my submissions whose decision is still ahead (or very recent): which other deadlines open
 * up within 75 days after that decision? Those are your resubmission options.
 */
function buildFallbacks(starred, data, now) {
  const sec = h('section.plan-sec', h('h3', 'If the decision goes the wrong way'),
    h('p.muted.small', 'Deadlines that come after each expected decision date, among the venues matching your current filters.'));
  const pool = data.editions.filter((e) => matches(e, now) || isStarred(e.id));
  let count = 0;
  const seen = new Set();
  const items = starred.flatMap((ed) => ed.cycles.filter((c) => c.nt && c.nt >= now - 7 * DAY && c.dl && c.dl < c.nt + 1)
    .map((c) => ({ ed, c }))).sort((a, b) => a.c.nt - b.c.nt);
  for (const { ed, c } of items) {
    const options = pool
      .filter((o) => o.id !== ed.id)
      .flatMap((o) => o.cycles.filter((oc) => oc.dl && oc.dl > c.nt && oc.dl <= c.nt + 75 * DAY).map((oc) => ({ o, oc })))
      .sort((a, b) => a.oc.dl - b.oc.dl).slice(0, 5);
    const nIso = new Date(c.nt).toISOString();
    const key = ed.id + c.nt;
    if (seen.has(key)) continue;
    seen.add(key);
    count++;
    sec.append(h('div.fb',
      h('div.fb-head', h('strong', `${ed.v.acronym} ${ed.e.year}`), c.label ? h('span.muted', ` · ${c.label}`) : null,
        h('span.muted', ` – decision date ${c.notificationEstimated ? '≈ ' : ''}${fmtDate(nIso)}`)),
      options.length ? h('ul', options.map(({ o, oc }) => h('li',
        h('span.d', fmtDay(new Date(oc.dl).toISOString())), ' ',
        h('strong', `${o.v.acronym} ${o.e.year}`), ' ', h('span.pill.' + rankClass(o.rank), o.rank === '—' ? '' : o.rank),
        h('span.muted', ` · ${Math.round((oc.dl - c.nt) / DAY)} d after`),
        ' ', isStarred(o.id) ? h('span.badge.ok', 'in plan') : h('button.link', { onclick: () => toggleStar(o.id) }, '+ add')
      ))) : h('p.muted.small', 'No matching deadline within 75 days after the decision.')));
  }
  if (!count) sec.append(h('p.muted', 'None of your venues has a known (or estimated) decision date ahead yet.'));
  return sec;
}

/** One card per starred venue with a notes field – "what am I submitting here?". */
function notesSection(starred, now, openDetail) {
  const sorted = [...starred].sort((a, b) => (nextDeadline(a, now)?.dl ?? 9e15) - (nextDeadline(b, now)?.dl ?? 9e15));
  return h('section.plan-sec', h('h3', 'Your venues & notes'),
    h('p.muted.small', 'Notes stay in this browser only (they are not part of the share link).'),
    h('div.note-grid', sorted.map((ed) => {
      const nd = nextDeadline(ed, now);
      return h('div.note-card',
        h('div.note-head',
          h('button.name', { onclick: () => openDetail(ed) }, h('strong', ed.v.acronym), ' ', ed.e.year),
          h('span.pill.' + rankClass(ed.rank), ed.rank === '—' ? '' : ed.rank),
          h('span.muted.small', nd ? `deadline ${relative(new Date(nd.dl).toISOString(), now)}` : 'no upcoming deadline'),
          h('button.star.on', { title: 'Remove from my plan', onclick: () => toggleStar(ed.id) }, '★')),
        noteEditor(ed));
    })));
}

// -------------------------------------------------- export / import UI ----

let flash = null;   // one-shot status message shown after an import (the view re-renders when state changes)
const flashNode = () => {
  const m = flash; flash = null;
  return m ? h('div.flash' + (m.error ? '.error' : ''), { role: 'status' }, m.text) : null;
};

function exportMenu(starred, data, download) {
  const stamp = new Date().toISOString().slice(0, 10);
  const items = [
    ['Markdown (.md)', 'Readable summary with your notes', () => download(`venue-radar-plan-${stamp}.md`, toMarkdown(starred, getNote), 'text/markdown')],
    ['CSV (.csv)', 'One row per submission cycle, for Excel / Sheets', () => download(`venue-radar-plan-${stamp}.csv`, toCsv(planRows(starred, getNote)), 'text/csv')],
    ['Calendar (.ics)', 'Deadlines, decisions and conferences', () => download(`venue-radar-plan-${stamp}.ics`, buildIcs(data.venues.map((v) => ({ ...v, editions: v.editions.filter((e) => isStarred(e.id)) })).filter((v) => v.editions.length), new Date().toISOString(), 'My publication plan'), 'text/calendar')],
    ['Backup (.json)', 'Everything, incl. notes. Re-importable', () => download(`venue-radar-backup-${stamp}.json`, toBackupJson(starred, state), 'application/json')],
  ];
  const menu = h('details.menu', h('summary.btn', 'Export ▾'),
    h('div.menu-list', items.map(([label, hint, run]) =>
      h('button', { onclick: () => { run(); menu.open = false; } }, h('strong', label), h('span.muted.small', hint)))));
  return menu;
}

function importControl(data) {
  const input = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, 'aria-hidden': 'true' });
  input.addEventListener('change', async () => {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    try {
      const imported = parseBackup(await file.text(), data.editions.map((e) => e.id));
      const merged = mergeBackup(state, imported);
      const bits = [`${merged.addedStars} venue${merged.addedStars === 1 ? '' : 's'} added`, `${merged.addedNotes} note${merged.addedNotes === 1 ? '' : 's'} added`];
      if (merged.keptNotes) bits.push(`${merged.keptNotes} existing note${merged.keptNotes === 1 ? '' : 's'} kept (yours won)`);
      if (imported.ignored) bits.push(`${imported.ignored} entr${imported.ignored === 1 ? 'y' : 'ies'} skipped (venue no longer tracked)`);
      flash = { text: `Backup imported: ${bits.join(' · ')}.` };
      update({ stars: merged.stars, notes: merged.notes });
    } catch (err) {
      flash = { text: err.message, error: true };
      update({});
    }
  });
  return h('span', h('button.btn', { onclick: () => input.click(), title: 'Restore stars and notes from a Venue Radar backup (.json)' }, 'Import backup'), input);
}
