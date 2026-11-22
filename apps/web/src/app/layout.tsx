import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Animora Studio — AI Educational & Animated Video SaaS",
  description:
    "Turn any educational topic into 60fps programmatic animated explainer Reels with word-synced subtitles, dual neural voiceovers, and direct per-member Instagram auto-publishing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body className="min-h-screen bg-[#09090B] text-[#F4F4F5] font-sans antialiased selection:bg-[#FF4F28]/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
