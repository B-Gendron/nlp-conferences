# Venue Radar — deadlines & decisions for NLP/LLM and Semantic Web/KE venues

A research-planning tool for people working between **language models** and **knowledge graphs / semantic web / knowledge engineering** (e.g. neurosymbolic research). It tracks submission deadlines, **notification-of-acceptance dates** and conference schedules, and helps you build a publication strategy: what to submit where, when you'll hear back, and where to resubmit if the answer is no.

## What it does

- **Timeline** — one row per venue: submission → decision windows, deadline markers, conference span, "today" line. 6–24 month zoom.
- **Deadlines** — what you can still submit to, soonest first, with countdowns.
- **My plan** — star venues to get a chronological agenda, deadline-crunch warnings, and a *"if the decision goes the wrong way"* panel listing the deadlines that open right after each expected decision. Shareable by link, exportable to `.ics`.
- Filters by domain (NLP & LLMs · Semantic Web & KE · ML & AI · IR & Web), a *neurosymbolic-friendly* flag, CORE rank, and free-text search (`/` to focus).
- Times shown in your local timezone or AoE; light/dark theme; works on phones.
- **Calendar feed** (`calendar.ics`) you can subscribe to in Google/Apple Calendar; **"What changed"** log of moved/announced deadlines after every sync.

## How the data works (no more Google Sheet)

Data lives in the repo as versioned text, in two layers:

| Layer | Where | Updated |
|---|---|---|
| **Upstream** — ~30 venues, CORE/CCF ranks, places, deadlines | [`ccfddl/ccf-deadlines`](https://github.com/ccfddl/ccf-deadlines) (community-maintained, MIT) | automatically, weekly |
| **Yours** — which venues to track, niche venues, notification dates | `data/venues.yml`, `data/overrides.yml` | by you (a normal git commit / PR) |

Upstream has essentially **no notification dates**, so this tool takes them from you:

- Real decision dates go in `data/overrides.yml` (see the examples in that file). They always win.
- Until then, venues with a `review_days` value in `venues.yml` show an **estimated** decision date (dashed in the UI, badge "Decision ≈"). Venues without one show "Decision: unknown" rather than a guess.
- Venues not covered upstream (ESWC, EKAW, NeSy, TALN, EGC, …) are *manual* venues: list their editions directly in `data/venues.yml`.

`npm run sync` merges everything into `site/data/conferences.json`, `site/data/changelog.json` and `site/calendar.ics`. If upstream is unreachable it keeps the last good data for that venue.

## Run it

Requires Node ≥ 20.

```bash
npm install
npm run sync     # refresh data from upstream (add --offline to reuse the cache)
npm run serve    # http://localhost:8080
npm test         # unit tests for timezone/date parsing, overrides, diffing, ICS
```

The site is plain static files (`site/`, vanilla ES modules, no build step, no dependencies).

## Deploy (free, auto-updating)

1. Push to GitHub, then *Settings → Pages → Source: GitHub Actions*.
2. `.github/workflows/sync-and-deploy.yml` runs weekly (Tuesdays 14:00 UTC, or on demand / on every push): tests → sync → commit refreshed data → publish `site/`.

## Deep links

`#view=plan&stars=emnlp26,iclr27` opens a shared plan · `#edition=ecir27` opens a venue · `#theme=dark`.

## Caveats

- Dates are only as good as the community source and your overrides. **Always confirm on the official call for papers.**
- ACL-family venues use ACL Rolling Review; their ARR cycles and commitment deadlines appear as separate cycles. Decision dates for those are not estimated (no reliable single review time).
- The CORE rank shown is whatever upstream currently carries (originally this project used CORE2023).

## Migrating from the old version

The Python + Plotly scripts and the Google-Sheet pickle were removed (they remain in git history). The typical review durations from your 2024 sheet were carried over as `review_days` where they still make sense.
