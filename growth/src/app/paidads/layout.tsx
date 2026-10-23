import type { Metadata } from "next";
import { AppFrame } from "@/components/app-frame";

export const metadata: Metadata = {
  title: "Paid Ads · MailBakes",
  description: "Meta and Google Ads for MailBakes.",
  icons: {
    icon: [{ url: "/paidads/icon", type: "image/svg+xml" }],
    apple: [{ url: "/paidads/icon", type: "image/svg+xml" }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppFrame app="paidads">{children}</AppFrame>;
}
