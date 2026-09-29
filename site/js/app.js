// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Barbara Gendron
import { h, icon, LOCALE, DOMAINS, RANKS, rankClass, fmtDate, fmtDateTime, fmtRange, relative, originalTime, tzMode, debounce, DAY } from './util.js';
import { state, update, listeners, loadData, isStarred, toggleStar, matches } from './model.js';
import { renderTimeline } from './timeline.js';
import { renderList, decisionBadge } from './list.js';
import { renderPlan, noteEditor } from './plan.js';
import { buildIcs } from './ics.js';

const $ = (s) => document.querySelector(s);
const main = $('#view');
let data;

// ------------------------------------------------------------ helpers ----

function download(name, content, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const a = h('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const tip = (() => {
  const el = $('#tip');
  const move = (e) => {
    const pad = 14, r = el.getBoundingClientRect();
    el.style.left = Math.min(e.clientX + pad, innerWidth - r.width - 8) + 'px';
    el.style.top = (e.clientY + pad + r.height > innerHeight ? e.clientY - r.height - pad : e.clientY + pad) + 'px';
  };
  return {
    attach(target, build) {
      target.addEventListener('mouseenter', (e) => { el.replaceChildren(build()); el.hidden = false; move(e); });
      target.addEventListener('mousemove', move);
      target.addEventListener('mouseleave', () => { el.hidden = true; });
    },
    hide() { el.hidden = true; },
  };
})();

// ------------------------------------------------------- detail dialog ----

