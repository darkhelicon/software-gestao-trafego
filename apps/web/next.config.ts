import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" is required for Docker (Linux). On Windows it fails due to symlink permissions.
  // Enable by setting NEXT_STANDALONE=1 (the Dockerfile does this automatically).
  ...(process.env["NEXT_STANDALONE"] === "1" ? { output: "standalone" as const } : {}),
  reactStrictMode: true,
  transpilePackages: ["@helzo-scale/types"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
