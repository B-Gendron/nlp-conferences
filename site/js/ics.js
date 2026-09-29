// iCalendar generation, shared by the sync script (calendar.ics feed) and the browser (per-edition / plan export).

const DAY = 86400000;

const icsEscape = (s) => String(s).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
const icsStamp = (iso) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsDate = (d) => d.replace(/-/g, '');

function fold(line) {
  const out = [];
  let rest = line;
  while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = ' ' + rest.slice(74); }
  out.push(rest);
  return out.join('\r\n');
}

/** Build an iCalendar feed with one event per deadline / notification / conference. */
export function buildIcs(venues, generatedAt, calName = 'NLP & Semantic Web deadlines') {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//nlp-conferences//EN', 'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${icsEscape(calName)}`];
  const stamp = icsStamp(generatedAt);
  const push = (uid, summary, desc, startIso, endIso, url) => {
    lines.push('BEGIN:VEVENT', `UID:${uid}@nlp-conferences`, `DTSTAMP:${stamp}`,
      `DTSTART:${icsStamp(startIso)}`, `DTEND:${icsStamp(endIso)}`,
      `SUMMARY:${icsEscape(summary)}`, `DESCRIPTION:${icsEscape(desc)}`);
    if (url) lines.push(`URL:${url}`);
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(summary)}`, 'TRIGGER:-P3D', 'END:VALARM', 'END:VEVENT');
  };
  for (const v of venues) for (const e of v.editions) {
    e.cycles.forEach((c, i) => {
      const tag = c.label ? ` (${c.label})` : '';
      if (c.deadline) {
        const end = new Date(Date.parse(c.deadline)).toISOString();
        const start = new Date(Date.parse(c.deadline) - 3600000).toISOString();
        push(`${e.id}-dl-${i}`, `⏰ ${v.acronym} ${e.year} submission deadline${tag}`, `${v.name}\n${e.link || ''}`, start, end, e.link);
      }
      if (c.notification) {
        const start = new Date(Date.parse(c.notification)).toISOString();
        const end = new Date(Date.parse(c.notification) + 3600000).toISOString();
        const est = c.notificationEstimated ? ' [estimated]' : '';
        push(`${e.id}-nt-${i}`, `📬 ${v.acronym} ${e.year} notification${tag}${est}`, `${v.name}\n${e.link || ''}`, start, end, e.link);
      }
    });
    if (e.start && e.end) {
      const nextDay = new Date(Date.parse(e.end) + DAY).toISOString().slice(0, 10);
      lines.push('BEGIN:VEVENT', `UID:${e.id}-conf@nlp-conferences`, `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${icsDate(e.start)}`, `DTEND;VALUE=DATE:${icsDate(nextDay)}`,
        `SUMMARY:${icsEscape(`🎤 ${v.acronym} ${e.year}${e.place ? ' – ' + e.place : ''}`)}`,
        ...(e.link ? [`URL:${e.link}`] : []), 'END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
