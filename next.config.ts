import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.1.16", 
    "localhost:3000",
    "sina-witty-myriam.ngrok-free.dev"
  ],
};

export default nextConfig;
