import { addDays, eachDate, formatDay, londonToday, londonWeekStart, mondayOf, parseDateOnly } from "@/lib/dates";
import { formatCount } from "@/lib/format";
import { toCount, toPence } from "@/lib/money";

export const STATUSES = ["sent", "scheduled", "built", "planned", "skipped", "task"] as const;
export type Status = (typeof STATUSES)[number];

export const CHANNELS = ["email", "sms", "task"] as const;
export type Channel = (typeof CHANNELS)[number];

export const TONES = ["pink", "plum"] as const;
export type Tone = (typeof TONES)[number];

export const VERDICTS = ["comment", "approved", "changes_requested"] as const;
export type Verdict = (typeof VERDICTS)[number];

export const STATUS_LABEL: Record<Status, string> = {
  sent: "Sent",
  scheduled: "Scheduled",
  built: "Built, needs your OK",
  planned: "Planned",
  skipped: "Skipped",
  task: "Task",
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  email: "Email",
  sms: "SMS",
  task: "Task",
};

export const VERDICT_LABEL: Record<Verdict, string> = {
  comment: "Comment",
  approved: "Approved",
  changes_requested: "Changes requested",
};

export const KLAVIYO_ATTRIBUTION_DETAIL =
  "Orders, revenue, conversion rate, and average order value are Klaviyo's attributed Placed Order figures for this campaign. Klaviyo does not return the attribution model on the API. New accounts default to last-touch. The windows in use are under Settings, then Attribution, in Klaviyo.";

const NAMED_WEEKS: Record<string, string> = {
  "2026-11-23": "Black Friday week",
  "2026-11-30": "Cyber Monday week",
  "2026-12-21": "Christmas week",
};

export type ResultsJson = {
  openRate: number | null;
  clickRate: number | null;
  revenuePence: number | null;
  orders: number | null;
  recipients: number | null;
  delivered: number | null;
  opens: number | null;
  clicks: number | null;
  unsubscribes: number | null;
  unsubscribeRate: number | null;
  bounces: number | null;
  bounceRate: number | null;
  spamComplaints: number | null;
  spamRate: number | null;
  conversionRate: number | null;
  aovPence: number | null;
  currency: string;
  attributionModel: string;
  attributionDetail: string;
  source: string;
  syncedAt: string | null;
  error: string;
};

export type DesignJson = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  createdAt: string;
};

export type ReviewJson = {
  id: string;
  author: string;
  body: string;
  verdict: Verdict;
  createdAt: string;
};

export type CampaignJson = {
  id: string;
  title: string;
  status: Status;
  channel: Channel;
  sendDate: string;
  sendTime: string;
  timeLabel: string;
  subject: string;
  previewText: string;
  audience: string;
  audienceSize: number | null;
  smartSending: boolean | null;
  offerCode: string;
  klaviyoCampaignId: string;
  klaviyoUrl: string | null;
  notes: string;
  cardNote: string;
  sort: number;
  results: ResultsJson;
  designs: DesignJson[];
  reviews: ReviewJson[];
  updatedAt: string;
};

export type OfferJson = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  tone: Tone;
  sort: number;
};

export type TagJson = { id: string; date: string; label: string };

export type DayJson = {
  date: string;
  weekday: string;
  month: string;
  day: number;
  tags: TagJson[];
  campaigns: CampaignJson[];
};

export type RollupJson = {
  revenuePence: number | null;
  orders: number | null;
  openRate: number | null;
  clickRate: number | null;
  counted: number;
  currency: string;
  mixedCurrency: boolean;
};

export type WeekJson = {
  from: string;
  to: string;
  title: string;
  rangeLabel: string;
  today: string;
  klaviyoConnected: boolean;
  tokenConfigured: boolean;
  days: DayJson[];
  offers: OfferJson[];
  rollup: RollupJson;
};

export function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

export function isChannel(value: unknown): value is Channel {
  return typeof value === "string" && (CHANNELS as readonly string[]).includes(value);
}

