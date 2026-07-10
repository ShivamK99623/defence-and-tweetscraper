import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: [
    "xlsx",
    "exceljs",
    "@react-pdf/renderer",
    "better-sqlite3",
  ],
  allowedDevOrigins: ['192.168.1.4'],
};



export default nextConfig;
