-- Keep scheduler credentials in Vault; never place them in browser code.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'lifeos_push_cron_secret') then
    perform vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'lifeos_push_cron_secret', 'LifeOS push scheduler authentication');
  end if;
  if not exists (select 1 from vault.secrets where name = 'lifeos_push_publishable_key') then
    perform vault.create_secret('sb_publishable_-Bppvb1O6mYvca2y8GNFXQ_m0adWMEh', 'lifeos_push_publishable_key', 'Public API key used by the LifeOS notification scheduler');
  end if;
end $$;

select cron.schedule(
  'lifeos-push-dispatch-hourly',
  '*/30 * * * *',
  $job$
    select net.http_post(
      url := 'https://dtnyyqnyfksxvgedswhj.supabase.co/functions/v1/push-dispatch',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'lifeos_push_publishable_key' limit 1),
        'x-lifeos-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'lifeos_push_cron_secret' limit 1)
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 15000
    );
  $job$
);
