import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @four/core ships as TypeScript source, not a built artifact. Both clients
  // compile it themselves, so there is no publish step and no window where web
  // and mobile are running different versions of the derivation engine.
  transpilePackages: ["@four/core"],
};

export default nextConfig;
