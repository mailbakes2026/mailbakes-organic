import type { Metadata } from "next";
import { AppFrame } from "@/components/app-frame";

export const metadata: Metadata = {
  title: "Retention · MailBakes",
  description: "Klaviyo and Shopify for MailBakes.",
  icons: {
    icon: [{ url: "/retention/icon", type: "image/svg+xml" }],
    apple: [{ url: "/retention/icon", type: "image/svg+xml" }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppFrame app="retention">{children}</AppFrame>;
}
