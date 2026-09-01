import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { ThemeProvider, ThemeScript } from "@/components/theme/theme-provider";
import "./globals.css";

/** Segoe UI leads the stack (§1.1); Inter is the cross-platform fallback. */
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Zameen Admin Properties",
    template: "%s · Zameen Admin Properties",
  },
  description: "Zameen Admin Properties — Operations & Command Center",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={`${inter.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="font-sans">
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
