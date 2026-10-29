# Stage 2 checks

These scripts are standalone. They are not part of the app build or CI, and they need no credentials.

| Script | What it checks | Run |
|---|---|---|
| `validate-edition-sql.mjs` | Applies all `supabase/migrations/*.sql`, then the proposed `M1`, audit and `M3` SQL, to an in-memory Postgres (PGlite) using fictional fixtures. | From the repo root: `npm i --no-save @electric-sql/pglite@0.2.17 && node docs/redesign/checks/validate-edition-sql.mjs` |
| `verify-prototype.cjs` | Playwright + axe-core checks of `../prototype/springboard-motion-prototype.html`: seamless loop, keyboard nav, reduced motion, overflow, CLS and a11y. | Wrap the prototype in an HTML skeleton as `test.html` next to the script, install `playwright` and `axe-core@4.10.2`, then `node verify-prototype.cjs`. |

Neither script contacts a hosted database or production.
