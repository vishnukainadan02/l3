// Handle Shopify environment variables
if (
  process.env.HOST &&
  (!process.env.SHOPIFY_APP_URL ||
    process.env.SHOPIFY_APP_URL === process.env.HOST)
) {
  process.env.SHOPIFY_APP_URL = process.env.HOST;
  delete process.env.HOST;
}

/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  ignoredRouteFiles: ["**/.*"],
  appDirectory: "app",
  serverModuleFormat: "esm", // Changed to ESM for better Amplify compatibility
  dev: { port: process.env.HMR_SERVER_PORT || 8002 },
  future: {},
  // Amplify-specific configurations
  serverBuildPath: "build/server/index.js",
  assetsBuildDirectory: "build/client",
  publicPath: "/build/",
};