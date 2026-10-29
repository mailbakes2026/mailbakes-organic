# MailBakes personal

Millie Barrow's command centre: the inbox, the diary, reminders, the run-through, and briefings she goes through with her PA.

It is a separate app from organic social. It has its own database and its own Render service. Nothing is archived or forwarded unless a button is pressed.

## Pages

- **Inbox** groups mail that needs attention into MailBakes, suppliers, invoices and personal. Refresh reads Gmail. Archive removes the inbox label (the mail stays in All Mail). Send to finance, on an invoice only, forwards it with its attachments, adds the label "Sent to finance", and archives it.
- **Calendar** is a week view (Monday to Sunday) of Millie's own appointments and her Google Calendar together.
  - Add, change and delete appointments here. They are saved in this app's database and are **never written to Google Calendar**. Google events are shown striped and read-only, with a link to open them in Google.
  - Each appointment has a type (Hair, Aesthetics, Work, Meeting, Meal, Party, Dinner, Travel, Other) with its own colour. Tap a type in the key to hide or show it.
  - All-day appointments can run across several days (a trip), drawn as one bar across the week.
  - Optional email reminder: the morning of (7am), the day before (6pm), or both. Sent from Millie's Gmail to herself by the `mailbakes-personal-reminders` cron job. A missed run never sends late reminders: each one is only sent inside its own window.
- **Reminders** can be added, ticked off, or snoozed. Today is Europe/London.
- **Run-through** is open follow-ups (waiting, needs Millie, done), with notes and a link to the email.
- **Briefings** are markdown notes by date.
- **Payslips** keeps a name and a Google Drive folder for each person. It finds Paul's latest "Payslips" email, matches each PDF by the file name, and shows anything unmatched or missing. **Send payslips** uploads each PDF into that person's folder, skipping a file that is already there, and can email the PDFs to Jess as a new message. Paul's thread is never forwarded. Bank details, phone numbers and emergency contacts are not read out of the PDFs or put in the email.

Sign-in is one password, `APP_PASSWORD`.

## Appointments API

Signed in, the calendar uses `/api/board/appointments`. The assistant uses the same routes under `/api/v1/` with `Authorization: Bearer $PERSONAL_API_TOKEN`.

| Call | What it does |
| --- | --- |
| `GET /api/v1/appointments?from=2026-11-01&to=2026-11-30` | Appointments touching those dates. Both are optional. |
| `POST /api/v1/appointments` | Add one. Body: `title`, `type`, `startDay` (YYYY-MM-DD), then either `allDay: true` with optional `endDay`, or `startTime` (HH:MM) with optional `endTime` (default one hour). Optional `location`, `notes`, `reminder` (`none`, `morning`, `day-before`, `both`). |
| `PATCH /api/v1/appointments/:id` | Change only the fields sent. Moving it or changing the reminder lets reminders go again. |
| `DELETE /api/v1/appointments/:id` | Delete it. |
| `POST /api/v1/appointments/import` | Bulk add: `{ "appointments": [...] }`, up to 200. All rows are checked first; one bad row saves nothing and the answer names the row. A row with the same title, date and start time as a saved one is skipped, so it is safe to run twice. |
| `POST /api/v1/appointments/send-reminders` | Sends any reminders due now. The cron job calls this every 15 minutes. |

Load the saved list once after deploying:

```bash
curl -X POST https://personal.mailbakes.com/api/v1/appointments/import \
  -H "Authorization: Bearer $PERSONAL_API_TOKEN" -H "Content-Type: application/json" \
  --data @scripts/appointments-import.json
```

## Local

Node 20+ and PostgreSQL.

```bash
cd personal
cp .env.example .env
npm install
npx prisma migrate deploy
npm run dev
```

Open http://127.0.0.1:3000 and sign in with `APP_PASSWORD`.

## Deploy on Render

The service name `mailbakes-personal` becomes https://mailbakes-personal.onrender.com

Use a new blueprint whose path is `personal/render.yaml`. That file defines only `mailbakes-personal` (Starter, `rootDir: personal`) and `mailbakes-personal-db` (`basic-256mb`). The root `render.yaml` is organic social only. Do not sync that existing blueprint for this app: it would point Render at the live organic service.

