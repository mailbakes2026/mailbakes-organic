export function googleAdsStatus() {
  return {
    connected: false as const,
    parked: true as const,
    detail: "Google Ads is not connected. The connector is parked and does not read GOOGLE_ADS_* yet.",
  };
}
