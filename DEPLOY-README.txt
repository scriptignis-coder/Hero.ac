HeRo Shield — everything changed today, in one place

Deploy in THIS order. Steps 1 and 2 are not optional: the new tabs call APIs that
need those tables, and without them the tabs show an error.

────────────────────────────────────────────────────────────────────────
STEP 1 — SQL (Supabase → SQL Editor). Run all three, in this order.
────────────────────────────────────────────────────────────────────────
  FIX-LICENSE-RENEWAL-V29.sql           licences: a customer whose licence expired
                                        could never redeem a new one ("already redeemed")
  MIGRATION-COMMUNITY-SIGNATURES-V30.sql  the shared Signatures tab
  MIGRATION-MEMORY-STRINGS-V31.sql        the Strings tab

All three are safe to run twice. None of them deletes anything.

────────────────────────────────────────────────────────────────────────
STEP 2 — site files
────────────────────────────────────────────────────────────────────────
  index.html                  black-and-white restyle + rebuilt hero
  dashboard.html              the two new tabs in the sidebar
  assets/dashboard.js         the tabs themselves, and the licences-list fix
  api/licenses.js             licence claim: idempotent, real error messages
  api/admin-licenses.js       revoke/delete now clear the access cache; Delete added
  api/license-admin.js        refuses a second live licence for the same account
  api/community-signatures.js NEW — shared signatures
  api/memory-strings.js       NEW — the Strings tab
  api/scanner-strings.js      NEW — the feed the scanner reads

Upload all nine. A missing one is what makes a tab "not work".

────────────────────────────────────────────────────────────────────────
STEP 3 — the scanner
────────────────────────────────────────────────────────────────────────
Build 4.12.0 with BUILD.bat. The OLD exe does not know how to read memory strings,
so the Strings tab has no effect until the new exe is the one players download.

────────────────────────────────────────────────────────────────────────
IF A TAB STILL DOES NOTHING
────────────────────────────────────────────────────────────────────────
That was a real bug and it is fixed in this build. The dashboard keeps a list of
known tabs (TITLES) and refuses to open anything not in it. The two new tabs were
not in that list, so clicking them did nothing at all. They are registered now.

If it still happens: open the browser console (F12) and send me what it prints when
you click the tab.

────────────────────────────────────────────────────────────────────────
WHO SEES THE NEW TABS
────────────────────────────────────────────────────────────────────────
Both are set to "herocheck" — the same permission as your existing Signatures,
Scan PINs and Scanner GUI tabs. So every licensed user sees them, which is what
you asked for on the shared Signatures tab.

To make Strings admin-only instead, change ONE word in assets/dashboard.js:
    memstrings:'herocheck'   ->   memstrings:'admin'
and in dashboard.html on that button:
    data-perm="herocheck"    ->   data-perm="admin"
