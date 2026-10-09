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

// Playbook SEO (KB): domain thật từ env — canonical/OG/sitemap chỉ hoạt động khi đã set
// (điền NEXT_PUBLIC_SITE_URL trên Vercel, vd https://ngot-vua.vercel.app)
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "") || undefined;

export const metadata: Metadata = {
  metadataBase: SITE_URL ? new URL(SITE_URL) : undefined,
  title: "Ngọt vừa thui — Sổ tay đường huyết cho người bệnh tiểu đường",
  description:
    "Ghi chỉ số đường huyết trước/sau bữa ăn, hiểu con số cao/thấp qua ngữ cảnh bữa trước, theo dõi xu hướng và HbA1c ước tính. Miễn phí, cài lên điện thoại như app.",
  keywords: [
    "đường huyết",
    "sổ tay đường huyết",
    "bệnh tiểu đường",
    "hạ đường huyết",
    "HbA1c",
    "đo đường huyết trước ăn",
    "đo đường huyết sau ăn",
    "chỉ số đường huyết",
  ],
  applicationName: "Ngọt vừa thui",
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
  robots: { index: true, follow: true },
  ...(SITE_URL
    ? {
        alternates: { canonical: "/" },
        openGraph: {
          type: "website",
          siteName: "Ngọt vừa thui",
          title: "Ngọt vừa thui — Sổ tay đường huyết cho người bệnh tiểu đường",
          description:
            "Ghi chỉ số đường huyết trước/sau bữa ăn, hiểu con số qua ngữ cảnh bữa trước, theo dõi xu hướng và HbA1c ước tính.",
          url: SITE_URL,
          locale: "vi_VN",
          images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "Ngọt vừa thui" }],
        },
        twitter: {
          card: "summary",
          title: "Ngọt vừa thui — Sổ tay đường huyết",
          description: "Ghi chỉ số đường huyết trước/sau bữa ăn, theo dõi xu hướng và HbA1c ước tính.",
          images: ["/icon-512.png"],
        },
      }
    : {}),
};

// JSON-LD (playbook SEO step 3): WebSite — Google gán site name brand cho subdomain;
// WebApplication — cơ hội rich result cho health app.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      ...(SITE_URL ? { url: SITE_URL } : {}),
      name: "Ngọt vừa thui",
      alternateName: "Ngọt Vừa Thui — Sổ đường huyết",
      inLanguage: "vi-VN",
    },
    {
      "@type": "WebApplication",
      name: "Ngọt vừa thui",
      applicationCategory: "HealthApplication",
      operatingSystem: "Web",
      inLanguage: "vi-VN",
      description:
        "Sổ tay đường huyết cho người bệnh tiểu đường — ghi đo trước/sau bữa ăn, theo dõi xu hướng và HbA1c ước tính.",
      ...(SITE_URL ? { url: SITE_URL } : {}),
      offers: { "@type": "Offer", price: "0", priceCurrency: "VND" },
    },
  ],
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
        {/* JSON-LD cho Googlebot (playbook SEO) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
