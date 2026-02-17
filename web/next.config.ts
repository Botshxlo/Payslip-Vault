import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  webpack: (config) => {
    // Required for react-pdf: alias the worker to the bundled version
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
