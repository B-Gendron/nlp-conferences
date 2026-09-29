# Third-party notices

Venue Radar itself is licensed under the GNU Affero General Public License v3.0 or later (see `LICENSE`).
It builds on the following third-party material.

## Conference data: ccfddl/ccf-deadlines

Submission deadlines, conference dates, places and CORE/CCF ranks in `site/data/conferences.json` and
`site/calendar.ics` are derived from <https://github.com/ccfddl/ccf-deadlines>, which is distributed under the MIT License:

```
MIT License

Copyright (c) 2021 CCFDDL

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Hand-curated entries in `data/venues.yml` and `data/overrides.yml` are original to this project.

## Development dependency: js-yaml

`js-yaml` (MIT License, © Vitaly Puzrin) is used by the sync script at build time only. It is not shipped to the browser.

## CORE and CCF rankings

The ranks displayed are those carried by the upstream dataset. CORE (<https://portal.core.edu.au/conf-ranks/>) and CCF
are the property of their respective owners.
