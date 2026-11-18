# Email Digest

A small private portal built with plain HTML, CSS, JavaScript, and Supabase. No UI framework and no server-side secret keys. The Supabase JavaScript SDK handles magic-link sessions; esbuild bundles that library for the browser.

## How the pieces fit

1. In ChatGPT, search Gmail with `in:inbox` and the `INBOX` label. Read individual matching messages, never whole threads or attachments. Check each message still has the INBOX label before importing it.
2. ChatGPT writes a brief English summary and classifies category, priority, and whether action is needed. These classifications are judgments, so review important items in Gmail.
3. Save only the sender, redacted subject, received date, short summary, category, priority, and action flag in Supabase. Omit authentication codes, secrets, full bodies, and attachments.
4. The portal signs users in through Supabase email magic links and checks their allowlist entry. Supabase RLS independently protects every database read.
5. GitHub stores the source. Vercel builds and hosts the static portal.

The ChatGPT Gmail connector is not embedded in this website. Refresh summaries reloads saved database rows; it does not fetch Gmail. Further inbox imports are performed through ChatGPT. The first import contains 10 inbox messages, not the whole inbox. No scheduled import is configured.

## Two tables

| Table | Purpose |
| --- | --- |
| allowed_users | The four permitted email addresses, names, and admin/viewer roles. |
| email_summaries | Sender name/email, subject, received_at, summary (1–350 characters), category, priority, action_needed (boolean), created_at, and a generated row ID. |

`database/schema.sql` records the existing schema and policies as a fresh-project setup reference. The Portal test project already had these tables; they were inspected and reused. Do not blindly run the reference against an existing database.

### Rules, in simple words

- `read_own_allowlist_entry`: A logged-in user can read only the allowlist entry matching the email in their Supabase-issued JWT.
- `read_summaries_when_allowed`: A logged-in user can read email summaries only when that verified email is present in allowed_users.
- Anonymous access: Visitors without a session have no permission to read either table.
- Writes: Portal users have no insert, update, or delete privileges; trusted imports use the connected Supabase tool.

The email claim comes from Supabase Auth, never user-editable profile metadata. RLS is enabled on both tables. The frontend address list provides the immediate “You do not have access” message; it is not the security boundary. Direct requests remain subject to RLS. Admin is recorded for future use; both roles have the same read-only portal experience. Auth users outside the allowlist cannot enter the portal or read summaries, even if they create an Auth account through Supabase directly.

## Vercel setup

Import the private GitHub repository. Framework: Other; build command: `npm run build`; output directory: `dist`. Set these Vercel Environment Variables:

| Name | Value |
| --- | --- |
| SUPABASE_URL | Supabase project URL |
| SUPABASE_PUBLISHABLE_KEY | Modern key starting with sb_publishable_ |

These public connection values are written to `dist/config.js` during the build. A publishable key is intended to be visible in the browser; RLS protects the data. Never provide a service-role or secret key. The build rejects keys without the modern publishable prefix.

In Supabase → Authentication → URL Configuration, set Site URL to the final portal HTTPS origin, and add its exact URL with a trailing `/` to Redirect URLs. Enable email authentication and the magic-link email template. Use custom SMTP for delivery to all four team members: Supabase's default mail service restricts recipients and is unsuitable for a full team login rollout. Test delivery for each person. Do not paste SMTP passwords into chat or commit them.

## Local development

Install with `npm ci`, set the two environment variables in your terminal, then run `npm run build`. Serve the `dist` directory using a static HTTP server. Add its exact local URL to Supabase's redirect allowlist for local magic-link testing. `npm test` checks combined search/filter behavior and the four-address frontend gate. Build output and local environment files are ignored by Git.

## Verification

Check allowed-user SELECT returns the summaries and only their own allowlist entry; outsider SELECT returns no rows; anonymous SELECT and browser-role writes are denied. Check a real magic link returns to the production portal, shows cards, supports search and both filters, and clears all visible cards on sign-out. Token expiry and failed requests should show a recoverable message. New data is loaded newest first, in pages of 100; search and counts cover loaded rows, and Load more summaries retrieves the next page.

Imports check sender_email + subject + received_at before inserting to avoid duplicates in sequential manual runs. There is no Gmail message ID column or unique import constraint in this deliberately simple two-table design, so do not run concurrent imports.
