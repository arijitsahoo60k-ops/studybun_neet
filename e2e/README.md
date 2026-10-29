# Group Timer end-to-end checks (headless browser)

Runs the REAL Group Timer UI in headless Chromium against a REAL Postgres (PGlite, in-memory) that has
the project's actual migrations (`migration_group_timer.sql` + `_v2.sql`) with RLS on. Several browser
contexts play several users in one room. A small in-process hub stands in for Supabase Realtime
(presence + broadcast), so Supabase's own realtime quirks are NOT covered — test those on two phones.

```
npm install            # in the repo root, as usual (vite / react are used from there)
cd e2e && npm install  # e2e's own deps; the app's package.json is untouched
node run.mjs           # ~5 min; screenshots land in /tmp/e2e-shots (set SHOTS=... to change)
```
Notes: animated GIFs are stubbed for speed (`REAL_GIFS=1` to load them). The run fails if ANY page logs a
console error/warning, throws, or has a failed request.
