import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "export",
  images: {
    unoptimized: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ['192.168.1.13']
};

export default nextConfig;
