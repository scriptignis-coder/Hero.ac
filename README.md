# HeRo Shield — website + scanner

- Website: `server.js` (Node) + `api/` + `assets/` + `*.html` — deploy on Render (`npm start`).
- Database: run `supabase-all.sql` once in Supabase → SQL editor (safe to run again).
- Scanner (v4.5.2, .NET Framework 4.8): `scanner/` — `BUILD.bat` on Windows, or push to GitHub and
  `.github/workflows/build-scanner.yml` builds `HeRoShield.exe` into release v1.0.
- Settings: copy `.env.example` → environment variables on Render.
  Optional: `DISCORD_BOT_TOKEN` also lets the site find names of servers the player left.
