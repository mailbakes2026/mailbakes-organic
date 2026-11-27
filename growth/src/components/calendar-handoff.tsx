export function CalendarHandoff({ tokenConfigured }: { tokenConfigured: boolean }) {
  return (
    <details className="card cal-handoff">
      <summary>API / Claude handoff</summary>
      <p>
        Base URL <code>https://retention.mailbakes.com</code>. The same paths work on this site. Sign in and the browser session is enough. From Claude or a script, send{" "}
        <code>Authorization: Bearer</code> with <code>RETENTION_API_TOKEN</code>
        {tokenConfigured ? " (set on this service)" : " (not set on this service yet)"} and <code>X-MailBakes-Actor: Claude</code>. That token is the same one used for Retention ingest. It is not a new variable, and this page never shows the value.
      </p>
      <p className="muted small">Rates are fractions: 58% is 0.58, and 0.59% is 0.0059. Money in a results object can be <code>revenuePence</code> or a decimal <code>revenue</code> string such as <code>&quot;1170.00&quot;</code>. Times are 24-hour Europe/London.</p>
      <pre>{`curl -s https://retention.mailbakes.com/api/retention/calendar?week=2026-11-23 \\
  -H "Authorization: Bearer $RETENTION_API_TOKEN"

curl -s https://retention.mailbakes.com/api/retention/calendar/campaigns \\
  -H "Authorization: Bearer $RETENTION_API_TOKEN" \\
  -H "X-MailBakes-Actor: Claude" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Plain letter from you","status":"planned","channel":"email","sendDate":"2026-11-29","timeLabel":"Daytime","cardNote":"Sunday letter"}'

curl -s -X PATCH https://retention.mailbakes.com/api/retention/calendar/campaigns/CAMPAIGN_ID \\
  -H "Authorization: Bearer $RETENTION_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"status":"scheduled","subject":"It'\\''s back","klaviyoCampaignId":"01ABCDE2FG3HIJKLMN4OPQRSTU"}'

curl -s -X POST https://retention.mailbakes.com/api/retention/calendar/campaigns/CAMPAIGN_ID/designs \\
  -H "Authorization: Bearer $RETENTION_API_TOKEN" \\
  -H "X-MailBakes-Actor: Claude" \\
  -F "file=@design.png"

curl -s -X POST https://retention.mailbakes.com/api/retention/calendar/campaigns/CAMPAIGN_ID/reviews \\
  -H "Authorization: Bearer $RETENTION_API_TOKEN" \\
  -H "X-MailBakes-Actor: Millie" \\
  -H "Content-Type: application/json" \\
  -d '{"body":"Headline is good.","verdict":"approved","status":"scheduled","author":"Millie"}'

curl -s -X POST https://retention.mailbakes.com/api/retention/calendar/sync \\
  -H "Authorization: Bearer $RETENTION_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"week":"2026-11-23"}'`}</pre>
      <ul className="steps">
        <li>GET /api/retention/calendar?week=2026-11-23, or ?from=2026-11-23&amp;to=2026-12-25 (120 days or fewer).</li>
        <li>POST /api/retention/calendar/campaigns, then GET, PATCH, or DELETE /api/retention/calendar/campaigns/:id.</li>
        <li>POST /api/retention/calendar/offers, then PATCH or DELETE /api/retention/calendar/offers/:id.</li>
        <li>POST /api/retention/calendar/tags with date and label. DELETE /api/retention/calendar/tags/:id.</li>
        <li>POST /api/retention/calendar/campaigns/:id/designs as multipart, field name file. GET or DELETE /api/retention/calendar/designs/:id.</li>
        <li>POST /api/retention/calendar/campaigns/:id/reviews. DELETE /api/retention/calendar/reviews/:id.</li>
        <li>POST /api/retention/calendar/sync with week, from and to, or campaignId. An empty body syncs the current London week.</li>
      </ul>
    </details>
  );
}
