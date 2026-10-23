export function matchesQuery(
  row: {
    name: string;
    handle: string;
    email: string;
    shopifyOrder: string;
    cardMessage: string;
    notes: string;
    trackingNumber: string;
    courier: string;
    declineReason: string;
    postUrl: string;
    tiktokOrderId?: string;
  },
  query: string,
) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    row.name,
    row.handle,
    row.email,
    row.shopifyOrder,
    row.cardMessage,
    row.notes,
    row.trackingNumber,
    row.courier,
    row.declineReason,
    row.postUrl,
    row.tiktokOrderId ?? "",
  ]
    .join("\n")
    .toLowerCase();
  return hay.includes(needle);
}
