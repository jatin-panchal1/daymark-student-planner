import "dotenv/config";
process.env.NODE_ENV = process.env.NODE_ENV || "production";
import app from "../server/_core/index.js";

// Export the Express app as a Vercel Serverless Function
export default app;
