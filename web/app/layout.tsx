import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { AppProvider } from "@/components/app-shell/app-provider";
import { ToastStack } from "@/components/app-shell/toast-stack";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://perfect-sand.app"),
  title: "Perfect Sand",
  description: "Voice of Osa discipline and urge-management PWA",
  manifest: "/manifest.webmanifest",
  applicationName: "Perfect Sand",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Perfect Sand",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.svg", type: "image/svg+xml" },
      { url: "/icons/icon-512.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/icon-192.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0F1117",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <AppProvider>
          <ToastStack />
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
