# MailBakes Creators

The pipeline for TikTok and UGC creators who receive a free MailBakes sample card. It is a separate app from organic social and from Personal. It has its own database and its own Render service.

Sign-in is one shared password, `APP_PASSWORD`.

The first time the app runs against an empty database it loads the eight creators from the MailBakes TikTok sample sheet (updated 23 Oct 2026). Later deploys do not import them again, and a creator you remove stays removed.

## Stages

Inquiry, Approved, Message needed, Ready to ship, Shipped, Delivered, Posted. On hold and Declined sit underneath the board.

Accept on an inquiry moves it to Approved. Decline moves it to Declined, with an optional reason. Drag a card between stages, or on a phone use Move on the card.

## Local

Node 20+ and PostgreSQL.

```bash
cd creators
cp .env.example .env
npm install
npx prisma migrate deploy
npm run dev
```

Open http://127.0.0.1:3000 and sign in with `APP_PASSWORD`.

## Deploy on Render

The service name `mailbakes-creators` becomes https://mailbakes-creators.onrender.com

Use a **new** blueprint whose path is `creators/render.yaml`. That file defines only `mailbakes-creators` (Starter, `rootDir: creators`) and `mailbakes-creators-db` (`basic-256mb`, Frankfurt).

Do not sync the repo-root `render.yaml`. That blueprint is the live organic service. Do not sync `personal/render.yaml` either.

1. Push this repo. `main` already contains the app.
2. In Render, choose **New → Blueprint**, select this repo, and set the blueprint path to `creators/render.yaml`.
3. When asked, set `APP_PASSWORD` (at least 10 characters) and `CREATORS_API_TOKEN` (at least 16 characters). Leave `SESSION_SECRET` on Render's generated value.
4. Deploy. The start command runs `npx prisma migrate deploy` and then the app. The eight sample orders appear on the first request.
5. If `mailbakes-creators` is already taken, change `name` and the `APP_URL` value in `creators/render.yaml` to the same new name, then sync again. The public URL is `https://<name>.onrender.com`.

Nothing in this repo creates the Render service for you.

## Environment

| Variable | Who sets it | Purpose |
| --- | --- | --- |
| `APP_PASSWORD` | Millie | Sign-in password. At least 10 characters. |
| `SESSION_SECRET` | Render generates | Signs the sign-in cookie. At least 32 characters. |
| `CREATORS_API_TOKEN` | Millie | Bearer token for posting inquiries. At least 16 characters. |
| `DATABASE_URL` | Blueprint, from the database | Postgres connection. |
| `APP_URL` | Blueprint | `https://mailbakes-creators.onrender.com` |
| `APP_NAME` | Blueprint | Shown as the signed-in name. Default `Millie`. |
| `NODE_VERSION` | Blueprint | `22`. |

## Inquiry API

Set `CREATORS_API_TOKEN` to a long random string (`openssl rand -base64 32`). The token is not shown in the app.

`POST /api/v1/inquiries` with `Authorization: Bearer <token>`. The inquiry always lands in the inbox. The call cannot set a stage, a tracking number, or a rating.

```bash
curl -s https://mailbakes-creators.onrender.com/api/v1/inquiries \
  -H "Authorization: Bearer $CREATORS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Creator name","handle":"@handle","email":"name@email.com","shopifyOrder":"","cardMessage":"","notes":"","rush":false}'
```

A created inquiry returns `{ "id", "name", "stage": "inquiry" }`. If `CREATORS_API_TOKEN` is missing, the API responds with setup needed and does not accept a guess.

Tracking numbers for Royal Mail (or a blank courier) link to `https://www.royalmail.com/track-your-item#/tracking-results/<number>`.
