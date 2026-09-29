// Timeline (Gantt) view: one row per edition; submission → notification windows, deadline markers, conference span.

import { h, DAY, LOCALE, fmtDate, fmtRange, fmtDateTime, relative, rankClass } from './util.js';
import { state, matches, hasDates, sortKey, matchesVenue, isStarred, toggleStar } from './model.js';

const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

export function renderTimeline(root, data, { openDetail, tip }) {
  const now = Date.now();
  const start = startOfDay(now - 21 * DAY);
  const end = start + state.months * 30.4375 * DAY;
  const span = end - start;
  const x = (t) => ((t - start) / span) * 100;
  const clampPct = (v) => Math.max(0, Math.min(100, v));
  const inWin = (t) => t != null && t >= start && t <= end;

  const eds = data.editions.filter((ed) => matches(ed, now));
  const withDates = eds.filter(hasDates);

  const visible = [];
  for (const ed of withDates) {
    const dlOn = state.layers.deadlines, cfOn = state.layers.conference;
    const pts = [];
    if (dlOn) ed.cycles.forEach((c) => pts.push(c.ab, c.dl, c.nt));
    const overlap = (a, b) => a != null && (b ?? a) >= start && a <= end;
    const hit = pts.some((t) => inWin(t)) ||
      (dlOn && ed.cycles.some((c) => c.dl && c.nt && overlap(c.dl, c.nt))) ||
      (cfOn && ed.confStart && overlap(ed.confStart, ed.confEnd));
    if (hit) visible.push(ed);
  }
  visible.sort((a, b) => sortKey(a, now) - sortKey(b, now));

  root.replaceChildren();
  if (!visible.length) {
    root.append(h('div.empty', h('h3', 'Nothing in this window'),
      h('p', 'Try a longer time range, show closed venues, or clear some filters.')));
  } else {
    root.append(buildGrid(visible));
  }
  root.append(buildUnscheduled(eds, withDates, data, visible));

  // ---------------------------------------------------------------- grid ----
  function buildGrid(rows) {
    const axis = h('div.tl-axis');
    const grid = h('div.tl-lines');
    const cursor = new Date(start);
    cursor.setDate(1); cursor.setHours(0, 0, 0, 0);
    if (cursor.getTime() < start) cursor.setMonth(cursor.getMonth() + 1);
    const long = state.months <= 12;
    for (let i = 0; cursor.getTime() < end && i < 60; i++, cursor.setMonth(cursor.getMonth() + 1)) {
      const left = x(cursor.getTime());
      const jan = cursor.getMonth() === 0;
      const label = cursor.toLocaleString(LOCALE, { month: long ? 'short' : 'narrow' }) + (jan || i === 0 ? ` ’${String(cursor.getFullYear()).slice(2)}` : '');
      axis.append(h('span.tl-tick' + (jan ? '.year' : ''), { style: { left: left + '%' } }, label));
      grid.append(h('i' + (jan ? '.year' : ''), { style: { left: left + '%' } }));
    }
    if (now >= start && now <= end) {
      grid.append(h('b.today', { style: { left: x(now) + '%' }, 'data-label': 'Today' }));
    }

    const body = h('div.tl-body', ...rows.map(row));
    const inner = h('div.tl-inner',
      h('div.tl-head', h('div.tl-corner', `${rows.length} venue${rows.length > 1 ? 's' : ''}`), axis),
      body,
      h('div.tl-overlay', grid));
    return h('div.tl', inner);
  }

  function row(ed) {
    const star = h('button.star' + (isStarred(ed.id) ? '.on' : ''), {
      title: isStarred(ed.id) ? 'Remove from my plan' : 'Add to my plan',
      'aria-pressed': String(isStarred(ed.id)),
      onclick: (ev) => { ev.stopPropagation(); toggleStar(ed.id); },
    }, isStarred(ed.id) ? '★' : '☆');
    const label = h('div.tl-label', star,
      h('button.name', { onclick: () => openDetail(ed) },
        h('span.acr', ed.v.acronym), h('span.yr', ed.e.year)),
      h('span.pill.' + rankClass(ed.rank), ed.rank === '—' ? '' : ed.rank));
    const track = h('div.tl-track');
    const cls = rankClass(ed.rank);

    if (state.layers.conference && ed.confStart) {
      const a = x(ed.confStart), b = x(ed.confEnd ?? ed.confStart + DAY);
      if (b >= 0 && a <= 100) {
        const bar = h('div.bar.conf.' + cls + (a < 0 ? '.clip-l' : '') + (b > 100 ? '.clip-r' : ''), {
          style: { left: clampPct(a) + '%', width: `max(6px, ${clampPct(b) - clampPct(a)}%)` },
          onclick: () => openDetail(ed),
        });
        tip.attach(bar, () => tipNode(ed, 'Conference', fmtRange(ed.e.start, ed.e.end), ed.e.place));
        track.append(bar);
      }
    }

    if (state.layers.deadlines) {
      for (const c of ed.cycles) {
        if (c.dl && c.nt && c.nt > c.dl) {
          const a = x(c.dl), b = x(c.nt);
          if (b >= 0 && a <= 100) {
            const bar = h('div.bar.review.' + cls + (c.notificationEstimated ? '.est' : '') + (a < 0 ? '.clip-l' : '') + (b > 100 ? '.clip-r' : ''), {
              style: { left: clampPct(a) + '%', width: (clampPct(b) - clampPct(a)) + '%' },
              onclick: () => openDetail(ed),
            });
            tip.attach(bar, () => cycleTip(ed, c));
            track.append(bar);
          }
        }
        marker(track, ed, c, c.ab, 'ab', 'Abstract due');
        marker(track, ed, c, c.dl, 'dl', 'Submission deadline');
        marker(track, ed, c, c.nt, 'nt' + (c.notificationEstimated ? ' est' : ''), c.notificationEstimated ? 'Notification (estimated)' : 'Notification');
      }
    }
    return h('div.tl-row' + (isStarred(ed.id) ? '.starred' : ''), label, track);
  }

  function marker(track, ed, c, t, kind, what) {
    if (!inWin(t)) return;
    const el = h('i.mk.' + kind.split(' ').join('.'), { style: { left: x(t) + '%' }, onclick: () => openDetail(ed) });
    tip.attach(el, () => tipNode(ed, what, fmtDateTime(t), c.label, relative(new Date(t).toISOString(), now)));
    track.append(el);
  }
}

