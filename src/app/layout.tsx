import { SessionContextProvider } from "@/components/session-context";
import { ThemeProvider } from "@/components/theme-provider";
import { getSessionContext } from "@/lib/auth/session";
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
  title: "Translator Pro",
  description:
    "Workspace para operar fluxos de traducao multi-tenant com agentes e revisoes.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSessionContext();

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SessionContextProvider value={session}>
            {children}
          </SessionContextProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