export function isTone(value: unknown): value is Tone {
  return typeof value === "string" && (TONES as readonly string[]).includes(value);
}

export function isVerdict(value: unknown): value is Verdict {
  return typeof value === "string" && (VERDICTS as readonly string[]).includes(value);
}

export function calendarActorName(header: string | null) {
  return cleanName(header ?? "") ?? "API";
}

export function cleanName(value: unknown) {
  if (typeof value !== "string") return null;
  if (/[\u0000-\u001F\u007F]/.test(value)) return null;
  const text = value.trim().replace(/ {2,}/g, " ");
  if (!/^[\p{L}\p{N}][\p{L}\p{N} .'-]{0,39}$/u.test(text)) return null;
  return text;
}

function cleanText(value: unknown, max: number) {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/\r\n/g, "\n").trim();
  if (text.length > max) return undefined;
  return text;
}

function hasOwn(record: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function calendarRange(query: { week?: string | null; from?: string | null; to?: string | null }, now = new Date()) {
  const week = query.week?.trim() ?? "";
  if (week) {
    if (!parseDateOnly(week)) return { ok: false as const, error: "Week must be a date, such as 2026-11-23." };
    const start = mondayOf(week);
    return { ok: true as const, from: start, to: addDays(start, 6) };
  }
  const from = query.from?.trim() ?? "";
  const to = query.to?.trim() ?? "";
  if (from || to) {
    if (!parseDateOnly(from) || !parseDateOnly(to)) {
      return { ok: false as const, error: "From and to must be dates, such as 2026-11-23." };
    }
    if (from > to) return { ok: false as const, error: "From must be on or before to." };
    if (eachDate(from, to).length > 120) return { ok: false as const, error: "Ask for 120 days or fewer." };
    return { ok: true as const, from, to };
  }
  const start = londonWeekStart(now);
  return { ok: true as const, from: start, to: addDays(start, 6) };
}

export function rangeTitle(from: string, to: string) {
  if (addDays(from, 6) === to) return NAMED_WEEKS[from] ?? `Week of ${formatDay(from)}`;
  return `${formatDay(from)} to ${formatDay(to)}`;
}

export function formatWeekRange(from: string, to: string, now = new Date()) {
  const start = parseDateOnly(from);
  const end = parseDateOnly(to);
  if (!start || !end) return `${from} to ${to}`;
  const weekday = (date: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" }).format(date);
  const month = (date: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long" }).format(date);
  const thisYear = Number(londonToday(now).slice(0, 4));
  const showYear = start.getUTCFullYear() !== thisYear || start.getUTCFullYear() !== end.getUTCFullYear();
  const year = showYear ? ` ${end.getUTCFullYear()}` : "";
  if (start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${weekday(start)} ${start.getUTCDate()} to ${weekday(end)} ${end.getUTCDate()} ${month(end)}${year}`;
  }
  return `${weekday(start)} ${start.getUTCDate()} ${month(start)} to ${weekday(end)} ${end.getUTCDate()} ${month(end)}${year}`;
}

export function dayParts(date: string) {
  const parsed = parseDateOnly(date);
  if (!parsed) return { weekday: "", month: "", day: 0 };
  return {
    weekday: new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" }).format(parsed),
    month: new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "short" }).format(parsed),
    day: parsed.getUTCDate(),
  };
}

export function formatClock(sendTime: string, timeLabel: string) {
  const label = timeLabel.trim();
  if (label) return label;
  const match = /^(\d{2}):(\d{2})$/.exec(sendTime);
  if (!match) return "Daytime";
  let hour = Number(match[1]);
  const minute = match[2] ?? "00";
  const suffix = hour >= 12 ? "pm" : "am";
  hour %= 12;
  if (hour === 0) hour = 12;
  if (minute === "00") return `${hour}${suffix}`;
  return `${hour}:${minute}${suffix}`;
}

export function formatCalendarRate(ratio: number | null) {
  if (ratio === null || !Number.isFinite(ratio)) return null;
  const pct = ratio * 100;
  if (pct !== 0 && Math.abs(pct) < 1) return `${pct.toFixed(2)}%`;
  return `${pct.toFixed(1)}%`;
}

export function formatPounds(pence: number) {
  const whole = pence % 100 === 0;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(pence / 100);
}

export function formatMoneyPence(pence: number, currency: string) {
  const code = /^[A-Z]{3}$/.test(currency) ? currency : "GBP";
  if (code === "GBP") return formatPounds(pence);
  const whole = pence % 100 === 0;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: code,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(pence / 100);
}

export function resultsLine(row: {
  openRate: number | null;
  clickRate: number | null;
  revenuePence: number | null;
  orders: number | null;
  currency: string;
  cardNote: string;
}) {
  const parts: string[] = [];
  const open = formatCalendarRate(row.openRate);
  const click = formatCalendarRate(row.clickRate);
  if (open) parts.push(`${open} open`);
  if (click) parts.push(`${click} click`);
  const money = row.revenuePence === null ? null : formatMoneyPence(row.revenuePence, row.currency);
  const orders = row.orders === null ? null : formatCount(row.orders);
  if (money && orders) parts.push(`${money} from ${orders} orders`);
  else if (money) parts.push(money);
  else if (orders) parts.push(`${orders} orders`);
  if (parts.length) return parts.join(", ");
  return row.cardNote;
}

export function offerSpan(offer: { startDate: string; endDate: string }, from: string, to: string) {
  const start = offer.startDate > from ? offer.startDate : from;
  const end = offer.endDate < to ? offer.endDate : to;
  const days = eachDate(from, to);
  const startIndex = days.indexOf(start);
  const endIndex = days.indexOf(end);
  if (startIndex < 0 || endIndex < startIndex) return null;
  return { startIndex, endIndex, span: endIndex - startIndex + 1, columns: days.length };
}

type RateRow = {
  openRate: number | null;
  clickRate: number | null;
  revenuePence: number | null;
  orders: number | null;
  delivered: number | null;
  currency: string;
};

function averageRate(rows: RateRow[], key: "openRate" | "clickRate") {
  const usable = rows.filter((row) => row[key] !== null);
  if (!usable.length) return null;
  const weighted = usable.every((row) => row.delivered !== null && (row.delivered ?? 0) > 0);
  if (weighted) {
    const weight = usable.reduce((sum, row) => sum + (row.delivered ?? 0), 0);
    const acc = usable.reduce((sum, row) => sum + (row[key] ?? 0) * (row.delivered ?? 0), 0);
    return weight > 0 ? acc / weight : null;
  }
  return usable.reduce((sum, row) => sum + (row[key] ?? 0), 0) / usable.length;
}

export function rollup(rows: RateRow[]): RollupJson {
  const withMoney = rows.filter((row) => row.revenuePence !== null);
  const currencies = [...new Set(withMoney.map((row) => (/^[A-Z]{3}$/.test(row.currency) ? row.currency : "GBP")))];
  const mixed = currencies.length > 1;
  const withOrders = rows.filter((row) => row.orders !== null);
  return {
    revenuePence: mixed || !withMoney.length ? null : withMoney.reduce((sum, row) => sum + (row.revenuePence ?? 0), 0),
    orders: withOrders.length ? withOrders.reduce((sum, row) => sum + (row.orders ?? 0), 0) : null,
    openRate: averageRate(rows, "openRate"),
    clickRate: averageRate(rows, "clickRate"),
    counted: rows.filter((row) => row.openRate !== null || row.clickRate !== null || row.revenuePence !== null || row.orders !== null).length,
    currency: currencies.length === 1 ? (currencies[0] ?? "GBP") : "GBP",
    mixedCurrency: mixed,
  };
}

export function reportWindow(dates: string[], now = new Date()) {
  const valid = dates.filter((date) => parseDateOnly(date)).sort();
  if (!valid.length) return { key: "last_12_months" as const };
  const start = addDays(valid[0] ?? "", -1);
  let end = addDays(valid[valid.length - 1] ?? "", 21);
  const today = londonToday(now);
  if (end < today) end = today;
  if (end > addDays(start, 360)) return { key: "last_12_months" as const };
  return { start: `${start}T00:00:00+00:00`, end: `${end}T23:59:59+00:00` };
}

export function klaviyoCampaignUrl(id: string) {
  if (!/^[A-Za-z0-9]{6,32}$/.test(id)) return null;
  return `https://www.klaviyo.com/campaign/${id}/reports/overview`;
}

export type SetupInput = {
  title: string;
  status: Status;
  channel: Channel;
  sendDate: string;
  sendTime: string;
  timeLabel: string;
  subject: string;
  previewText: string;
  audience: string;
  audienceSize: number | null;
  smartSending: boolean | null;
  offerCode: string;
  klaviyoCampaignId: string;
  notes: string;
  cardNote: string;
  sort: number;
};

const SETUP_KEYS = [
  "title",
  "status",
  "channel",
  "sendDate",
  "sendTime",
  "timeLabel",
  "subject",
  "previewText",
  "audience",
  "audienceSize",
  "smartSending",
  "offerCode",
  "klaviyoCampaignId",
  "notes",
  "cardNote",
  "sort",
] as const;

export function readSetup(value: unknown, mode: "create" | "patch") {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  if (!record) return { ok: false as const, error: "Send a JSON object." };
  const data: Partial<SetupInput> = {};

  if (hasOwn(record, "title") || mode === "create") {
    const title = cleanText(record.title, 180);
    if (!title) return { ok: false as const, error: "Give the send a name, up to 180 characters." };
    data.title = title;
  }
  if (hasOwn(record, "status") || mode === "create") {
    const status = record.status === undefined && mode === "create" ? "planned" : record.status;
    if (!isStatus(status)) return { ok: false as const, error: "Status must be sent, scheduled, built, planned, skipped, or task." };
    data.status = status;
  }
  if (hasOwn(record, "channel") || mode === "create") {
    const channel = record.channel === undefined && mode === "create" ? "email" : record.channel;
    if (!isChannel(channel)) return { ok: false as const, error: "Channel must be email, sms, or task." };
    data.channel = channel;
  }
  if (hasOwn(record, "sendDate") || mode === "create") {
    const sendDate = typeof record.sendDate === "string" ? record.sendDate.trim() : "";
    if (!parseDateOnly(sendDate)) return { ok: false as const, error: "Send date must be a date, such as 2026-11-27." };
    data.sendDate = sendDate;
  }
  if (hasOwn(record, "sendTime") || mode === "create") {
    const sendTime = typeof record.sendTime === "string" ? record.sendTime.trim() : "";
    if (sendTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(sendTime)) {
      return { ok: false as const, error: "Send time must be 24-hour HH:MM in Europe/London, or blank for daytime." };
    }
    data.sendTime = sendTime;
  }
  if (hasOwn(record, "timeLabel") || mode === "create") {
    const timeLabel = cleanText(typeof record.timeLabel === "string" ? record.timeLabel : "", 40);
    if (timeLabel === undefined) return { ok: false as const, error: "Time label must be 40 characters or fewer." };
    data.timeLabel = timeLabel;
  }
  const textFields = [
    ["subject", 300, "Subject"],
    ["previewText", 500, "Preview text"],
    ["audience", 2000, "Audience"],
    ["notes", 8000, "Notes"],
    ["cardNote", 400, "Card note"],
  ] as const;
  for (const [key, max, label] of textFields) {
    if (hasOwn(record, key) || mode === "create") {
      const text = cleanText(typeof record[key] === "string" ? record[key] : "", max);
      if (text === undefined) return { ok: false as const, error: `${label} must be ${max} characters or fewer.` };
      data[key] = text;
    }
  }
  if (hasOwn(record, "audienceSize") || mode === "create") {
    if (record.audienceSize === null || record.audienceSize === undefined || record.audienceSize === "") data.audienceSize = null;
    else {
      const count = toCount(record.audienceSize);
      if (count === null || count > 10_000_000) return { ok: false as const, error: "Audience size must be a whole number, or blank." };
      data.audienceSize = count;
    }
  }
  if (hasOwn(record, "smartSending") || mode === "create") {
    if (record.smartSending === null || record.smartSending === undefined || record.smartSending === "") data.smartSending = null;
    else if (typeof record.smartSending === "boolean") data.smartSending = record.smartSending;
    else return { ok: false as const, error: "Smart Sending must be true, false, or blank." };
  }
  if (hasOwn(record, "offerCode") || mode === "create") {
    const offerCode = typeof record.offerCode === "string" ? record.offerCode.trim() : "";
    if (offerCode && !/^[A-Za-z0-9][A-Za-z0-9 _-]{0,39}$/.test(offerCode)) {
      return { ok: false as const, error: "Offer code must be letters, numbers, spaces, or hyphens." };
    }
    data.offerCode = offerCode;
  }
  if (hasOwn(record, "klaviyoCampaignId") || mode === "create") {
    const klaviyoCampaignId = typeof record.klaviyoCampaignId === "string" ? record.klaviyoCampaignId.trim() : "";
    if (klaviyoCampaignId && !/^[A-Za-z0-9]{6,32}$/.test(klaviyoCampaignId)) {
      return { ok: false as const, error: "Klaviyo campaign ID must be 6 to 32 letters or numbers, or blank." };
    }
    data.klaviyoCampaignId = klaviyoCampaignId;
  }
  if (hasOwn(record, "sort") || mode === "create") {
    const sort = record.sort === undefined ? 0 : record.sort;
    if (typeof sort !== "number" || !Number.isInteger(sort) || sort < 0 || sort > 10_000) {
      return { ok: false as const, error: "Sort must be a whole number from 0 to 10000." };
    }
    data.sort = sort;
  }
  if (mode === "patch" && !SETUP_KEYS.some((key) => hasOwn(record, key))) {
    return { ok: false as const, error: "Send at least one field to update." };
  }
  return { ok: true as const, data: data as SetupInput };
}

const RESULT_RATES = ["openRate", "clickRate", "unsubscribeRate", "bounceRate", "spamRate", "conversionRate"] as const;
const RESULT_COUNTS = ["orders", "recipients", "delivered", "opens", "clicks", "unsubscribes", "bounces", "spamComplaints"] as const;

export type ResultsPatch = {
  openRate?: number | null;
  clickRate?: number | null;
  unsubscribeRate?: number | null;
  bounceRate?: number | null;
  spamRate?: number | null;
  conversionRate?: number | null;
  orders?: number | null;
  recipients?: number | null;
  delivered?: number | null;
  opens?: number | null;
  clicks?: number | null;
  unsubscribes?: number | null;
  bounces?: number | null;
  spamComplaints?: number | null;
  revenuePence?: number | null;
  aovPence?: number | null;
  currency?: string;
  attributionModel?: string;
  attributionDetail?: string;
};

export function readResults(value: unknown) {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  if (!record) return { ok: false as const, error: "Send a results object." };
  const data: ResultsPatch = {};
  for (const key of RESULT_RATES) {
    if (!hasOwn(record, key)) continue;
    if (record[key] === null || record[key] === "") {
      data[key] = null;
      continue;
    }
    if (typeof record[key] !== "number" || !Number.isFinite(record[key]) || (record[key] as number) < 0) {
      return { ok: false as const, error: `${key} must be a fraction from 0 to 1, such as 0.58 for 58%.` };
    }
    if ((record[key] as number) > 1) {
      return { ok: false as const, error: `${key} must be a fraction from 0 to 1. 58% is 0.58.` };
    }
    data[key] = record[key] as number;
  }
  for (const key of RESULT_COUNTS) {
    if (!hasOwn(record, key)) continue;
    if (record[key] === null || record[key] === "") {
      data[key] = null;
      continue;
    }
    const count = toCount(record[key]);
    if (count === null) return { ok: false as const, error: `${key} must be a whole number, or blank.` };
    data[key] = count;
  }
  if (hasOwn(record, "revenuePence") || hasOwn(record, "revenue")) {
    if ((record.revenuePence === null || record.revenuePence === "") && !hasOwn(record, "revenue")) data.revenuePence = null;
    else if (hasOwn(record, "revenuePence") && record.revenuePence !== undefined && record.revenuePence !== "") {
      const pence = toCount(record.revenuePence);
      if (pence === null) return { ok: false as const, error: "revenuePence must be a whole number of pence, or blank." };
      data.revenuePence = pence;
    } else if (hasOwn(record, "revenue")) {
      if (record.revenue === null || record.revenue === "") data.revenuePence = null;
      else {
        const pence = toPence(typeof record.revenue === "number" ? record.revenue.toFixed(2) : record.revenue);
        if (pence === null || pence < 0) return { ok: false as const, error: "revenue must be a decimal amount, such as 1170.00." };
        data.revenuePence = pence;
      }
    }
  }
  if (hasOwn(record, "aovPence") || hasOwn(record, "aov")) {
    if (hasOwn(record, "aovPence") && (record.aovPence === null || record.aovPence === "")) data.aovPence = null;
    else if (hasOwn(record, "aovPence") && record.aovPence !== undefined && record.aovPence !== "") {
      const pence = toCount(record.aovPence);
      if (pence === null) return { ok: false as const, error: "aovPence must be a whole number of pence, or blank." };
      data.aovPence = pence;
    } else if (hasOwn(record, "aov")) {
      if (record.aov === null || record.aov === "") data.aovPence = null;
      else {
        const pence = toPence(typeof record.aov === "number" ? record.aov.toFixed(2) : record.aov);
        if (pence === null || pence < 0) return { ok: false as const, error: "aov must be a decimal amount, such as 17.20." };
        data.aovPence = pence;
      }
    }
  }
  if (hasOwn(record, "currency")) {
    const currency = typeof record.currency === "string" ? record.currency.trim().toUpperCase() : "";
    if (!/^[A-Z]{3}$/.test(currency)) return { ok: false as const, error: "Currency must be a 3-letter code, such as GBP." };
    data.currency = currency;
  }
  if (hasOwn(record, "attributionModel")) {
    const attributionModel = cleanText(typeof record.attributionModel === "string" ? record.attributionModel : "", 200);
    if (attributionModel === undefined) return { ok: false as const, error: "Attribution model must be 200 characters or fewer." };
    data.attributionModel = attributionModel;
  }
  if (hasOwn(record, "attributionDetail")) {
    const attributionDetail = cleanText(typeof record.attributionDetail === "string" ? record.attributionDetail : "", 1000);
    if (attributionDetail === undefined) return { ok: false as const, error: "Attribution detail must be 1000 characters or fewer." };
    data.attributionDetail = attributionDetail;
  }
  if (!Object.keys(data).length) return { ok: false as const, error: "Send at least one results field." };
  return { ok: true as const, data };
}

export type OfferInput = { label: string; startDate: string; endDate: string; tone: Tone; sort: number };

export function readOffer(value: unknown, mode: "create" | "patch") {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  if (!record) return { ok: false as const, error: "Send a JSON object." };
  const data: Partial<OfferInput> = {};
  if (hasOwn(record, "label") || mode === "create") {
    const label = cleanText(record.label, 120);
    if (!label) return { ok: false as const, error: "Give the offer a label, up to 120 characters." };
    data.label = label;
  }
  if (hasOwn(record, "startDate") || mode === "create") {
    const startDate = typeof record.startDate === "string" ? record.startDate.trim() : "";
    if (!parseDateOnly(startDate)) return { ok: false as const, error: "Offer start must be a date, such as 2026-11-23." };
    data.startDate = startDate;
  }
  if (hasOwn(record, "endDate") || mode === "create") {
    const endDate = typeof record.endDate === "string" ? record.endDate.trim() : "";
    if (!parseDateOnly(endDate)) return { ok: false as const, error: "Offer end must be a date, such as 2026-11-30." };
    data.endDate = endDate;
  }
  if ((data.startDate && data.endDate && data.startDate > data.endDate) || (mode === "create" && data.startDate && data.endDate && data.startDate > data.endDate)) {
    return { ok: false as const, error: "Offer start must be on or before the end." };
  }
  if (hasOwn(record, "tone") || mode === "create") {
    const tone = record.tone === undefined && mode === "create" ? "pink" : record.tone;
    if (!isTone(tone)) return { ok: false as const, error: "Tone must be pink or plum." };
    data.tone = tone;
  }
  if (hasOwn(record, "sort") || mode === "create") {
    const sort = record.sort === undefined ? 0 : record.sort;
    if (typeof sort !== "number" || !Number.isInteger(sort) || sort < 0 || sort > 10_000) {
      return { ok: false as const, error: "Sort must be a whole number from 0 to 10000." };
    }
    data.sort = sort;
  }
  if (mode === "patch" && !Object.keys(data).length) return { ok: false as const, error: "Send at least one field to update." };
  return { ok: true as const, data: data as OfferInput };
}

export function readTag(value: unknown) {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  if (!record) return { ok: false as const, error: "Send a JSON object." };
  const date = typeof record.date === "string" ? record.date.trim() : "";
  const label = cleanText(record.label, 40);
  if (!parseDateOnly(date)) return { ok: false as const, error: "Tag date must be a date, such as 2026-11-27." };
  if (!label) return { ok: false as const, error: "Give the day a tag, up to 40 characters." };
  return { ok: true as const, data: { date, label } };
}

export function readReview(value: unknown) {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  if (!record) return { ok: false as const, error: "Send a JSON object." };
  const verdict = record.verdict === undefined ? "comment" : record.verdict;
  if (!isVerdict(verdict)) return { ok: false as const, error: "Verdict must be comment, approved, or changes_requested." };
  const body = cleanText(typeof record.body === "string" ? record.body : "", 4000);
  if (body === undefined) return { ok: false as const, error: "Comment must be 4000 characters or fewer." };
  if (verdict === "comment" && !body) return { ok: false as const, error: "Write a comment." };
  let status: Status | undefined;
  if (hasOwn(record, "status") && record.status !== null && record.status !== "") {
    if (!isStatus(record.status)) return { ok: false as const, error: "Status must be sent, scheduled, built, planned, skipped, or task." };
    status = record.status;
  }
  const author = record.author === undefined || record.author === "" ? undefined : cleanName(record.author);
  if (record.author !== undefined && record.author !== "" && !author) {
    return { ok: false as const, error: "Author must be 40 characters or fewer, starting with a letter or number." };
  }
  return { ok: true as const, data: { body: body ?? "", verdict, status, author } };
}

export function readSync(value: unknown) {
  if (value === undefined || value === null) return { ok: true as const, data: {} as { campaignId?: string; week?: string; from?: string; to?: string } };
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  if (!record) return { ok: false as const, error: "Send a JSON object." };
  const data: { campaignId?: string; week?: string; from?: string; to?: string } = {};
  if (hasOwn(record, "campaignId") && record.campaignId) {
    if (typeof record.campaignId !== "string" || record.campaignId.length > 40) {
      return { ok: false as const, error: "That campaign was not found." };
    }
    data.campaignId = record.campaignId;
  }
  if (typeof record.week === "string" && record.week.trim()) data.week = record.week.trim();
  if (typeof record.from === "string" && record.from.trim()) data.from = record.from.trim();
  if (typeof record.to === "string" && record.to.trim()) data.to = record.to.trim();
  return { ok: true as const, data };
}
