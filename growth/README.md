# MailBakes Growth

Paid Ads and Retention. One Next.js service serves both. It is separate from organic social, Creators, and Personal.

The Host header chooses the app:

- `paidads.mailbakes.com` shows Paid Ads
- `retention.mailbakes.com` shows Retention

On the onrender hostname, and locally, the same apps are at `/paidads` and `/retention`.

Sign-in is one shared password, `APP_PASSWORD`. The signed-in name comes from `APP_NAME` (Millie, unless you change it). The session is an httpOnly cookie named `mb_growth`, signed with `SESSION_SECRET`.

Nothing in this repo creates the Render service. `growth/render.yaml` is the blueprint to point at when you create it yourself.

## What you see

Paid Ads holds Meta and Google together. Daily and weekly spend, revenue, orders, ROAS and CPA, by campaign and ad set. Week-on-week revenue is compared with a 5% growth target. Weeks run Monday to Sunday, Europe/London. The current week is compared with the same number of days in the previous week, and the last full week is compared with the week before that.

What changed is a budget log for Millie and Mikey. It does not edit Meta or Google. Meta is limited to one recorded budget change per London day, and the form warns before a new row or an edit of today's row.

Google Ads is parked. The page says it is not connected. The app does not read `GOOGLE_ADS_*`. Rows pushed for Google through the ingest API are stored and labelled, and they are kept out of the Meta totals.

Retention holds Klaviyo flows and campaigns (revenue, open, click, unsubscribes), list snapshots, Shopify repeat-purchase rate, customers by order count, and cohort retention. Kyle (`kyle@flowsha.com`, lifecycle freelancer) has the Q4 2026 plan. Decisions start blank. Retention Reviews have their own prep notes.

The app does not invent a number. A missing row stays blank and the page says what is missing: an env var, a sync, or an ingest.

## Local

Node 20 or newer. No Postgres.

```bash
cd growth
cp .env.example .env
npm install
node scripts/prepare-db.mjs
npx prisma migrate deploy
npm run dev
```

Open http://127.0.0.1:3000/paidads and http://127.0.0.1:3000/retention. Sign in with `APP_PASSWORD`.

`npm test` runs the unit tests.

## Deploy on Render

Do this yourself. Do not sync the repo-root `render.yaml`, `creators/render.yaml`, or `personal/render.yaml`.

Use a new blueprint whose path is `growth/render.yaml`, or create one web service with the same settings:

| Setting | Value |
| --- | --- |
| Name | `mailbakes-growth` |
| Runtime | Node |
| Plan | Starter. A disk cannot be attached to the free instance. Keep a single instance. SQLite on a disk is not safe with more than one. |
| Region | Frankfurt |
| Root directory | `growth` |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `node scripts/prepare-db.mjs && npx prisma migrate deploy && npm run start` |
| Health check | `/api/health` |
| Disk | Name `mailbakes-growth-data`, mount `/var/data`, 1 GB |
| Custom domains | `paidads.mailbakes.com`, `retention.mailbakes.com` |

`DATABASE_URL` must be `file:/var/data/growth.db` so the file sits on that disk. There is no Postgres database.

Public URLs once the service exists:

- https://mailbakes-growth.onrender.com/paidads
- https://mailbakes-growth.onrender.com/retention
- https://paidads.mailbakes.com
- https://retention.mailbakes.com

If the name `mailbakes-growth` is taken, pick another name. The onrender URL follows the name. The custom domains stay as they are.

## Environment

Set these on the service. Do not commit them. The app does not print them.

| Variable | Who sets it | Required | Purpose |
| --- | --- | --- | --- |
| `APP_PASSWORD` | Millie | Yes | Shared sign-in password. At least 10 characters. |
| `SESSION_SECRET` | Render generates | Yes | Signs the `mb_growth` cookie. At least 32 characters. |
| `APP_NAME` | Blueprint | No | Name shown after sign-in. Default `Millie`. |
| `DATABASE_URL` | Blueprint | Yes | SQLite file. On Render: `file:/var/data/growth.db`. |
| `NODE_VERSION` | Blueprint | Yes | `22`. |
| `PAIDADS_API_TOKEN` | Millie | For ingest | Bearer token for Paid Ads rows. At least 16 characters. Must differ from the retention token. |
| `RETENTION_API_TOKEN` | Millie | For ingest | Bearer token for Retention rows. At least 16 characters. |
| `META_ACCESS_TOKEN` | Millie | To sync Meta | Marketing API token with ads read access for the ad account. |
| `META_AD_ACCOUNT_ID` | Millie | To sync Meta | Ad account id, with or without the `act_` prefix. |
| `KLAVIYO_PRIVATE_API_KEY` | Millie | To sync Klaviyo | Private API key. |
| `SHOPIFY_SHOP` | Millie | To sync Shopify | Shop host, such as `mailbakes.myshopify.com`. No `https://`. |
| `SHOPIFY_CLIENT_ID` | Millie | To sync Shopify | Client id for the client-credentials grant. |
| `SHOPIFY_CLIENT_SECRET` | Millie | To sync Shopify | Client secret for that grant. |

