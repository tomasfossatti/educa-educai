import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Programa de la materia (hasta 8 MB) y material de la cátedra (hasta 20 MB).
      bodySizeLimit: "21mb",
    },
  },
  async rewrites() {
    return [
      {
        source: "/segunda-luz",
        destination: "/segunda-luz/index.html",
      },
    ];
  },
};

export default nextConfig;
