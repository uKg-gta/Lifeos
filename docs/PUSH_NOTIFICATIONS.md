# LifeOS push notifications

The push feature uses account-scoped subscription and preference tables. It does not read from or write to the workspace except to inspect tasks, habits, study sessions, and exam dates when dispatching reminders.

## Server configuration required

The Edge Functions are `push-config` (authenticated public-key discovery) and `push-dispatch` (scheduled delivery). Add these secrets to the Supabase project's Edge Function secrets before enabling devices:

- `VAPID_PUBLIC_KEY`: URL-safe base64 VAPID public key.
- `VAPID_PRIVATE_KEY`: matching private key; keep it server-only.
- `VAPID_SUBJECT`: contact URI such as `mailto:you@example.com`.
- `PUSH_CRON_SECRET`: long random bearer secret for the scheduled dispatcher.

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. Never place the private VAPID key, cron secret, or service-role key in frontend files.

After setting secrets, invoke `push-dispatch` every hour using Supabase Cron (or an external scheduler) with POST and header `Authorization: Bearer <PUSH_CRON_SECRET>`. The dispatcher sends at local 08:00 for tasks/habits/exams and 19:00 for study, subject to quiet hours. Repeated sends are deduplicated in `lifeos_push_delivery_log`.

## Device setup

1. Open LifeOS in a supported browser. On iPad, add LifeOS to the Home Screen and open that installed web app on supported iPadOS.
2. Sign in and open Settings → Push notifications.
3. Select categories and quiet hours, then choose Enable push on this device and allow notifications.

Each signed-in account can register its own device subscriptions. Turning push off removes only the current device subscription. Existing workspace records are not changed.
