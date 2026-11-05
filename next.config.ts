import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The coach and corpus loaders read eval/corpus at runtime on the server.
  outputFileTracingIncludes: { "/**": ["./eval/corpus/**"] },
};

export default nextConfig;
