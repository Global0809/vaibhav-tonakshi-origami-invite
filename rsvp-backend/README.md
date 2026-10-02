# Vaibhav & Tonakshi RSVP service

Dedicated Worker + D1 service for this invitation only. No email relay or email account activation is used.

- `POST /api/rsvp`: validated guest submissions from configured invitation origins; idempotent UUID receipt; honeypot and per-IP rate limits.
- `/admin`: password-protected guest dashboard. The static login shell is public; every data request requires an HttpOnly session cookie.
- `POST /api/login`, `POST /api/logout`: 12-hour opaque sessions. Only token hashes are stored. Expired records are pruned during sign-in.
- `GET /api/admin/rsvps`: private responses. No public guest-list endpoint.
- CSV export is generated in the authenticated browser and neutralizes spreadsheet formula prefixes.

## Maintenance

Use Wrangler from this directory. Apply migrations with `npx wrangler d1 migrations apply vaibhav-tonakshi-rsvps --remote`, then `npx wrangler deploy`.

Required Worker secrets: `ADMIN_PASSWORD_HASH` (SHA-256 of a strong random password) and `RATE_LIMIT_SALT` (random salt for hashed IP rate-limit keys). Set with Wrangler secrets, never config vars. Do not commit passwords, secret files, database exports or local `.wrangler` state. Rotating the password should also revoke existing sessions.

The database stores names, phone numbers, attendance, day count, additional guests and optional notes. Hosts should delete retained guest data when no longer needed. Rate-limit IP hashes expire; no raw IPs are stored. This service does not send email. Repeated submissions from the same guest with a new receipt are retained rather than silently overwriting responses.

The dashboard deliberately uses manual Refresh rather than continuous polling. Public submissions are limited to 20 per minute and 200 per day per IP; dashboard sign-in to 10 per minute and 100 per day per IP. Limits reduce casual abuse, but are not a CAPTCHA or a guarantee against distributed attacks. Monitor Cloudflare usage and add Turnstile if required.
