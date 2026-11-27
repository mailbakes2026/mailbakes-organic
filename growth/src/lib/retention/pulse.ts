import { prisma, prepareDatabase } from "@/lib/prisma";
import type { PulsePoint } from "@/lib/retention/weeks";

export async function savePulseRepeat(
  capturedOn: string,
  repeat: { rate: number; repeatCustomers: number; customers: number } | null,
) {
  await prepareDatabase();
  const data = {
    repeatRate: repeat?.rate ?? null,
    repeatCustomers: repeat?.repeatCustomers ?? null,
    customers: repeat?.customers ?? null,
  };
  await prisma.retentionPulse.upsert({
    where: { capturedOn },
    create: { capturedOn, ...data },
    update: data,
  });
}

export async function savePulse(pulse: PulsePoint) {
  await prepareDatabase();
  const data = {
    flowRevenuePence: pulse.flowRevenuePence,
    campaignRevenuePence: pulse.campaignRevenuePence,
    currency: pulse.currency || "GBP",
    mixedCurrency: pulse.mixedCurrency,
    repeatRate: pulse.repeatRate,
    repeatCustomers: pulse.repeatCustomers,
    customers: pulse.customers,
  };
  await prisma.retentionPulse.upsert({
    where: { capturedOn: pulse.capturedOn },
    create: { capturedOn: pulse.capturedOn, ...data },
    update: data,
  });
}

export async function listPulses(): Promise<PulsePoint[]> {
  await prepareDatabase();
  const rows = await prisma.retentionPulse.findMany({ orderBy: { capturedOn: "asc" } });
  return rows.map((row) => ({
    capturedOn: row.capturedOn,
    flowRevenuePence: row.flowRevenuePence,
    campaignRevenuePence: row.campaignRevenuePence,
    currency: row.currency,
    mixedCurrency: row.mixedCurrency,
    repeatRate: row.repeatRate,
    repeatCustomers: row.repeatCustomers,
    customers: row.customers,
  }));
}

export async function listDatedCampaignRevenue() {
  await prepareDatabase();
  return prisma.calendarCampaign.findMany({
    where: { revenuePence: { not: null } },
    select: { sendDate: true, revenuePence: true, currency: true },
  });
}
