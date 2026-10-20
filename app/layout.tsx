import type { Metadata } from "next";
import { FinanceProvider } from "@/components/finance-provider";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Қаржылық сауаттылық | qarjy.", template: "%s | qarjy." },
  description: "Қаржыңызды қазақ тілінде басқарыңыз: кірістер мен шығыстар, бюджет калькуляторы, жинақ мақсаттары және қысқаша сабақтар.",
  applicationName: "Қаржылық сауаттылық",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="kk" suppressHydrationWarning><body className="antialiased"><FinanceProvider><AppShell>{children}</AppShell></FinanceProvider></body></html>;
}
