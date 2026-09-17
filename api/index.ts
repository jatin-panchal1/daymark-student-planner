// Vercel Serverless Function entry point.
// We import from the esbuild-bundled output where all path aliases
// (@shared/*, etc.) have already been resolved during `pnpm build`.
import "dotenv/config";
process.env.NODE_ENV = process.env.NODE_ENV || "production";

// The build step bundles server/_core/index.ts → dist/index.js
// We re-export that bundled Express app for Vercel.
import app from "../dist/index.js";

export default app;
