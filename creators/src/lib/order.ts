export function sortCreators<T extends { rush: boolean; updatedAt: string; name: string }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    if (a.rush !== b.rush) return a.rush ? -1 : 1;
    if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1;
    return a.name.localeCompare(b.name, "en-GB");
  });
}
