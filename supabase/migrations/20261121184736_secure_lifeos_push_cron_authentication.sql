create or replace function public.verify_lifeos_push_cron_secret(candidate text)
returns boolean
language sql
security definer
set search_path = pg_catalog, vault
as $$
  select candidate is not null
     and exists (
       select 1
       from vault.decrypted_secrets
       where name = 'lifeos_push_cron_secret'
         and decrypted_secret = candidate
     );
$$;

revoke all on function public.verify_lifeos_push_cron_secret(text) from public, anon, authenticated;
grant execute on function public.verify_lifeos_push_cron_secret(text) to service_role;
