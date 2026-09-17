// Vercel serverless entry point (source — gets bundled by esbuild during build).
// This is a stripped-down version of server/_core/index.ts that
// excludes the Vite dev server and local HTTP listener.
import "dotenv/config";
process.env.NODE_ENV = process.env.NODE_ENV || "production";

import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "../server/_core/oauth";
import { registerGoogleAuthRoutes } from "../server/auth";
import { registerStorageProxy } from "../server/_core/storageProxy";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";

const app = express();

// Body parser
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Routes
registerStorageProxy(app);
registerGoogleAuthRoutes(app);
registerOAuthRoutes(app);

// tRPC API
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

export default app;
