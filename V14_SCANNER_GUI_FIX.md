# HeRoShield V14 — Scanner GUI Invalid server fix

The Scanner GUI previously called `/api/scanner-bg?server=...` and triggered the legacy `requireOwnedServer` validation. V14 uses `/api/scanner-licenses` and a user-owned `license_id` instead. Scanner background reads by PIN also resolve the associated scanner license rather than a FiveM server.

## Deployment
1. In Supabase SQL Editor run `supabase-scanner-gui-v14.sql` after your V13 schema.
2. Deploy the `hero-shield-site` folder to your existing hosting setup.
3. Log in with Discord, create a license under My License, open Scanner GUI and select it.
4. Test saving/removing a background and retrieving it by a generated PIN.

The Windows scanner source is bundled unchanged; Windows build and live Supabase/Discord tests were not performed.
