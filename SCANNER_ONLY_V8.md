# HeRoShield Scanner-only website V8

The public site now markets only Windows PC scanning/screenshare workflows. The legacy FiveM anti-cheat features, HWID bans, resource installation, and server management have been removed from the public marketing and visible dashboard navigation.

Scanner tabs: Download scanner, Scan PINs, Discord check, Scanner GUI, Signatures, Scan Activity, My Profile, My License, Quick Tools, Leaderboard, Tutorial, Changelogs, plus staff management for administrators.

Scanner users need HeRoCheck access (or admin). Legacy HeRoShield permissions remain in the data model for compatibility, but alone no longer grant scanner dashboard entry.

IMPORTANT: Legacy anti-cheat API code and database tables remain in this source archive to avoid silently breaking existing integrations. This is a product UI/scope conversion, not a verified full backend removal. Audit and retire unused API routes before deployment if anti-cheat services must be completely disabled. Payment/Discord/Supabase still require production configuration.
