# HeRoShield V19 — Enterprise name and security patch

- Enterprise name is now returned by the authenticated account-license API for both owners and members, and displayed as the Enterprise workspace heading for owners.
- Only Admin/Staff may rename through the existing server-authorized endpoint. No raw license keys are returned by the enterprise management API.
- Added HTTP security headers: nosniff, frame denial, referrer restrictions, permissions policy, cross-origin resource policy, and HTTPS HSTS.
- No database migration is needed beyond the existing V19 migration (`enterprise_name`).
- This is defense in depth, not proof against copying or reverse engineering. The scanner executable was NOT modified in this website package. Production security requires an external review of authentication, authorization, PIN verification, WebSocket streaming, signing and rate limits.
- Do not rotate HS_WEBHOOK_ENCRYPTION_KEY after saving webhooks without re-encrypting the existing records.
