# Springboard Development Workflow

How engineers work with `PHD-Nigeria/springboard`. This document is for
code changes — see `docs/team-workflow.md` for how the editorial team uses
the Admin CMS day to day, which never requires any of this.

**The rule this whole document exists to enforce:** content lives in the
Admin. Code lives in Git/VS Code. The two never mix — an editorial change
should never require a code deploy, and a code change should never touch
production data directly.

## The pipeline

```
GitHub (PHD-Nigeria/springboard, main)
      │
      ▼
Feature branch
      │
      ▼
VS Code — local development
      │
      ▼
lint → typecheck → build
      │
      ▼
Pull Request
      │
      ▼
Review
      │
      ▼
Merge to main
      │
      ▼
Deployment (Vercel)
```

`main` is never edited directly. Every change — however small — goes
through a branch and a PR.

## Getting set up

```bash
git clone https://github.com/PHD-Nigeria/springboard.git
cd springboard
code .                      # open in VS Code
npm install
```

Copy `.env.local.example` to `.env.local` and fill in **local** Supabase
values (from `supabase start`, or a personal Supabase project — never
production credentials on a local machine). See the environment matrix in
the Phase 4E/4F production-readiness reports for exactly which variables
exist and what each environment needs.

## Day to day

```bash
git pull                              # sync main before branching
git checkout -b feature/homepage-config
# ...make changes in VS Code...
npm run lint
npm run typecheck
npm run build
git add <specific files>              # never `git add -A` — review what's staged
git commit -m "Add homepage featured-story configuration"
git push -u origin feature/homepage-config
gh pr create                          # or open the PR on github.com
```

### Branch naming

| Prefix | For |
|---|---|
| `feature/*` | New capability — e.g. `feature/homepage-config` |
| `fix/*` | Bug fix — e.g. `fix/timezone-offset-scheduling` |
| `chore/*` | Maintenance, dependencies, config — e.g. `chore/upgrade-nextjs` |
| `docs/*` | Documentation only — e.g. `docs/team-workflow` |

### Before opening a PR

All three must pass locally — this is what CI will also check:

```bash
npm run lint
npm run typecheck
npm run build
```

If the change touches the database schema, include the new migration file
in `supabase/migrations/` (never hand-edit an already-merged migration —
add a new one, exactly as every migration in this repo's history does).

### Review and merge

A PR needs review before merging — no direct pushes to `main`, no
self-merging as a matter of habit even when technically possible. Once
approved, merge (don't force-push over review history).

## Secrets — never in the repository

- No GitHub personal access tokens in source files, ever.
- No Supabase keys, `CRON_SECRET`, or any credential committed — `.env.local`
  is git-ignored; `.env.local.example` documents variable *names* only,
  never real values.
- Vercel/GitHub authentication happens through each tool's own login flow
  (`gh auth login`, Vercel's dashboard), never a token pasted into a file.

## Staging environment

```
DEVELOPMENT (your machine, local Supabase)
        │
        ▼
STAGING (staging Supabase project, staging Vercel deployment)
        │
        ▼
PRODUCTION (production Supabase project, production Vercel deployment)
```

Production must stay isolated — development should never run directly
against live PHD data, and a broken staging deploy should never be able to
touch production's database.

**Current status: staging does not exist yet.** Every phase of this
project so far has developed against a local-only Supabase stack
(`supabase start`, Docker). To stand up staging:

1. Create a second Supabase project (separate from whatever becomes
   production) — same migrations applied via `supabase db push`, seeded
   with non-real placeholder content, never real PHD data.
2. Create a second Vercel project (or a Preview deployment pattern) pointed
   at a `staging` branch, or configure Vercel's branch-based Preview
   deployments against feature branches with staging's environment
   variables.
3. Give the staging Supabase project's URL/anon key/service-role key their
   own set of Vercel environment variables, scoped to Preview/staging only
   — never reused from production, never reused from local.

Until staging exists, feature branches should be verified against a local
Supabase stack before merging, and any database migration should be
reviewed carefully in the PR itself — it's the closest thing to a staging
gate that currently exists.
