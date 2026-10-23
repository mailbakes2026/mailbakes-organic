import { MARKS, type MarkName } from "@/lib/marks";

export function Mark({ kind, size = 16 }: { kind: MarkName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: MARKS[kind] }}
    />
  );
}
