import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Strands TS SDK dynamically imports optional AWS SDK modules; keep it out of the bundler.
  serverExternalPackages: ["@strands-agents/sdk"],
  async rewrites() {
    return [
      { source: "/.well-known/oauth-authorization-server", destination: "/api/oauth-metadata?kind=authorization-server" },
      { source: "/.well-known/oauth-authorization-server/:path*", destination: "/api/oauth-metadata?kind=authorization-server" },
      { source: "/.well-known/oauth-protected-resource", destination: "/api/oauth-metadata?kind=protected-resource" },
      { source: "/.well-known/oauth-protected-resource/:path*", destination: "/api/oauth-metadata?kind=protected-resource" },
    ];
  },
};

export default nextConfig;
