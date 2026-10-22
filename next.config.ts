import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Permite subir el programa de la materia en PDF (hasta 8 MB).
      bodySizeLimit: "10mb",
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
