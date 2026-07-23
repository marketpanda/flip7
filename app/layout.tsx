import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Flip 7 — Push Your Luck",
  description:
    "A local pass-and-play card game. Draw unique numbers, bank your points before you bust, and race to 200.",
  applicationName: "Flip 7",
  keywords: ["card game", "push your luck", "local multiplayer"],
  openGraph: {
    title: "Flip 7 — Push Your Luck",
    description:
      "Draw unique numbers, bank your points before you bust, and race to 200.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
