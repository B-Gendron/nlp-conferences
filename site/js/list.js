// Deadlines view: what can I still submit to, soonest first – with countdowns and decision dates.

import { h, DAY, fmtWeekday, fmtDateTime, fmtDate, fmtRange, relative, urgency, rankClass, originalTime, DOMAINS } from './util.js';
import { state, matches, isStarred, toggleStar } from './model.js';

export function decisionBadge(c) {
  if (!c.nt) return h('span.badge.unknown', { title: 'No notification date known yet. Add one in data/overrides.yml' }, 'Decision date: unknown');
  const iso = new Date(c.nt).toISOString();
  return h('span.badge' + (c.notificationEstimated ? '.est' : '.ok'),
    { title: c.notificationEstimated ? "Estimated from this venue's typical review time" : 'Announced by the venue' },
    (c.notificationEstimated ? 'Decision date ≈ ' : 'Decision date: ') + fmtDate(iso));
}

export function renderList(root, data, { openDetail }) {
  const now = Date.now();
  const rows = [];
  for (const ed of data.editions) {
    if (!matches(ed, now)) continue;
    for (const c of ed.cycles) {
      if (!c.dl && !c.tbd) continue;
      if (c.dl && c.dl < now && state.hideClosed) continue;
      rows.push({ ed, c });
    }
  }
  const dated = rows.filter((r) => r.c.dl).sort((a, b) => (a.c.dl >= now) === (b.c.dl >= now) ? (a.c.dl >= now ? a.c.dl - b.c.dl : b.c.dl - a.c.dl) : (a.c.dl >= now ? -1 : 1));
  const tbd = rows.filter((r) => !r.c.dl);

  const buckets = [
    ['This week', (r) => r.c.dl >= now && r.c.dl < now + 7 * DAY],
    ['Next 30 days', (r) => r.c.dl >= now + 7 * DAY && r.c.dl < now + 30 * DAY],
    ['Next 3 months', (r) => r.c.dl >= now + 30 * DAY && r.c.dl < now + 91 * DAY],
    ['Later', (r) => r.c.dl >= now + 91 * DAY],
    ['Recently closed', (r) => r.c.dl < now],
  ];

  root.replaceChildren();
  let any = false;
  for (const [title, test] of buckets) {
    const part = dated.filter(test);
    if (!part.length) continue;
    any = true;
    root.append(h('section.bucket', h('h3', title, h('span.count', part.length)), h('div.cards', part.map((r) => card(r, now)))));
  }
  if (tbd.length) {
    any = true;
    root.append(h('section.bucket', h('h3', 'Deadline not announced yet', h('span.count', tbd.length)),
      h('div.cards', tbd.map((r) => card(r, now)))));
  }
  if (!any) root.append(h('div.empty', h('h3', 'No deadlines match'), h('p', 'Clear a filter, or turn off “Hide closed”.')));

  function card({ ed, c }, now) {
    const u = c.dl ? urgency(new Date(c.dl).toISOString(), now) : 'tbd';
    const iso = c.dl ? new Date(c.dl).toISOString() : null;
    const star = h('button.star' + (isStarred(ed.id) ? '.on' : ''), {
      title: isStarred(ed.id) ? 'Remove from my plan' : 'Add to my plan', 'aria-pressed': String(isStarred(ed.id)),
      onclick: (ev) => { ev.stopPropagation(); toggleStar(ed.id); },
    }, isStarred(ed.id) ? '★' : '☆');
    return h('article.card.' + u, { tabindex: 0, onclick: () => openDetail(ed), onkeydown: (e) => { if (e.key === 'Enter') openDetail(ed); } },
      h('div.when',
        iso ? [h('div.rel', relative(iso, now)), h('div.abs', fmtWeekday(iso))] : h('div.rel', 'TBD')),
      h('div.main',
        h('div.title', h('strong', ed.v.acronym), ' ', ed.e.year, ' ', h('span.pill.' + rankClass(ed.rank), ed.rank === '—' ? '' : ed.rank),
          c.label ? h('span.cycle', c.label) : null),
        h('div.sub', ed.v.name),
        h('div.meta',
          iso ? h('span', { title: `${fmtDateTime(iso)}${ed.e.tz ? ' · ' + originalTime(iso, ed.e.tz) : ''}` }, fmtDateTime(iso).replace(/,? \d{4}/, '')) : null,
          decisionBadge(c),
          ed.e.start ? h('span.muted', `Conf. ${fmtRange(ed.e.start, ed.e.end)}${ed.e.place ? ' · ' + ed.e.place : ''}`) : null)),
      h('div.side', star, h('div.doms', ed.v.domains.map((d) => h('span.dom', DOMAINS[d]?.short || d)))));
  }
}
