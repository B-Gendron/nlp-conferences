# Contributing to Venue Radar

Thanks for helping keep researchers' calendars accurate! The most valuable contributions are **data fixes**, and they need no coding.

## Fix or add a date

All data is plain text in `data/`:

| You want to… | Edit |
|---|---|
| Add a real **notification (decision) date** or correct a deadline | `data/overrides.yml` |
| Track a **new venue** that exists in [ccfddl/ccf-deadlines](https://github.com/ccfddl/ccf-deadlines) | `data/venues.yml` (one line) |
| Add a venue **missing upstream** (ESWC, EKAW, …) | `data/venues.yml` (manual venue with `editions:`) |

Examples for each are in the [README](README.md#adding-or-fixing-data) and in the comments at the top of both files.

Please:

- **Cite the official page** for the date in your pull request description (the call for papers or important-dates page).
- Don't commit generated files (`site/data/*`, `site/calendar.ics`): a bot regenerates them every week and on each push.
- If the *upstream* dataset is wrong, consider fixing it there too so everyone benefits.

## Code changes

```bash
npm install
npm test          # must pass
npm run sync      # regenerate data
npm run serve     # http://localhost:8080
```

- The site is plain HTML/CSS/vanilla ES modules with **no build step and no runtime dependencies**. Please keep it that way.
- Never build DOM from data with `innerHTML`; use the `h()` helper in `site/js/util.js`.
- Add or update tests in `scripts/*.test.mjs` for logic changes (dates, timezones, exports).
- English only in the UI.

## Licensing of contributions

By submitting a contribution you agree to license it under the project's licence, **AGPL-3.0-or-later**.
