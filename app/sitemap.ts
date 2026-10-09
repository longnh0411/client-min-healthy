import type { MetadataRoute } from "next";

// Playbook SEO: sitemap chỉ liệt kê route public — app này mọi thứ sau login,
// nên chỉ có /login. Domain thật từ NEXT_PUBLIC_SITE_URL (absolute bắt buộc).
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  if (!SITE_URL) return [];
  return [
    {
      url: `${SITE_URL}/login`,
      changeFrequency: "monthly",
      priority: 0.8,
      lastModified: new Date(),
    },
  ];
}
