import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import CustomCursor from "@/components/ui/CustomCursor";
import { getLocaleFromCookies } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Consist",
  description: "Trading discipline calendar with subscription access",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://consist.online"),
  applicationName: "Consist",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-v3.ico", sizes: "any" },
      { url: "/favicon-16x16-v3.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon-32x32-v3.png", type: "image/png", sizes: "32x32" },
      { url: "/icon-192-v3.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512-v3.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon-v3.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon-v3.ico"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Consist",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b1020",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocaleFromCookies();
  return (
    <html lang={locale}>
      <body>
        <CustomCursor />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