const dlg = $('#detail');
function openDetail(ed) {
  const v = ed.v, e = ed.e;
  const others = v.editions.filter((x) => x.id !== e.id);
  const noteSlot = h('div.note-slot');
  const fillNote = () => noteSlot.replaceChildren(...(isStarred(ed.id) ? [h('h3', 'My notes'), noteEditor(ed)] : []));
  fillNote();
  const body = h('div.detail',
    h('header',
      h('div',
        h('h2', `${v.acronym} ${e.year}`),
        h('p.muted', v.name)),
      h('button.icon', { 'aria-label': 'Close', onclick: () => dlg.close() }, '✕')),
    h('div.facts',
      h('span.pill.big.' + rankClass(ed.rank), ed.rank === '—' ? 'Unranked' : `CORE ${ed.rank}`),
      v.ccf ? h('span.pill.big.rn', `CCF ${v.ccf}`) : null,
      ...v.domains.map((d) => h('span.dom', DOMAINS[d]?.label || d)),
      v.neurosym ? h('span.dom.ns', 'Neurosymbolic-friendly') : null),
    h('dl',
      e.start ? [h('dt', 'Conference'), h('dd', fmtRange(e.start, e.end))] : null,
      e.place ? [h('dt', 'Location'), h('dd', e.place)] : null,
      e.link ? [h('dt', 'Website'), h('dd', h('a', { href: e.link, target: '_blank', rel: 'noopener' }, e.link.replace(/^https?:\/\//, '')))] : null),
    h('h3', 'Submission cycles'),
    e.cycles.length ? h('table.cycles',
      h('thead', h('tr', ['Cycle', 'Abstract', 'Deadline', 'Decision date'].map((t) => h('th', t)))),
      h('tbody', ed.cycles.map((c) => h('tr',
        h('td', c.label || '—'),
        h('td', c.abstract ? fmtDate(c.abstract) : '—'),
        h('td', c.deadline ? [h('div', fmtDateTime(c.deadline)), h('div.muted.small', `${originalTime(c.deadline, e.tz)} · ${relative(c.deadline)}`)] : h('span.muted', 'TBD')),
        h('td', decisionBadge(c)))))) : h('p.muted', 'No submission dates published yet.'),
    others.length ? h('p.muted.small', 'Other editions on record: ', others.map((o) => `${o.year}`).join(', ')) : null,
    noteSlot,
    h('div.actions',
      h('button.btn' + (isStarred(ed.id) ? '.on' : ''), {
        onclick: (ev) => {
          toggleStar(ed.id);
          ev.currentTarget.textContent = isStarred(ed.id) ? '★ In my plan' : '☆ Add to my plan';
          fillNote();
        },
      }, isStarred(ed.id) ? '★ In my plan' : '☆ Add to my plan'),
      h('button.btn', { onclick: () => download(`${ed.id}.ics`, buildIcs([{ ...v, editions: [e] }], new Date().toISOString()), 'text/calendar') }, 'Add to calendar (.ics)'),
      e.link ? h('a.btn.primary', { href: e.link, target: '_blank', rel: 'noopener' }, 'Open call for papers ↗') : null),
    h('p.muted.small', v.source === 'manual' ? 'Source: entered manually.' : 'Source: ccfddl/ccf-deadlines' + (e.overridden ? ' + your overrides.' : '.'),
      ed.cycles.some((c) => c.notificationEstimated) ? ' Estimated decision dates use this venue’s typical review time; add the real one in data/overrides.yml.' : ''));
  dlg.replaceChildren(body);
  tip.hide();
  dlg.showModal();
}
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

// -------------------------------------------------------------- header ----

/** Header button shows the current theme as a pictogram: auto (half disc), light (sun) or dark (moon). */
function themeIcon() {
  const t = document.documentElement.dataset.theme || 'auto';
  const btn = $('#theme');
  btn.replaceChildren(icon(t));
  const next = { auto: 'dark', dark: 'light', light: 'auto' }[t];
  btn.title = `Theme: ${t}. Click for ${next}`;
  btn.setAttribute('aria-label', btn.title);
}

function chip(label, on, onclick, extra = {}) {
  return h('button.chip' + (on ? '.on' : ''), { 'aria-pressed': String(on), onclick, ...extra }, label);
}

function toggleIn(list, v) { return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]; }

function renderControls() {
  const bar = $('#controls');
  const q = $('#q');
  bar.replaceChildren(...[
    h('div.group', h('span.lbl', 'Domain'),
      Object.entries(DOMAINS).map(([k, d]) => chip(d.label, state.domains.includes(k), () => update({ domains: toggleIn(state.domains, k) }))),
      chip('Neurosymbolic-friendly', state.neurosym, () => update({ neurosym: !state.neurosym }), { class: 'chip ns' + (state.neurosym ? ' on' : ''), title: 'Venues that are a natural home for neurosymbolic work' })),
    h('div.group', h('span.lbl', 'CORE rank'),
      RANKS.map((r) => chip(r === '—' ? 'Unranked' : r, state.ranks.includes(r), () => update({ ranks: toggleIn(state.ranks, r) }), { class: 'chip ' + rankClass(r) + (state.ranks.includes(r) ? ' on' : '') }))),
    h('div.group', h('label.check', h('input', { type: 'checkbox', checked: state.hideClosed, onchange: (e) => update({ hideClosed: e.target.checked }) }), 'Hide closed')),
    (state.domains.length || state.ranks.length || state.neurosym || q.value) ?
      h('button.link', { onclick: () => { q.value = ''; update({ domains: [], ranks: [], neurosym: false, q: '' }); } }, 'Reset filters') : null,
  ].filter(Boolean));
}

function renderTabs() {
  const n = state.stars.length;
  const tabs = [['timeline', 'Timeline'], ['list', 'Deadlines'], ['plan', `My plan${n ? ` (${n})` : ''}`]];
  $('#tabs').replaceChildren(...tabs.map(([k, label]) =>
    h('button.tab' + (state.view === k ? '.on' : ''), { role: 'tab', 'aria-selected': String(state.view === k), onclick: () => update({ view: k }) }, label)));
  const tl = state.view === 'timeline';
  $('#tl-opts').hidden = !tl;
  if (tl) {
    $('#tl-opts').replaceChildren(
      h('div.seg', [6, 12, 18, 24].map((m) => h('button' + (state.months === m ? '.on' : ''), { onclick: () => update({ months: m }) }, `${m}mo`))),
      h('label.check', h('input', { type: 'checkbox', checked: state.layers.deadlines, onchange: (e) => update({ layers: { ...state.layers, deadlines: e.target.checked } }) }), h('i.key.review'), 'Submission → decision'),
      h('label.check', h('input', { type: 'checkbox', checked: state.layers.conference, onchange: (e) => update({ layers: { ...state.layers, conference: e.target.checked } }) }), h('i.key.conf'), 'Conference'));
  }
}

function renderMeta() {
  const gen = new Date(data.generatedAt);
  const age = Math.floor((Date.now() - gen) / DAY);
  $('#updated').replaceChildren(
    h('span' + (age > 14 ? '.stale' : ''), { title: gen.toLocaleString(LOCALE) },
      `Data synced ${age <= 0 ? 'today' : age + ' day' + (age > 1 ? 's' : '') + ' ago'}${age > 14 ? ' – may be out of date' : ''}`));
  const ch = data.changes.slice(0, 30);
  const btn = $('#changes-btn');
  btn.textContent = ch.length ? `Latest venue info (${ch.length})` : 'Latest venue info';
  btn.onclick = () => {
    const box = h('div.detail',
      h('header', h('h2', 'Latest venue info'), h('button.icon', { 'aria-label': 'Close', onclick: () => dlg.close() }, '✕')),
      ch.length ? h('ul.changes', ch.map((c) => h('li',
        h('span.muted', new Date(c.at).toLocaleDateString(LOCALE)), ' ',
        h('strong', `${c.venue} ${c.year}`), ' ',
        c.type === 'new-edition' ? 'new edition on record'
          : `${c.field === 'notification' ? 'decision date' : 'deadline'} ${c.type === 'moved' ? `moved ${fmtDate(c.from)} → ${fmtDate(c.to)}` : c.type === 'announced' ? `announced: ${fmtDate(c.to)}` : 'removed'}`,
        c.label ? h('span.muted', ` (${c.label})`) : null)))
        : h('p.muted', 'Nothing has changed since tracking started. Changes appear here after each sync.'));
    dlg.replaceChildren(box); dlg.showModal();
  };
}

// -------------------------------------------------------------- render ----

function render() {
  tzMode.value = state.tz;
  $('#tz').textContent = state.tz === 'aoe' ? 'Time: AoE' : 'Time: local';
  renderControls();
  renderTabs();
  const ctx = { openDetail, tip, download };
  if (state.view === 'list') renderList(main, data, ctx);
  else if (state.view === 'plan') renderPlan(main, data, ctx);
  else renderTimeline(main, data, ctx);
  const n = data.editions.filter((e) => matches(e)).length;
  $('#count').textContent = `${n} edition${n === 1 ? '' : 's'} shown`;
}

async function boot() {
  try {
    data = await loadData();
  } catch (err) {
    main.replaceChildren(h('div.empty', h('h3', 'Could not load data'), h('p', 'Run `npm run sync` and serve the site/ folder over HTTP.'), h('pre', String(err))));
    return;
  }
  const q = $('#q');
  q.value = state.q || '';
  q.addEventListener('input', debounce(() => update({ q: q.value.trim() })));
  $('#tz').addEventListener('click', () => update({ tz: state.tz === 'aoe' ? 'local' : 'aoe' }));
  $('#theme').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme;
    const next = cur === 'dark' ? 'light' : cur === 'light' ? '' : 'dark';
    if (next) document.documentElement.dataset.theme = next; else delete document.documentElement.dataset.theme;
    try { localStorage.setItem('nc.theme', next); } catch { /* ignore */ }
    themeIcon();
  });
  themeIcon();
  window.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== q && !dlg.open) { e.preventDefault(); q.focus(); }
  });
  // close the export dropdown when clicking elsewhere
  document.addEventListener('click', (e) => document.querySelectorAll('details.menu[open]').forEach((m) => { if (!m.contains(e.target)) m.open = false; }));
  listeners.add(render);
  renderMeta();
  render();
  const wanted = new URLSearchParams(location.hash.slice(1)).get('edition');
  const target = wanted && data.editions.find((e) => e.id === wanted);
  if (target) openDetail(target);
}

try {
  const t = new URLSearchParams(location.hash.slice(1)).get('theme') || localStorage.getItem('nc.theme');
  if (t) document.documentElement.dataset.theme = t;
} catch { /* ignore */ }
boot();
