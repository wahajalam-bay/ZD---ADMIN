import type { Metadata, Viewport } from "next";
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
  // Site users file checklists from a phone on site; make it installable.
  applicationName: "Zameen Admin Properties",
  appleWebApp: { capable: true, title: "Zameen Admin", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

/**
 * `viewportFit: cover` lets the layout paint into the notch/home-indicator
 * area; the shell adds `env(safe-area-inset-*)` padding so nothing important
 * lands underneath it. Zoom is deliberately NOT disabled.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#063d24" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1a13" },
  ],
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
