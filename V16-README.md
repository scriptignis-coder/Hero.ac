# HeRoShield V16 — account licenses and automatic PIN workspace

- `/api/pins` provisions an internal scanner PIN workspace for each logged-in account with an active `hs_account_licenses` personal or enterprise membership.
- New PINs are linked to the internal workspace, which belongs to that Discord ID. No separate manual scanner license creation needed.
- My License displays the account license and hides the key from enterprise members.
- The enterprise owner alone can manage seats; members cannot view the account license key.
- PIN daily quota remains enforced by the backend. Existing scanner and dashboard tabs remain intact.
- `/api/scanner-licenses` no longer allows self-service create/delete.

Note: existing account license storage contains a SHA-256 hash, not a recoverable original activation key. The UI cannot show the original full key without a new secure storage design; it displays a masked placeholder.

Deploy to Render. Test with a real activated owner and enterprise member; Supabase tables `scanner_licenses`, `hs_account_licenses`, `hs_account_license_members`, `scan_pins` must exist. Do not change original `hs_licenses`.
