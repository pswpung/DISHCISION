import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LiffProvider } from "./context/LiffContext";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DISHCISION",
  description: "Stop Talking Start Eating",
};

import { ThemeProvider } from "./context/ThemeContext";
import { ThemeToggle } from "./components/theme-toggle/theme-toggle";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <LiffProvider>
            <ThemeToggle />
            {children}
          </LiffProvider>
        </ThemeProvider>
        {/* Load Google Identity Services client */}
        <Script 
          src="https://accounts.google.com/gsi/client" 
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}

