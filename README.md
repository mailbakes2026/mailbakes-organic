# MailBakes organic social

Planning and approval for MailBakes organic posts and stories. Approving a post here does not publish it to Instagram, Facebook, TikTok, LinkedIn, YouTube Shorts or Snapchat.

## Local

Requires Node 20+ and PostgreSQL.

```bash
cp .env.example .env
# set SESSION_SECRET, TEAM_PASSWORD and MILLIE_PASSWORD
npm install
npx prisma migrate deploy
npm run dev
```

Open http://127.0.0.1:3000 and sign in as Manager or Millie with the passwords from `.env`.

`npm run dev -- -p 43123` uses another port.

## Roles

Sign in with a name and a password.

- **Millie** (approver): approve a post, or send it back with **Needs changes**. Her password is `MILLIE_PASSWORD` (at least 10 characters). `MANAGEMENT_PASSWORD` is only used if `MILLIE_PASSWORD` is not set.
- **Manager** (content team): create posts and make amendments. Sign in as **Manager** with the existing `TEAM_PASSWORD`. Email `team@mailbakes.com` still matches that same password. Saving a post that needs changes, or editing an approved post, puts it in **Amendments made** so Millie can approve it again.

Every approval, change request and amendment is stored with the name of the person who did it.

Passwords are read from the environment on startup. Change `MILLIE_PASSWORD` or `TEAM_PASSWORD` and restart to rotate them. Add more people with `EXTRA_USERS` (see `.env.example`).

## What is stored

Posts, comments, key dates and uploaded files live in Postgres. A post has a planned date and a posting time in Europe/London. Posts saved before times were added still show on their date. A post can hold several photos or videos, in an order you set, for a carousel or a multi-frame story. A reel can also have a cover image, stored with the other files and kept out of that order. Older reels without a cover keep using their existing image. Older posts with one file keep that file. Files are kept in the database (up to 10MB each), so they survive a Render redeploy. The web service disk is ephemeral — do not move uploads onto local disk unless you also attach a Render disk.

Longer videos are not uploaded. Put a link in “Creative link or notes”.

## Deploy on Render

The public URL comes from the service name: `mailbakes-organic` → https://mailbakes-organic.onrender.com

1. Push this project to the Git host Render can see (GitHub or GitLab).
2. In Render: **New** → **Blueprint** → select the repo. Render reads `render.yaml`.
3. When asked, set:
   - `MILLIE_PASSWORD` (at least 10 characters) — Millie's approver login
   - `TEAM_EMAIL` (the Manager account, usually `team@mailbakes.com`)
   - `TEAM_PASSWORD` (at least 10 characters) — the existing team password
4. Leave `SESSION_SECRET` to Render’s generated value.
5. Deploy. The first boot runs the database migration and creates the two accounts.
6. Open https://mailbakes-organic.onrender.com

Use the Frankfurt region for the web service and the database so they can use the private connection string. The web service plan is `starter` and the database is `basic-256mb` (Render’s smallest current Postgres). Change the plan names in `render.yaml` if your account uses different ones.

The app starts empty. It no longer creates example posts; any left over from the first version are removed once at startup. Accounts are never touched by that cleanup.

The sidebar is Meta posts, Meta stories, TikTok and Content calendar. Each channel is a board with columns For approval, Needs changes, Amendments made and Approved, with that channel's feed preview beside it. The content calendar is a month or week view, coloured by channel and status. Notes sit under the calendar as a checklist on a day. Performance stats stay on each post. Platform connections still sync in the background for those stats; they are not a separate tab.

The start command runs `prisma migrate deploy` before the server listens. `/api/health` checks the database and is the Render health check.

This tool does not connect to Meta, TikTok or any other platform. Someone still posts by hand after a post is approved.

## Personal command centre

Millie's own command centre (inbox, calendar, reminders, run-through, briefings and payslips) lives in [`personal/`](personal/README.md). Deploy it from a separate blueprint whose path is `personal/render.yaml`. The root `render.yaml` stays the organic service only. See `personal/README.md` for the env vars, the Google redirect URL, and the assistant API.

## Growth

Paid Ads and Retention live in [`growth/`](growth/README.md). One service serves both. Deploy it from a separate blueprint whose path is `growth/render.yaml`. It uses SQLite on a Render disk, not Postgres. The root `render.yaml` stays the organic service only.
