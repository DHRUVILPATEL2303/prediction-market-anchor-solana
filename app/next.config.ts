import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      // Browser polyfills for Solana web3.js / Anchor
      crypto: "crypto-browserify",
      stream: "stream-browserify",
      zlib: "browserify-zlib",
      http: "stream-http",
      https: "https-browserify",
      assert: "assert",
      os: "os-browserify/browser",
      path: "path-browserify",
      buffer: "buffer",
      url: "url",
    },
  },
};

export default nextConfig;
