# LifeOS deployment notes

This document records repository-level deployment guidance. It does not deploy the app or change any connected service.

## Before a frontend deployment

1. Review the changes and confirm that the intended frontend files are the only application files being released.
2. Run the regression suite with `npm test`.
3. Check the GitHub Actions reliability test workflow.
4. Confirm that the target hosting environment serves the repository's static files over HTTPS.
5. Verify that the deployed app loads its manifest, service worker, icons and required Supabase client configuration.

Do not place Supabase service-role keys or other privileged secrets in browser-delivered files. Browser code must use only the intended client-side configuration and rely on database policies and server-side controls for access enforcement.

## Supabase environments

Read [supabase/README.md](../supabase/README.md) before running SQL.

- For a **brand-new Supabase project**, the repository documents `supabase/bootstrap.sql` as a one-time starting point, followed by the tracked migrations.
- For the **existing LifeOS production project**, do not run `supabase/bootstrap.sql`. The original workspace table and policies already exist there.
- Do not assume a migration has been applied just because its SQL file exists in Git.

## Pending reliability migration

The Supabase notes identify `20261109090000_bump_workspace_revision_for_legacy_writes.sql` as a migration that had not yet been applied when those notes were written.

Before any frontend release that depends on its revision behaviour:

1. Check the current production migration history directly.
2. Review the migration SQL.
3. Validate it in a separate development database or with the Supabase CLI.
4. Apply it through the project's approved database-change process.
5. Verify the trigger and relevant write behaviour before releasing the dependent frontend.

Do not apply this migration blindly, and do not edit production data as part of routine repository housekeeping. Update this document and `supabase/README.md` only after the actual migration status has been verified.

## Rollback

If a frontend release causes a regression, use the hosting provider's established rollback procedure to restore the last known-good frontend version. Database migrations require a separately reviewed rollback or forward-fix plan; reverting frontend files does not automatically reverse database changes.
