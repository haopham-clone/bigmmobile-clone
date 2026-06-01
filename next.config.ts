import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i0.wp.com",
      },
      {
        protocol: "https",
        hostname: "bigmmobile.com.au",
      },
      {
        protocol: "http",
        hostname: "bigmmobile.com.au",
      },
    ],
  },
};

export default nextConfig;
