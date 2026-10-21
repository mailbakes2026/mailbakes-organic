import { RunBoard } from "@/components/run-board";
import { listItems } from "@/lib/records";

export const dynamic = "force-dynamic";

export default async function RunThroughPage() {
  const items = await listItems();
  return <RunBoard items={items} />;
}
