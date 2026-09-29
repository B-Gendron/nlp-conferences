#!/usr/bin/env node
// Build site/data/conferences.json (+ calendar.ics, changelog.json) from
//   data/venues.yml       – which venues to track (+ manual editions)
//   data/overrides.yml    – hand-curated fixes / notification dates
//   ccfddl/ccf-deadlines  – community-maintained upstream dataset (fetched over HTTPS)
//
// Usage: node scripts/sync.mjs [--offline]   (offline = reuse the previous upstream snapshot in .cache/)

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import {
  parseDateRange, normalizeCycle, applyOverride, estimateNotifications,
  diffDatasets, buildIcs, toUtcIso,
} from './lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'site');
const CACHE = path.join(ROOT, '.cache');
const RAW = 'https://raw.githubusercontent.com/ccfddl/ccf-deadlines/main/conference';
const OFFLINE = process.argv.includes('--offline');
const KEEP_CHANGES = 200;

const readYaml = async (f) => yaml.load(await readFile(path.join(ROOT, f), 'utf8'));
const readJson = async (f) => (existsSync(f) ? JSON.parse(await readFile(f, 'utf8')) : null);

async function fetchUpstream(up) {
  const cacheFile = path.join(CACHE, `${up.replace('/', '__')}.yml`);
  if (!OFFLINE) {
    try {
      const res = await fetch(`${RAW}/${up}.yml`, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      await mkdir(CACHE, { recursive: true });
      await writeFile(cacheFile, text);
      return yaml.load(text);
    } catch (err) {
      console.warn(`  ! ${up}: ${err.message}${existsSync(cacheFile) ? ' (using cache)' : ''}`);
    }
  }
  return existsSync(cacheFile) ? yaml.load(await readFile(cacheFile, 'utf8')) : null;
}

function upstreamEdition(raw) {
  const tz = raw.timezone || 'AoE';
  const range = parseDateRange(raw.date, raw.year);
  return {
    id: raw.id,
    year: raw.year,
    link: raw.link || null,
    place: raw.place && raw.place !== 'TBD' ? raw.place : null,
    dateText: raw.date || null,
    start: range?.start ?? null,
    end: range?.end ?? null,
    tz,
    cycles: (raw.timeline || []).map((t) => normalizeCycle(t, tz)),
  };
}

function manualEdition(venue, raw) {
  const tz = raw.tz || 'AoE';
  const day = (d) => (d ? (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10) : null);
  return {
    id: raw.id || `${venue.id}-${raw.year}`,
    year: raw.year,
    link: raw.link || venue.url || null,
    place: raw.place || null,
    dateText: raw.dateText || null,
    start: day(raw.start),
    end: day(raw.end),
    tz,
    cycles: (raw.cycles || []).map((c) => {
      const deadline = toUtcIso(c.deadline, tz);
      const notification = toUtcIso(c.notification, tz);
      return {
        label: c.label || '',
        abstract: toUtcIso(c.abstract, tz),
        deadline,
        notification,
        ...(notification ? { notificationSource: 'manual' } : {}),
        tbd: deadline == null,
      };
    }),
    manual: true,
  };
}

/** Keep editions that are still relevant: not finished more than ~6 months ago. */
function isRelevant(ed, nowMs) {
  const horizon = nowMs - 183 * 86400000;
  const dates = [ed.end, ...ed.cycles.flatMap((c) => [c.deadline, c.notification])].filter(Boolean).map(Date.parse);
  if (!dates.length) return ed.year >= new Date(nowMs).getUTCFullYear();
  return Math.max(...dates) >= horizon;
}

async function main() {
  const now = new Date();
  const nowMs = now.getTime();
  const venuesCfg = await readYaml('data/venues.yml');
  const overrides = (await readYaml('data/overrides.yml')) || {};
  const previous = await readJson(path.join(OUT, 'data/conferences.json'));
  const prevByVenue = new Map((previous?.venues || []).map((v) => [v.id, v]));
  const unusedOverrides = new Set(Object.keys(overrides));

  console.log(`Syncing ${venuesCfg.length} venues${OFFLINE ? ' (offline)' : ''}…`);
  const venues = [];
  await Promise.all(venuesCfg.map(async (cfg, i) => {
    let venue;
    if (cfg.upstream) {
      const data = await fetchUpstream(cfg.upstream);
      const conf = Array.isArray(data) ? data[0] : null;
      if (!conf) {
        const old = prevByVenue.get(cfg.id);
        if (old) { console.warn(`  ! ${cfg.id}: keeping previous data`); venues[i] = { ...old, stale: true }; }
        else console.warn(`  ! ${cfg.id}: no data available, skipped`);
        return;
      }
      venue = {
        id: cfg.id,
        acronym: cfg.acronym || conf.title,
        name: cfg.name || conf.description || conf.title,
        domains: cfg.domains || [],
        neurosym: !!cfg.neurosym,
        core: conf.rank?.core && conf.rank.core !== 'N' ? conf.rank.core : null,
        ccf: conf.rank?.ccf && conf.rank.ccf !== 'N' ? conf.rank.ccf : null,
        dblp: conf.dblp || null,
        url: cfg.url || null,
        source: 'ccf-deadlines',
        editions: (conf.confs || []).map(upstreamEdition),
      };
    } else {
      venue = {
        id: cfg.id,
        acronym: cfg.acronym || cfg.id.toUpperCase(),
        name: cfg.name || cfg.acronym,
        domains: cfg.domains || [],
        neurosym: !!cfg.neurosym,
        core: cfg.core || null,
        ccf: null,
        dblp: null,
        url: cfg.url || null,
        source: 'manual',
        editions: (cfg.editions || []).map((e) => manualEdition(cfg, e)),
      };
    }
    venue.editions = venue.editions
      .map((e) => {
        if (overrides[e.id]) unusedOverrides.delete(e.id);
        return applyOverride(e, overrides[e.id]);
      })
      .map((e) => estimateNotifications(e, cfg.review_days))
      .filter((e) => isRelevant(e, nowMs))
      .sort((a, b) => a.year - b.year);
    // Real per-cycle notification dates are always flagged so the UI can tell them apart from estimates.
    for (const e of venue.editions) for (const c of e.cycles) {
      if (c.notification && !c.notificationEstimated) c.notificationSource ??= 'source';
      c.notificationEstimated = !!c.notificationEstimated;
    }
    venues[i] = venue;
  }));

  const final = venues.filter(Boolean);
  const generatedAt = now.toISOString();
  const dataset = {
    generatedAt,
    sources: [
      { name: 'ccfddl/ccf-deadlines', url: 'https://github.com/ccfddl/ccf-deadlines', license: 'MIT' },
      { name: 'Manual entries', url: 'data/overrides.yml' },
    ],
    venues: final,
  };

  await mkdir(path.join(OUT, 'data'), { recursive: true });
  const changes = previous ? diffDatasets(previous, dataset, generatedAt) : [];
  const prevLog = (await readJson(path.join(OUT, 'data/changelog.json'))) || [];
  const log = [...changes, ...prevLog].slice(0, KEEP_CHANGES);

  await writeFile(path.join(OUT, 'data/conferences.json'), JSON.stringify(dataset));
  await writeFile(path.join(OUT, 'data/changelog.json'), JSON.stringify(log));
  await writeFile(path.join(OUT, 'calendar.ics'), buildIcs(final, generatedAt));

  const eds = final.flatMap((v) => v.editions);
  const cycles = eds.flatMap((e) => e.cycles);
  console.log(`✓ ${final.length} venues, ${eds.length} editions, ${cycles.filter((c) => c.deadline).length} dated deadlines, ` +
    `${cycles.filter((c) => c.notification && !c.notificationEstimated).length} confirmed / ` +
    `${cycles.filter((c) => c.notificationEstimated).length} estimated notifications, ${changes.length} changes.`);
  for (const id of unusedOverrides) console.warn(`  ! override "${id}" matches no edition (typo, or edition dropped as too old?)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
