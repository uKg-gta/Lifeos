# LifeOS push notifications

The push feature uses account-scoped subscription and preference tables. It reads the cloud workspace only to inspect tasks, habits, study sessions, and exam dates when dispatching reminders. It does not modify workspace records.

## Server configuration

The Edge Functions are:
- `push-config`: authenticated public VAPID-key discovery.
- `push-dispatch`: scheduled delivery.

Set these Edge Function secrets:
- `VAPID_PUBLIC_KEY`: URL-safe base64 VAPID public key.
- `VAPID_PRIVATE_KEY`: matching private key; keep it server-only.
- `VAPID_SUBJECT`: contact URI such as `mailto:you@example.com`.

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions.

The scheduler authentication secret is generated and stored in Supabase Vault as `lifeos_push_cron_secret`. The project's publishable API key is stored as `lifeos_push_publishable_key`. The dispatcher validates the custom `x-lifeos-cron-secret` header against Vault through a service-role-only database function. Do not put either credential in frontend files or commit their values.

The `lifeos-push-dispatch-hourly` Cron job invokes `push-dispatch` every 30 minutes. It sends the publishable key in the `apikey` header and the Vault-backed scheduler secret in `x-lifeos-cron-secret`. The Edge Function has platform JWT verification disabled and performs its own secret check before reading or sending data.

## Reminder schedule

All times are in each account's saved timezone and are subject to its quiet hours:
- Tasks: 08:00, 15:00 and 22:00 when an unfinished task is due today or overdue.
- Study target: 08:00, 15:00 and 22:00 when the daily study target has not been reached.
- Habits: 08:00 when one or more scheduled habits remain incomplete.
- Exams: 08:00 when an exam is today or within the next seven days.

Delivery keys are stored in `lifeos_push_delivery_log` to prevent duplicate sends for the same reminder slot.

## Device setup

1. Open LifeOS in a supported browser. On iPad, add LifeOS to the Home Screen and open that installed web app on supported iPadOS.
2. Sign in and open Settings → Push notifications.
3. Select categories and quiet hours, then choose Enable push on this device and allow notifications.

Each signed-in account can register its own device subscriptions. Turning push off removes only the current device subscription. Existing workspace records are not changed.
