# LifeOS

LifeOS is a personal command centre for organising everyday work and personal planning. The app brings tasks, habits, goals, study, focus sessions, notes and finances together in one interface.

## Project overview

- **Application:** browser-based personal productivity app
- **Frontend:** HTML, CSS and JavaScript in the repository
- **Backend services:** Supabase for the app's connected data and authentication workflows
- **Offline/PWA support:** web app manifest and service worker
- **Tests:** Node.js built-in test runner

## Repository layout

| Path | Purpose |
| --- | --- |
| `index.html` | Main application interface and frontend |
| `sync-core.js` | Shared synchronisation logic |
| `sw.js` | Service worker |
| `manifest.json` | Progressive Web App metadata |
| `icons/` | App icons |
| `vendor/` | Vendored client library and its licence notice |
| `supabase/` | Database bootstrap, migrations and Supabase notes |
| `tests/` | Automated reliability regression tests |
| `.github/workflows/` | GitHub Actions checks |

## Run locally

The frontend is a static web app. Serve the repository root with any local static HTTP server and open the local address it provides. Serving it over HTTP is preferable to opening `index.html` directly because browser service-worker and PWA features require an appropriate origin.

The repository's test suite uses Node.js:

```bash
npm test
```

No dependency installation is currently required for the test command.

## Supabase setup and deployment

Read [Supabase setup and deployment](docs/DEPLOYMENT.md) before creating or changing a Supabase environment.

Important: `supabase/bootstrap.sql` is intended only for a completely new Supabase project. Do not run it against the existing production project. Review the migration status and deployment order described in [supabase/README.md](supabase/README.md) before deploying frontend changes.

## Contributing and security

This repository is maintained as a personal project. If you discover a security issue, follow [SECURITY.md](SECURITY.md) rather than publishing sensitive details in a public issue.

## Licence

No project-wide licence has been selected yet. Until one is added, the default copyright rules apply. The separate notices under `vendor/` continue to govern the vendored third-party software.
