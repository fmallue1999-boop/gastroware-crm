import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La tipografía del PDF de la cotización se lee del disco en el servidor
  outputFileTracingIncludes: {
    "/cotizacion/\[id\]/pdf": ["./lib/pdf/fuentes/**/*"],
  },
};

export default nextConfig;
