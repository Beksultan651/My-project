import type { Metadata } from "next";
import { FinanceProvider } from "@/components/finance-provider";
import { AppShell } from "@/components/app-shell";
import { I18nProvider } from "@/components/i18n-provider";
import "./globals.css";
import "./language.css";
import "./ledger.css";

export const metadata: Metadata = {
  applicationName: "qarjy.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="kk" suppressHydrationWarning><body className="antialiased"><I18nProvider><FinanceProvider><AppShell>{children}</AppShell></FinanceProvider></I18nProvider></body></html>;
}
