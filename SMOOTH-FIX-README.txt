HeRoShield Dashboard Performance Patch
Based on AdminBlacklist_Fixed version.
- Deduplicates concurrent GET requests to selected non-sensitive read-only endpoints.
- 2.5 second memory cache for selected read-only lists; no persistent cache.
- Never caches auth, permissions, blacklist, licenses, or user identity.
- Mutations invalidate list cache.
- Removes expensive dashboard card hover transforms.
- Preserves Blacklist Management admin tab and API logic.

Deploy: back up current site/database, upload the ZIP contents, and hard-refresh the dashboard (Ctrl+F5).
No database migration needed.
Validation: static JS syntax check only; browser and live hosting performance not tested.
