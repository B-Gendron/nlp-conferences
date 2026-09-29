// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Barbara Gendron
// Small shared helpers: DOM builder, date formatting, ranks, domains.

export const DAY = 86400000;
export const LOCALE = 'en-GB';   // the UI is English-only, whatever the browser language

/** Tiny hyperscript: h('div.card', {onclick}, child, 'text'). Never uses innerHTML, so upstream text can't inject markup. */
export function h(tag, attrs, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
    children.unshift(attrs);
    attrs = null;
  }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const DOMAINS = {
  nlp: { label: 'NLP & LLMs', short: 'NLP' },
  kg: { label: 'Semantic Web & KE', short: 'KG' },
  ml: { label: 'ML & AI', short: 'ML' },
  ir: { label: 'IR & Web', short: 'IR' },
};

export const RANKS = ['A*', 'A', 'B', 'C', '—'];
export const rankOf = (v) => (v.core && RANKS.includes(v.core) ? v.core : '—');
export const rankClass = (r) => ({ 'A*': 'rs', A: 'ra', B: 'rb', C: 'rc' }[r] || 'rn');

export const ms = (iso) => (iso ? Date.parse(iso) : null);

// ------------------------------------------------------------- dates ----

export const tzMode = { value: 'local' }; // 'local' | 'aoe' – toggled from the header
const zone = () => (tzMode.value === 'aoe' ? 'Etc/GMT+12' : undefined);

const fmtCache = new Map();
function fmt(key, opts) {
  const k = key + tzMode.value;
  if (!fmtCache.has(k)) fmtCache.set(k, new Intl.DateTimeFormat(LOCALE, { ...opts, timeZone: zone() }));
  return fmtCache.get(k);
}

export const fmtDate = (iso) => fmt('d', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
export const fmtDay = (iso) => fmt('dm', { day: 'numeric', month: 'short' }).format(new Date(iso));
export const fmtWeekday = (iso) => fmt('wd', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso));
export const fmtDateTime = (iso) =>
  fmt('dt', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(new Date(iso));
export const fmtMonth = (iso) => fmt('m', { month: 'long', year: 'numeric' }).format(new Date(iso));

/** Conference days are calendar dates (no timezone) – format them as such. */
export function fmtRange(start, end) {
  if (!start) return null;
  const f = (d, o) => new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', ...o }).format(new Date(d));
  const [s, e] = [start, end || start];
  if (s === e) return f(s, { day: 'numeric', month: 'short', year: 'numeric' });
  if (s.slice(0, 7) === e.slice(0, 7)) return `${f(s, { day: 'numeric' })}–${f(e, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  return `${f(s, { day: 'numeric', month: 'short' })} – ${f(e, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
export function relative(iso, now = Date.now()) {
  const d = Date.parse(iso) - now;
  const days = Math.round(d / DAY);
  if (Math.abs(d) < 3600000 * 36 && Math.abs(days) <= 1) {
    const hrs = Math.round(d / 3600000);
    return Math.abs(hrs) < 1 ? 'now' : rtf.format(hrs, 'hour');
  }
  if (Math.abs(days) < 60) return rtf.format(days, 'day');
  return rtf.format(Math.round(days / 30.4), 'month');
}

/** 'urgent' (<7d), 'soon' (<30d), 'later', or 'past'. */
export function urgency(iso, now = Date.now()) {
  const d = Date.parse(iso) - now;
  return d < 0 ? 'past' : d < 7 * DAY ? 'urgent' : d < 30 * DAY ? 'soon' : 'later';
}

export const conferenceDayMs = (d) => (d ? Date.parse(d + 'T00:00:00Z') : null);

/** Original timezone label as a hint, e.g. "23:59 AoE". */
export function originalTime(iso, tz) {
  const m = /^AoE$/i.test(tz) ? -12 : /^UTC([+-]\d+)?$/i.exec(tz || '') ? Number((/^UTC([+-]\d+)?$/i.exec(tz)[1]) || 0) : null;
  if (m == null) return tz || '';
  const d = new Date(Date.parse(iso) + m * 3600000);
  return `${d.toISOString().slice(11, 16)} ${tz}`;
}

export const debounce = (fn, wait = 120) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), wait); };
};

// Static, trusted SVG markup only (never build these from data).
const ICONS = {
  auto: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
  light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  dark: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
};
export function icon(name) {
  const svg = new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`,
    'image/svg+xml').documentElement;
  return document.importNode(svg, true);
}
