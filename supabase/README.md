# LifeOS Supabase schema

## Migration history

The four historical migration files in `migrations/` were reconstructed from the
`statements` arrays recorded in the connected project's
`supabase_migrations.schema_migrations` table. Their versions and SQL statements
match the live migration history inspected on 2026-11-09.

The original `lifeos_workspace` table predates that migration history and was
created outside the tracked migration sequence. Its current columns, constraints,
RLS policies, and grants were inspected directly from the live database.

## New project bootstrap

For a completely new Supabase project, run `bootstrap.sql` once before applying
the tracked migrations. It creates the original workspace table and its
owner-scoped RLS policies. Do **not** run this bootstrap against the existing
LifeOS production project; that table and policies already exist.

## Reliability migration

`20261109090000_bump_workspace_revision_for_legacy_writes.sql` is a new,
not-yet-applied migration. It adds a BEFORE UPDATE trigger that advances
`revision` when a legacy client updates the workspace without changing the
revision column. The revision-aware app then uses the existing
`save_lifeos_workspace(jsonb, bigint)` compare-and-swap RPC.

**Deployment order matters:** apply and verify this trigger migration before
deploying the updated frontend. Otherwise an older open tab can still write
without advancing `revision`, bypassing the new client's conflict detection.
The migration has not been run against production. Review it and validate it
with the Supabase CLI or a separate development database before applying it.

The Supabase CLI is not installed in the current execution environment, so the
new migration file has been authored using the repository's existing 14-digit
timestamp naming convention; it has not been CLI-validated or applied.