function tipNode(ed, what, when, extra, rel) {
  return h('div',
    h('strong', `${ed.v.acronym} ${ed.e.year}`),
    h('div.tip-what', what),
    h('div.tip-when', when, rel ? h('span.muted', ` · ${rel}`) : null),
    extra ? h('div.muted', extra) : null);
}

function cycleTip(ed, c) {
  const iso = (t) => new Date(t).toISOString();
  return h('div',
    h('strong', `${ed.v.acronym} ${ed.e.year}`),
    c.label ? h('div.muted', c.label) : null,
    h('div', 'Submit: ', h('b', fmtDate(iso(c.dl)))),
    h('div', c.notificationEstimated ? 'Decision date (est.): ' : 'Decision date: ', h('b', fmtDate(iso(c.nt)))),
    c.notificationEstimated ? h('div.muted', `Based on this venue's typical review time – not confirmed.`) : null);
}

function buildUnscheduled(eds, withDates, data, visible) {
  const vis = new Set(visible.map((e) => e.id));
  const undated = eds.filter((e) => !hasDates(e));
  const noEdition = data.venues.filter((v) => !v.editions.length && matchesVenue(v));
  const outside = withDates.filter((e) => !vis.has(e.id));
  if (!undated.length && !noEdition.length && !outside.length) return h('div');
  const chip = (label, href, title) => h('a.chip', { href: href || '#', target: '_blank', rel: 'noopener', title }, label);
  return h('section.unscheduled',
    undated.length ? h('div', h('h3', 'Edition announced, dates still TBD'),
      h('div.chips', undated.map((e) => chip(`${e.v.acronym} ${e.e.year}`, e.e.link, e.e.place || 'Dates not yet published')))) : null,
    noEdition.length ? h('div', h('h3', 'Tracked – no upcoming edition on record'),
      h('p.muted', 'Add editions in data/venues.yml once their call for papers is out.'),
      h('div.chips', noEdition.map((v) => chip(v.acronym, v.url, v.name)))) : null,
    outside.length ? h('p.muted', `${outside.length} more edition${outside.length > 1 ? 's are' : ' is'} dated outside this window – widen the range to see ${outside.length > 1 ? 'them' : 'it'}.`) : null);
}
