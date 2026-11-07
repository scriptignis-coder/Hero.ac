# HeRo Shield — setup (do it once)

## 1. Database (Supabase)
Supabase → SQL Editor → New query → paste **supabase-all.sql** → Run.
It creates every table (servers, scans, signatures, staff, access, Discord check). Safe to run again.

## 2. Render → Environment
Copy the names from **.env.example** exactly:

| Name | Value |
|---|---|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase → Settings → API → **service_role** key |
| `SESSION_SECRET` | any long random text |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | discord.com/developers → your app → OAuth2 |
| `DISCORD_REDIRECT_URI` | `https://hero-ac.onrender.com/api/auth/callback` (also add it in Discord → OAuth2 → Redirects) |
| `ADMIN_DISCORD_IDS` | your Discord ID (full access + Access page) |
| `HEROCHECK_IDS` | IDs that see the screenshare tabs |
| `HEROSHIELD_IDS` | IDs that see the anticheat tabs |

Discord ID: Discord → Settings → Advanced → Developer Mode → right-click your name → Copy User ID.

## 3. Push to GitHub
Push this whole folder to the **SouthSide** repo.
- Render redeploys the site by itself.
- GitHub Actions builds **HeRoShield.exe** on Windows and puts it in release **v1.0** by itself
  (GitHub → Actions → "Build scanner" — green = done, ~4 min). No BUILD.bat needed.
  You can also start it by hand: Actions → Build scanner → Run workflow.

## 4. Use it
1. Dashboard → **Scan PINs** → player name → **Generate PIN** → **Copy link**.
2. Send the link to the player. He opens it, runs `HeRoShield-PIN.exe`, clicks **Accept** (no PIN to type).
3. The Discord page opens: he connects Discord → you see his servers.
4. Result appears in Scan PINs → **View**.

Cheat Discord servers: dashboard → **Discord check** → paste invite links → Add.
Scanner background: dashboard → **Scanner GUI**.
Give staff access: dashboard → **Access** (or the env IDs above).

## If something fails
- Scanner says "could not send the result (HTTP …)": the text after HTTP says why.
  The report is also saved next to the .exe as `hero-report-PIN.json`.
- "PIN NOT FOUND" in the scanner: the PIN was deleted or typed wrong — make a new link.
- Render log "Could not find the table …": run **supabase-all.sql** again.
