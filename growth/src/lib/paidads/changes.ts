export const CHANGE_AUTHORS = ["Millie", "Mikey"] as const;

export function assessMetaChange(
  existing: { id: string; day: string }[],
  today: string,
  editId: string | null,
) {
  if (editId) {
    const row = existing.find((item) => item.id === editId);
    if (!row) return { ok: false as const, error: "That change is not in the log." };
    if (row.day !== today) return { ok: false as const, error: "Only today's Meta budget change can be edited." };
    return { ok: true as const, mode: "edit" as const };
  }
  if (existing.some((item) => item.day === today)) {
    return { ok: false as const, error: "A Meta budget change is already recorded for today." };
  }
  return { ok: true as const, mode: "create" as const };
}
