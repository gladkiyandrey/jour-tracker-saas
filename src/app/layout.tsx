import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import CustomCursor from "@/components/ui/CustomCursor";
import { getLocaleFromCookies } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Consist",
  description: "Trading discipline calendar with subscription access",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://consist.online"),
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocaleFromCookies();
  return (
    <html lang={locale}>
      <body>
        <CustomCursor />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
