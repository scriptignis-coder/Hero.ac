# HeRo Shield — site + dashboard (branche sur TON resource v1.1.0)

Ce site correspond EXACTEMENT a ton resource :
- `GET  /api/license/validate?key=...`  (Config.LicenseUrl)
- `POST /api/ingest/ban`                (Config.ReportingUrl + /ban)
- `POST /api/ingest/log`                (+ /log)
- `POST /api/ingest/heartbeat` et `/api/ingest/player`  (ajout stats/playtime)
Auth des ingest : header `X-Ingest-Token` = `Config.ReportingToken` = env `INGEST_TOKEN`.

## 1) Supabase
- supabase.com -> New project -> SQL Editor -> colle `supabase_schema.sql` -> Run.
- Settings -> API : note `Project URL` + cle `service_role`.

## 2) Discord (login du dashboard)
- developers discord -> ton app -> OAuth2 : Client ID + Secret.
- OAuth2 -> Redirects -> `https://TON-SITE.vercel.app/api/auth-callback`

## 3) Vercel
- Mets ce dossier sur GitHub (garde les dossiers `api/`, `api/ingest/`, `api/license/`).
- Importe sur Vercel -> Deploy.
- Settings -> Environment Variables (voir `.env.example`) :
  CLIENT_ID, CLIENT_SECRET, SUPABASE_URL, SUPABASE_KEY, SESSION_SECRET,
  SITE_URL (URL fixe de prod, sans / final), INGEST_TOKEN (choisis une valeur secrete).
- Redeploy.

## 4) config.lua du resource (remplace "ton-site.com")
```
Config.LicenseUrl      = "https://TON-SITE.vercel.app/api/license/validate"
Config.ReportingUrl    = "https://TON-SITE.vercel.app/api/ingest"
Config.ReportingToken  = "LA-MEME-VALEUR-QUE-INGEST_TOKEN"
```
Redemarre le resource -> les bans (avec preuve), logs, joueurs et heartbeat
remontent dans le dashboard.

## Note
- Le dashboard liste TOUS les serveurs qui remontent (usage mono-proprietaire).
- Pour vendre a des clients : chaque client met SON propre INGEST_TOKEN / deploiement,
  ou on ajoute un owner par serveur plus tard.
- La validation de licence est "ouverte" tant que la table hs_licenses est vide
  (ajoute des cles dedans pour verrouiller).
