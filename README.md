# LifeOS — Personal Productivity, Study & Finance Workspace

[Open LifeOS](https://ukg-gta.github.io/Lifeos/)

LifeOS is a browser-based personal command centre for everyday planning, productivity, study management, and personal finance. It brings tasks, habits, goals, projects, study sessions, notes, reading resources, calendar planning, and finance tracking together in one workspace.

Use LifeOS to organise daily priorities, build consistent routines, manage exam preparation, track progress, and keep personal administration in one place.

## What the app includes

- **Dashboard** — a daily overview of tasks, study progress, and habits.
- **Tasks** — capture and organise work with priorities, dates, and completion status.
- **Habits & routines** — keep recurring activities visible and track consistency.
- **Goals & projects** — organise longer-term outcomes and the projects supporting them.
- **Study** — manage exams, subjects, syllabus items, and study sessions; set a daily study-time target.
- **Focus timer** — run focused work sessions.
- **Notes** — keep personal notes in the workspace.
- **Library** — organise books, articles, research papers, PDFs, and other resources by reading status.
- **Finance** — record transactions, budgets, assets, investments, and liabilities.
- **Calendar** — review dated tasks, study sessions, deadlines, and milestones.
- **Profile & settings** — customise the appearance, accent colour, density, font size, date and clock formats, dashboard summaries, and visible modules.

The appearance setting supports **System**, **Dark**, and **Light**. System follows the device or browser colour-scheme preference; Dark and Light remain explicit choices.

## Data and account

LifeOS uses Supabase for Google authentication and the private, account-scoped workspace. Sign in with the same Google account to access that account's workspace on another device. The app's runtime workspace is cloud-backed; do not treat a browser cache or an exported backup as the authoritative cloud copy.

Use the in-app backup and restore features when you need a separate copy of your data. Keep exported backups private because they may contain personal and financial information.

## Run locally

The frontend is a static web app. Serve the repository root over HTTP using a local static server, then open the local address it provides. An HTTP(S) origin is required for browser features such as service workers and the installable web-app experience.

The automated test suite uses Node.js and the built-in test runner:

```bash
npm test
```

Install the development dependency listed in `package.json` before running the full suite in a fresh checkout:

```bash
npm install
npm test
```

## Repository map

| Path | Purpose |
| --- | --- |
| `index.html` | Main interface and application styles |
| `app.js` and feature modules | Application orchestration and page behaviour |
| `sync-core.js`, `legacy-migration.js` | Workspace synchronisation and legacy-data migration helpers |
| `profile-ui.js` | Profile, appearance, and preference behaviour |
| `sw.js`, `manifest.json`, `icons/` | Progressive Web App files |
| `supabase/` | Database bootstrap and tracked migrations |
| `docs/DEPLOYMENT.md` | Frontend and database deployment cautions |
| `tests/` | Automated regression tests |
| `.github/workflows/` | GitHub Actions checks |
| `vendor/` | Third-party browser library files and their separate notices |

## Supabase and deployment

Read [Supabase setup and deployment](docs/DEPLOYMENT.md) and [the Supabase schema notes](supabase/README.md) before creating or changing a Supabase environment.

**Important:** `supabase/bootstrap.sql` is for a completely new Supabase project only. Do not run it against the existing LifeOS production project. Check the live migration history and follow the documented deployment order before applying database changes. Never put Supabase service-role keys or other privileged secrets in browser-delivered code.

## Security

For security concerns, follow [SECURITY.md](SECURITY.md). Do not publish credentials, private workspace exports, or personal data in public issues.

## Copyright and permissions

Copyright © 2026 LifeOS. All rights reserved.

No project-wide open-source licence is granted. Unless you have separate written permission from the copyright holder, you may not copy, modify, distribute, sublicense, or use this project's original code or assets. Third-party components under `vendor/` remain subject to their own licence and notice files.
