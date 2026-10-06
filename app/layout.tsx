import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Font design system (DESIGN.md): Plus Jakarta Sans — hỗ trợ subset tiếng Việt
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "vietnamese"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "🩸 Ngọt vừa thui",
  description: "Sổ tay đường huyết cho người bệnh tiểu đường — ghi đo trước/sau ăn, hiểu con số của mình",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ngọt vừa thui",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-apple-180.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f9ff" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1626" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${jakarta.variable} antialiased`} suppressHydrationWarning>
      <body className="min-h-screen">
        {/* Đặt theme trước khi render để không bị chớp màu (FOUC) — file tĩnh
            public/theme-init.js, beforeInteractive inject ngoài cây React */}
        <Script id="theme-init" src="/theme-init.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
