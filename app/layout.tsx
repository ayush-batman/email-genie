import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Follow-up Email Genie | AI-Powered Sales Follow-ups",
  description:
    "Transform your meeting transcripts into personalized follow-up emails with AI. Connect Zoom & Google Meet for automatic transcription.",
  keywords: [
    "follow-up emails",
    "AI email writer",
    "meeting transcription",
    "sales automation",
    "CRM",
  ],
  authors: [{ name: "Follow-up Email Genie" }],
  openGraph: {
    title: "Follow-up Email Genie",
    description: "AI-Powered Sales Follow-up Emails",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