1. Push this repo.
2. In Render, choose **New → Blueprint**, select this repo, and set the blueprint path to `personal/render.yaml`.
3. When asked, set `APP_PASSWORD`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `PERSONAL_API_TOKEN`. Leave `SESSION_SECRET` and `TOKEN_ENCRYPTION_KEY` on Render's generated values. `SUPPLIER_DOMAINS` is already blank.
4. Deploy. The first boot runs the database migration.
5. If `mailbakes-personal` is already taken, change `name` and the `APP_URL` value to the same new name, then sync again. The public URL is `https://<name>.onrender.com`.

The web service plan is `starter` and the database is `basic-256mb` in Frankfurt, matching organic social.

## Environment

| Variable | Who sets it | Purpose |
| --- | --- | --- |
| `APP_PASSWORD` | Millie | Sign-in password. At least 10 characters. |
| `SESSION_SECRET` | Render generates | Signs the sign-in cookie. At least 32 characters. |
| `TOKEN_ENCRYPTION_KEY` | Render generates | Encrypts the Google refresh token. At least 32 characters. |
| `APP_URL` | Blueprint | `https://mailbakes-personal.onrender.com` |
| `DATABASE_URL` | Blueprint, from the database | Postgres connection. |
| `GOOGLE_CLIENT_ID` | Millie | Google Cloud OAuth client id. |
| `GOOGLE_CLIENT_SECRET` | Millie | Google Cloud OAuth client secret. |
| `FINANCE_EMAIL` | Blueprint, change if needed | Default `accounts@mailbakes.com`. |
| `PAUL_EMAIL` | Blueprint | Who sends the weekly payslips. Default `accounts@mailbakes.com`. |
| `JESS_EMAIL` | Blueprint | Who can be emailed the PDFs. Default `operations@mailbakes.com`. |
| `GMAIL_ADDRESS` | Optional | Defaults to `millie@mailbakes.com`. Shown as the account to connect. |
| `PERSONAL_API_TOKEN` | Millie | Bearer token for the assistant API. At least 16 characters. |
| `SUPPLIER_DOMAINS` | Blueprint, optional | Blank by default. Comma-separated domains grouped as Suppliers. |
| `PERSONAL_CALENDAR_NAMES` | Optional | Default `personal,home,private,family`. Calendar names containing one of these go in the Personal column. Everything else is MailBakes. |
| `APP_NAME` | Optional | Default `Millie`. |

Until Google is configured the app shows **Setup needed** and the Connect Google button stays disabled.

## Google OAuth

