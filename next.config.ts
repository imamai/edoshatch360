import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Marketing photography ships locally; CMS-uploaded imagery is served
    // from Supabase Storage on this project only.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cnlyuwslpcgosgwdmzav.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    // Ships only the icons actually imported rather than the whole set —
    // meaningful on a low-end Android over a slow connection (spec §58).
    optimizePackageImports: ["lucide-react", "recharts"],
  },
};

export default nextConfig;
