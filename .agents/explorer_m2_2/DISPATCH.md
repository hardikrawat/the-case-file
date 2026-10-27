# DISPATCH for Explorer 2 (SSRF Defense & File Upload Hardening)

## Mission
Investigate the codebase and write a comprehensive technical implementation plan for:
1. Securing `GET /api/preview` against SSRF (`src/app/api/preview/route.ts`):
   - Parse URL with `new URL(url)`. Reject invalid formats (return 400 Bad Request).
   - Strict protocol check: `parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'`.
   - Resolve DNS hostname using `dns.promises.lookup(hostname, { all: true })`.
   - Block all private/reserved IPv4 & IPv6 addresses:
     - `127.0.0.0/8`, `localhost`, `0.0.0.0/8` (Loopback)
     - `169.254.0.0/16` (Link-Local & Cloud IMDS `169.254.169.254`)
     - `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (RFC1918)
     - `100.64.0.0/10`, `192.0.0.0/24`, `198.51.100.0/24`, `203.0.113.0/24`, `224.0.0.0/4`, `240.0.0.0/4`
     - IPv6: `::1`, `fc00::/7`, `fe80::/10`, `::ffff:0:0/96`
   - If private or loopback, return `400 Bad Request` ("Access to private network address is forbidden").
   - Fetch with `redirect: 'manual'` (or re-validate redirect target URLs before following).
   - Add 5-second timeout via `AbortSignal.timeout(5000)`.
   - Add rate limiting: `checkRateLimit('preview:${ip}', 20, 60000)`.
2. File Upload Hardening in `POST /api/upload` (`src/app/api/upload/route.ts`):
   - Enforce strict extension mapping from allowed MIME types: `image/jpeg` -> `.jpg`, `image/png` -> `.png`, `image/webp` -> `.webp`, `image/gif` -> `.gif`.
   - Never use client-supplied filename or `file.name.split('.').pop()` to determine extension.
   - Verify magic bytes of the file buffer (JPEG: `FF D8 FF`, PNG: `89 50 4E 47`, GIF: `47 49 46 38`, WEBP: `52 49 46 46`).

## Required Reading
- `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md`
- `/Users/hardikrawat/Documents/the-case-file/PROJECT.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_m2/SCOPE.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_survey_2/handoff.md`

## Output Requirements
Write your detailed plan and findings to `/Users/hardikrawat/Documents/the-case-file/.agents/explorer_m2_2/handoff.md`.
Include exact file paths, line numbers, proposed diffs/code snippets, edge cases, and verification commands.
Send a message back to parent when complete.

## 2026-09-04T15:18:35Z
You are Explorer 2 for Milestone 2 (SSRF Defense & File Upload Hardening).
Your working directory is `/Users/hardikrawat/Documents/the-case-file/.agents/explorer_m2_2`.
Investigate the exact source files and produce a comprehensive technical implementation plan in `/Users/hardikrawat/Documents/the-case-file/.agents/explorer_m2_2/handoff.md`.