In [Google Cloud Console](https://console.cloud.google.com/):

1. Create a project, or use the MailBakes one.
2. Enable the **Gmail API** and the **Google Calendar API**.
3. Configure the OAuth consent screen. Add `millie@mailbakes.com` as a test user while the app is in testing. Drive is a sensitive scope, so Google will ask Millie to allow it.
4. Create an OAuth client of type **Web application**.
5. Authorised redirect URI:

```
https://mailbakes-personal.onrender.com/api/google/callback
```

Locally that is `http://127.0.0.1:3000/api/google/callback` (or whatever `APP_URL` is). The app also prints the redirect URL on the Setup needed banner.

6. Enable the **Google Drive API** as well as Gmail and Calendar.
7. Put the client id and secret in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
8. Scopes the app requests:

- `https://www.googleapis.com/auth/gmail.modify` (read the inbox, archive, add a label)
- `https://www.googleapis.com/auth/gmail.send` (a new email when Send to finance or Send payslips is pressed)
- `https://www.googleapis.com/auth/calendar.readonly`
- `https://www.googleapis.com/auth/drive` (file a payslip into a folder Millie pasted a link for)

`drive.file` only sees files the app created. The staff folders already exist, and they are chosen by link, so the app asks for Drive access. If Google was connected before Drive was added, press **Connect Google again**.

9. Redeploy, sign in, and press **Connect Google**. Choose `millie@mailbakes.com`.

The refresh token is encrypted before it is stored. Disconnect removes it and the saved inbox snapshot.

Refresh only reads mail. Archive and Send to finance run only from those buttons. Send to finance asks you to confirm, and the server refuses it for anything that is not an invoice.

## Assistant API

Set `PERSONAL_API_TOKEN` to a long random string (`openssl rand -base64 32`). The token is not shown in the app. Give it to the PA's assistant, not in an email thread if you can avoid it.

Send `Authorization: Bearer <token>`. The API can add and update reminders, run-through items and briefings. It cannot read Gmail, archive, forward, or file payslips.

```bash
curl -s https://mailbakes-personal.onrender.com/api/v1/items \
  -H "Authorization: Bearer $PERSONAL_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Waiting on the flour quote","status":"waiting","notes":"Chased Monday","emailUrl":"https://mail.google.com/mail/u/0/#inbox/abc"}'

curl -s https://mailbakes-personal.onrender.com/api/v1/reminders \
  -H "Authorization: Bearer $PERSONAL_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Sign the packaging contract","dueOn":"2026-10-22"}'

curl -s https://mailbakes-personal.onrender.com/api/v1/briefings \
  -H "Authorization: Bearer $PERSONAL_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-10-21","title":"Tuesday","body":"## Waiting on\n- Flour quote"}'
```

Collections:

- `GET` and `POST /api/v1/items`, `GET`, `PATCH` and `DELETE /api/v1/items/:id`
- `GET` and `POST /api/v1/reminders`, `GET`, `PATCH` and `DELETE /api/v1/reminders/:id`
- `GET` and `POST /api/v1/briefings`, `GET`, `PATCH` and `DELETE /api/v1/briefings/:id`

Status is `waiting`, `needs Millie`, or `done`. Dates are `YYYY-MM-DD`. A reminder snoozes with `"snooze": "later"`, `"tomorrow"` or `"week"`, or `"snoozedUntil": "2026-10-25"`. Tick one off with `{"done": true}`.

If `PERSONAL_API_TOKEN` is missing, the API responds with setup needed and does not accept a guess.

## Grouping

Invoices mention an invoice, receipt, credit note, remittance, or payment due, including in an attachment name. Suppliers mention an order, dispatch, delivery note, or wholesale, or the sender's domain is in `SUPPLIER_DOMAINS`. An invoice from a supplier stays under Invoices, so Send to finance is available. MailBakes is other mail from `@mailbakes.com` or that mentions MailBakes. Everything else is personal.

## Extra inboxes

The Inbox can show more than the work Google login. Open **Inbox → Inboxes**.

- **Personal Gmail**: uses IMAP with a Google *app password* (myaccount.google.com/apppasswords, 2-Step Verification on). The password is encrypted with TOKEN_ENCRYPTION_KEY. No Google Cloud changes needed.
- **Outlook / Hotmail**: uses Microsoft Graph. Register an app in Azure (Entra) → App registrations, supported account types "personal Microsoft accounts and any organisational directory", web redirect `APP_URL/api/microsoft/callback`, delegated permissions `Mail.ReadWrite`, `User.Read`, `offline_access`. Put the client id and a client secret in `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`.

Refresh reads every inbox (latest 50 each). Archive moves Gmail mail to All Mail and Outlook mail to Archive. Send to finance stays work-only. Removing an inbox only clears it from the app.

## Phone notifications

Open **Notifications** in the home-screen app and press **Turn on notifications** (iPhone needs iOS 16.4+ and the app added to the home screen). Push keys are created automatically and stored encrypted.

Other apps send notifications with the same token as the debriefs:

```
POST /api/v1/notify   Authorization: Bearer PERSONAL_API_TOKEN
{ "source": "team", "title": "Sam called in sick", "body": "...", "url": "https://...", "key": "sick:42",
  "debrief": { "title": "...", "lines": ["..."] } }
```

Sources: operations, orders, team, organic, finance, conversion, inbox, reminders, appointments, other. The same `key` again updates the text without buzzing twice. `debrief` (optional) also files it in the Diary. Each source can be muted on the Notifications page. The 15-minute cron raises appointment and daily-reminder notifications itself.
