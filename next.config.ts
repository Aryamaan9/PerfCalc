import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_IGNORE_EXPORT !== "true") {
  nextConfig.output = "export";
}

export default nextConfig;
