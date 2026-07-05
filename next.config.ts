import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "xlsx",
    "exceljs",
    "@react-pdf/renderer",
  ],
  allowedDevOrigins: ['192.168.1.4'],
};



export default nextConfig;