Google Ads is parked. These names are reserved for later and are not read: `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID`, `GOOGLE_ADS_LOGIN_CUSTOMER_ID`.

Generate the two API tokens with `openssl rand -base64 32`.

## Connectors

### Meta

Both `META_ACCESS_TOKEN` and `META_AD_ACCOUNT_ID` must be set or the card says Meta is not connected.

Sync calls `https://graph.facebook.com/v21.0/{act_id}/insights` for account, campaign, and ad set, one row per day, for the last 35 London days. The token is sent as `Authorization: Bearer` and is not written to the log. Spend, impressions, clicks, and purchase actions are stored. Orders and revenue use the first of `omni_purchase`, `purchase`, and `offsite_conversion.fb_pixel_purchase` that is present, so those types are not added together. Meta omits an action type when it is zero, so a row with spend and no purchase action is stored as zero orders and zero revenue. A row with no spend is dropped. Currency comes from `account_currency`. If that is missing, the row is dropped rather than labelled as GBP.

The token needs permission to read that ad account's insights. Sync does not change budgets.

### Google Ads

No request is made. The card stays "Not connected".

### Klaviyo

`KLAVIYO_PRIVATE_API_KEY` is sent as `Authorization: Klaviyo-API-Key` with revision `2025-04-15`. It is not logged.

Sync looks up a metric named `Placed Order`. If that metric is missing, sync stops and says so, because the values report will not return revenue without it. It then requests flow and campaign value reports for `last_7_days` and `last_30_days` (opens, clicks, unsubscribes, delivered or recipients, conversion value). Flow and campaign names are loaded when Klaviyo returns them. Lists are snapshotted for the London day, including `profile_count` when Klaviyo returns it. A second snapshot on a later day is what makes list growth visible. One snapshot shows the count and a blank change.

The key needs read access to metrics, flows, campaigns, lists, and reporting.

### Shopify

All of `SHOPIFY_SHOP`, `SHOPIFY_CLIENT_ID`, and `SHOPIFY_CLIENT_SECRET` are required. The shop must be a `*.myshopify.com` host.

Sync requests a client-credentials token from `https://{shop}/admin/oauth/access_token` and keeps it in memory until it expires. The token is not stored and not logged. Orders are read with Admin GraphQL `2025-10`, newest first, for about 18 months, non-cancelled. The app stops at 3,000 orders and says the set is incomplete.

The Dev Dashboard app needs the Admin scopes `read_orders` and `read_customers` (the customer id is on the order). Orders with no customer are stored only so they can be counted as excluded. Repeat rate and cohorts use orders that have a customer id. No names or email addresses are stored.

## Ingest

`POST /api/v1/ingest` with `Authorization: Bearer`.

- On `paidads.mailbakes.com`, the bearer must be `PAIDADS_API_TOKEN` and the body is Paid Ads rows.
- On `retention.mailbakes.com`, the bearer must be `RETENTION_API_TOKEN` and the body is Retention rows.
- On any other host, the token picks the app. You can also post to `/paidads/api/v1/ingest` or `/retention/api/v1/ingest`.

Paid Ads body. Rows are upserted. Spend, revenue, and orders are required so a missing figure is not stored as zero. `impressions` and `clicks` may be omitted.

```bash
curl -s https://paidads.mailbakes.com/api/v1/ingest \
  -H "Authorization: Bearer $PAIDADS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"platform":"meta","currency":"GBP","rows":[{"date":"2026-10-22","level":"campaign","campaignId":"1","campaignName":"Prospecting","spend":12.5,"revenue":40,"orders":2}]}'
```

`platform` is `meta` or `google`. `level` is `account`, `campaign`, or `adset`.

Retention body. Sending flows replaces ingest flows for the windows in the payload (`7d` or `30d`). The same applies to campaigns. Lists are snapshotted by id and `capturedOn`. Orders are upserted. `"replaceOrders": true` deletes ingest orders that are not in the payload. Omitted metrics stay null.

```bash
curl -s https://retention.mailbakes.com/api/v1/ingest \
  -H "Authorization: Bearer $RETENTION_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"flows":[{"id":"F1","name":"Welcome","window":"30d","revenue":19.99,"currency":"GBP","opens":10,"delivered":40,"clicks":4,"unsubscribes":1}],"lists":[{"id":"L1","name":"Newsletter","capturedOn":"2026-10-23","profiles":1200}],"orders":[{"id":"o1","customerId":"c1","orderedOn":"2026-10-01","total":24,"currency":"GBP"}]}'
```

If a token is missing, the API says setup is needed and does not guess. If the two tokens are the same string, ingest refuses both.
