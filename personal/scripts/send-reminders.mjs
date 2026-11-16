// Run by the Render cron job every 15 minutes. Asks the Personal app to email
// any appointment reminders that are due. Needs APP_URL and PERSONAL_API_TOKEN.
const base = (process.env.APP_URL || "").replace(/\/$/, "");
const token = process.env.PERSONAL_API_TOKEN || "";
if (!base || !token) {
  console.error("Set APP_URL and PERSONAL_API_TOKEN.");
  process.exit(1);
}
const response = await fetch(`${base}/api/v1/appointments/send-reminders`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
});
const body = await response.text();
console.log(response.status, body);
if (!response.ok) process.exit(1);
