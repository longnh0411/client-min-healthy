import type { NextConfig } from "next";
import path from "node:path";

// Vercel tự quản build/deploy; mọi API call đi thẳng sang monolith api-longnh-tools.
// turbopack.root: ghim gốc project để Next không nhầm lockfile ở thư mục cha.
const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
