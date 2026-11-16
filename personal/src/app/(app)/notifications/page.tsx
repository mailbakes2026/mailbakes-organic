import { NotificationsBoard } from "@/components/notifications-board";
import { deviceCount, mutedSources, pushPublicKey, recentNotices } from "@/lib/notify";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const [publicKey, notices, muted, devices] = await Promise.all([pushPublicKey(), recentNotices(), mutedSources(), deviceCount()]);
  return <NotificationsBoard publicKey={publicKey} notices={notices} muted={muted} devices={devices} />;
}
