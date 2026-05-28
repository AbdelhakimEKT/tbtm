import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Providers } from "@/components/providers";
import { BottomNav } from "@/components/bottom-nav";
import { ActiveSeanceBanner } from "@/components/active-seance-banner";
import { HideOnRoutes } from "@/components/hide-on-routes";
import { PwaInstallBanner } from "@/components/pwa-install-banner";
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
  title: {
    default: "T'es bon tu montes",
    template: "%s · TBTM",
  },
  description:
    "App fitness perso pour suivre tes séances, tes PRs, ta nutrition. Entre potes.",
  applicationName: "TBTM",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TBTM",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.png",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0a12",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} dark`}
      suppressHydrationWarning
    >
      <body className="flex min-h-svh flex-col bg-bg text-fg antialiased">
        <Providers>
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
            <HideOnRoutes
              patterns={["regex:^/seance/[^/]+/live", "/auth"]}
            >
              <ActiveSeanceBanner />
            </HideOnRoutes>
            <main className="flex-1">{children}</main>
            <BottomNav />
            <HideOnRoutes
              patterns={["regex:^/seance/[^/]+/live", "/auth"]}
            >
              <PwaInstallBanner />
            </HideOnRoutes>
          </div>
        </Providers>
      </body>
    </html>
  );
}
