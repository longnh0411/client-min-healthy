import type { MetadataRoute } from "next";

// Playbook SEO (KB docs/seo-google-index-spa + playbooks/seo-google-index-spa.md):
// mọi path thiếu trả HTML thay vì rules → file này PHẢI trả rules thật.
// Toàn bộ nội dung app nằm sau login → chỉ có /login là public.
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");

export default function robots(): MetadataRoute.Robots {
  const rules = { userAgent: "*", allow: "/" };
  return {
    rules,
    // Chỉ thêm Sitemap khi đã cấu hình domain thật (absolute URL bắt buộc)
    ...(SITE_URL ? { sitemap: `${SITE_URL}/sitemap.xml` } : {}),
  };
}
