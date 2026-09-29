// "My plan": the starred venues as an agenda, with crunch warnings and "if rejected, where next?" fallbacks.

import { h, DAY, fmtWeekday, fmtDay, fmtMonth, fmtDate, fmtRange, relative, rankClass } from './util.js';
import { matches, milestones, isStarred, toggleStar, shareUrl } from './model.js';
import { buildIcs } from './ics.js';

const ICON = { abstract: '◇', deadline: '◆', notification: '●', conference: '▬' };
const NAME = { abstract: 'Abstract due', deadline: 'Submission deadline', notification: 'Decision', conference: 'Conference' };

export function renderPlan(root, data, { openDetail, download }) {
  const now = Date.now();
  const starred = data.editions.filter((e) => isStarred(e.id));
  root.replaceChildren();

  if (!starred.length) {
    root.append(h('div.empty',
      h('h3', 'Build your publication strategy'),
      h('p', 'Star the venues you’re considering (☆ in the timeline or deadlines view). This page then lays out your year, flags deadline crunches, and shows where you could resubmit if a decision goes the wrong way.')));
    return;
  }

  // Chronological across all starred venues; drop anything that ended more than two weeks ago.
  const events = starred.flatMap(milestones).filter((m) => (m.end ?? m.t) >= now - 14 * DAY).sort((a, b) => a.t - b.t);

  // ---- header / export
  root.append(h('div.plan-head',
    h('p.muted', `${starred.length} venue${starred.length > 1 ? 's' : ''} in your plan.`),
    h('div.row-actions', h('button.btn', {
      onclick: (ev) => {
        navigator.clipboard?.writeText(shareUrl()).then(() => { ev.target.textContent = 'Link copied ✓'; setTimeout(() => { ev.target.textContent = 'Copy share link'; }, 1800); });
      },
    }, 'Copy share link'), h('button.btn', {
      onclick: () => download('my-plan.ics', buildIcs(data.venues.map((v) => ({ ...v, editions: v.editions.filter((e) => isStarred(e.id)) })).filter((v) => v.editions.length), new Date().toISOString(), 'My publication plan'), 'text/calendar'),
    }, 'Export plan (.ics)'))));

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
        h('span.muted', ` – decision ${c.notificationEstimated ? '≈ ' : ''}${fmtDate(nIso)}`)),
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
