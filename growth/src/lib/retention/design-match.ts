export type DesignLink = {
  calendarId: string;
  title: string;
  klaviyoCampaignId: string;
  sendDate: string;
  audience: string;
  subject: string;
  design: { id: string; mimeType: string; filename: string } | null;
};

export function normaliseName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function matchCampaignDesign(campaign: { id: string; name: string }, rows: DesignLink[]): DesignLink | null {
  const byId = rows.find((row) => row.klaviyoCampaignId && row.klaviyoCampaignId === campaign.id);
  if (byId) return byId;
  const name = normaliseName(campaign.name);
  if (!name) return null;
  const titled = rows.filter((row) => normaliseName(row.title) === name);
  if (!titled.length) return null;
  return (
    [...titled].sort((a, b) => {
      const design = Number(Boolean(b.design)) - Number(Boolean(a.design));
      if (design) return design;
      return b.sendDate.localeCompare(a.sendDate);
    })[0] ?? null
  );
}

export function accountRate(rows: { delivered: number | null; rate: number | null }[]) {
  const usable = rows.filter((row) => row.rate !== null);
  if (!usable.length) return null;
  const weighted = usable.every((row) => row.delivered !== null && (row.delivered ?? 0) > 0);
  if (weighted) {
    const weight = usable.reduce((sum, row) => sum + (row.delivered ?? 0), 0);
    const acc = usable.reduce((sum, row) => sum + (row.rate ?? 0) * (row.delivered ?? 0), 0);
    return weight > 0 ? acc / weight : null;
  }
  return usable.reduce((sum, row) => sum + (row.rate ?? 0), 0) / usable.length;
}
