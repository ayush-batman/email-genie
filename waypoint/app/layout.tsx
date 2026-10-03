import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Waypoint", template: "%s · Waypoint" },
  description: "Privacy-friendly analytics that shows where visitors come from, where they leave, and what turns into revenue.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
