# MailBakes organic social

Planning and approval for MailBakes organic posts and stories. Approving a post here does not publish it to Instagram, Facebook, TikTok, LinkedIn, YouTube Shorts or Snapchat.

## Local

Requires Node 20+ and PostgreSQL.

```bash
cp .env.example .env
# set SESSION_SECRET, MANAGEMENT_PASSWORD and TEAM_PASSWORD
npm install
npx prisma migrate deploy
npm run dev
```

Open http://127.0.0.1:3000 and sign in with the emails and passwords from `.env`.

`npm run dev -- -p 43123` uses another port.

## Roles

- **Management** (Millie): create, edit, approve, reject with a comment, or request changes.
- **Team**: create and edit. Saving an approved post sends it back to pending approval.

Passwords are read from the environment on startup. Change `MANAGEMENT_PASSWORD` or `TEAM_PASSWORD` and restart to rotate them. Add more people with `EXTRA_USERS` (see `.env.example`).

## What is stored

Posts, comments, key dates and uploaded files live in Postgres. A post has a planned date and a posting time in Europe/London. Posts saved before times were added still show on their date. A post can hold several photos or videos, in an order you set, for a carousel or a multi-frame story. A reel can also have a cover image, stored with the other files and kept out of that order. Older reels without a cover keep using their existing image. Older posts with one file keep that file. Files are kept in the database (up to 10MB each), so they survive a Render redeploy. The web service disk is ephemeral — do not move uploads onto local disk unless you also attach a Render disk.

Longer videos are not uploaded. Put a link in “Creative link or notes”.

## Deploy on Render

The public URL comes from the service name: `mailbakes-organic` → https://mailbakes-organic.onrender.com

1. Push this project to the Git host Render can see (GitHub or GitLab).
2. In Render: **New** → **Blueprint** → select the repo. Render reads `render.yaml`.
3. When asked, set:
   - `MANAGEMENT_EMAIL`
   - `MANAGEMENT_PASSWORD` (at least 10 characters)
   - `TEAM_EMAIL`
   - `TEAM_PASSWORD` (at least 10 characters)
4. Leave `SESSION_SECRET` to Render’s generated value.
5. Deploy. The first boot runs the database migration and creates the two accounts.
6. Open https://mailbakes-organic.onrender.com

Use the Frankfurt region for the web service and the database so they can use the private connection string. The web service plan is `starter` and the database is `basic-256mb` (Render’s smallest current Postgres). Change the plan names in `render.yaml` if your account uses different ones.

The app starts empty. It no longer creates example posts; any left over from the first version are removed once at startup. Accounts are never touched by that cleanup. Meta preview (`/?view=grid`) shows Instagram and Facebook posts on the MailBakes Instagram profile, newest top left, in portrait 3:4 tiles. The header matches the live profile and can be edited from that page. TikTok preview (`/?view=tiktok`) is a 9:16 grid of posts marked for TikTok. The content calendar groups Instagram and Facebook as Meta. Notes (`/?view=notes`) is an ideas board: a dated note appears on the content calendar, and an undated note ticked “do this week” stays in the This week list. Turn into post makes a draft from that note. Reports (`/?view=reports`) counts approved posts by week and platform, and holds the views, likes, comments, shares, saves and link clicks typed in for each post. Those same fields are where a later platform connection would write.

The start command runs `prisma migrate deploy` before the server listens. `/api/health` checks the database and is the Render health check.

This tool does not connect to Meta, TikTok or any other platform. Someone still posts by hand after a post is approved.
