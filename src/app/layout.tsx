import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { Sidebar, MobileNav } from "@/components/sidebar";
import { CommandMenu } from "@/components/command-menu";
import { ThemeToggle } from "@/components/theme-toggle";
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
  title: "ClawCRM - Personal People CRM",
  description: "AI-powered personal CRM for managing relationships and meetings",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
              <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
                <div className="flex h-14 items-center justify-between px-4 md:px-6">
                  <div className="flex items-center gap-2 md:hidden">
                    <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                      <span className="text-primary-foreground text-sm font-bold">C</span>
                    </div>
                    <span className="font-bold">ClawCRM</span>
                  </div>
                  <div className="hidden md:block" />
                  <ThemeToggle />
                </div>
              </header>
              <main className="flex-1 pb-16 md:pb-0">
                {children}
              </main>
            </div>
          </div>
          <CommandMenu />
          <MobileNav />
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
