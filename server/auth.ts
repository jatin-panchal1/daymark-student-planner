import type { Express, Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { parse as parseCookieHeader } from "cookie";
import { upsertUser, getUserByOpenId } from "./db";
import { ENV } from "./_core/env";
import type { User } from "../drizzle/schema";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const SESSION_COOKIE = "daymark_session";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || "dev-secret-change-in-production";
  return new TextEncoder().encode(secret);
}

function getRedirectUri(req: Request): string {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${protocol}://${host}/api/auth/google/callback`;
}

// Create a signed JWT from user data
async function createSessionToken(user: User): Promise<string> {
  return new SignJWT({
    openId: user.openId,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getJwtSecret());
}

// Verify and decode a session JWT
export async function verifySessionToken(token: string): Promise<{
  openId: string;
  name: string;
  email: string;
  avatarUrl: string;
} | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as any;
  } catch {
    return null;
  }
}

// Extract user from request cookies
export async function getUserFromRequest(req: Request): Promise<User | null> {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const cookies = parseCookieHeader(cookieHeader);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session?.openId) return null;

  try {
    const user = await getUserByOpenId(session.openId);
    return user ?? null;
  } catch {
    // DB unavailable — return null so the session endpoint can fall back to JWT
    return null;
  }
}

export function registerGoogleAuthRoutes(app: Express) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn("[Auth] Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
  }

  // Step 1: Redirect to Google's OAuth consent screen (or dev mode bypass)
  app.get("/api/auth/google", async (req: Request, res: Response) => {
    if (!clientId || !clientSecret) {
      if (process.env.NODE_ENV === "production") {
        return res.status(500).json({ error: "OAuth is not configured on this server." });
      }
      
      // Dev mode: auto-login with a local dev user when Google OAuth isn't configured
      console.log("[Auth] Dev mode: creating local session (no Google credentials configured)");
      const devUser: Parameters<typeof createSessionToken>[0] = {
        id: 1, openId: "dev_local_user", name: "Dev Student", email: "dev@daymark.local",
        avatarUrl: null, role: "admin", loginMethod: "dev",
        createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
      };
      const sessionToken = await createSessionToken(devUser);
      res.cookie(SESSION_COOKIE, sessionToken, {
        httpOnly: true, secure: false, sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE * 1000,
      });
      return res.redirect("/");
    }

    const redirectUri = getRedirectUri(req);
    const scope = "openid email profile";
    const state = Buffer.from(JSON.stringify({ returnTo: req.query.returnTo || "/" })).toString("base64url");

    const url = new URL(GOOGLE_AUTH_URL);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scope);
    url.searchParams.set("state", state);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "select_account");

    res.redirect(url.toString());
  });

  // Step 2: Handle the OAuth callback
  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    try {
      const { code, state } = req.query;
      if (!code || typeof code !== "string") {
        return res.status(400).json({ error: "Missing authorization code" });
      }
      if (!clientId || !clientSecret) {
        return res.status(500).json({ error: "Google OAuth is not configured" });
      }

      const redirectUri = getRedirectUri(req);

      // Exchange code for tokens
      const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        console.error("[Auth] Token exchange failed:", errorData);
        return res.status(400).json({ error: "Failed to exchange authorization code" });
      }

      const tokenData = (await tokenResponse.json()) as { access_token: string; id_token?: string };

      // Get user info from Google
      const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (!userInfoResponse.ok) {
        return res.status(400).json({ error: "Failed to get user information" });
      }

      const googleUser = (await userInfoResponse.json()) as {
        sub: string;
        name: string;
        email: string;
        picture: string;
      };

      // Upsert user in database
      const openId = `google_${googleUser.sub}`;
      let user: User | null = null;
      try {
        await upsertUser({
          openId,
          name: googleUser.name,
          email: googleUser.email,
          avatarUrl: googleUser.picture,
          loginMethod: "google",
          lastSignedIn: new Date(),
        });
        user = (await getUserByOpenId(openId)) || null;
      } catch (err) {
        console.error("[Auth] Database error (falling back to temporary session):", err);
      }

      if (!user) {
        // Fallback user for session if DB fails
        user = {
          id: 0,
          openId,
          name: googleUser.name,
          email: googleUser.email,
          avatarUrl: googleUser.picture,
          role: "user",
          loginMethod: "google",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date()
        } as User;
      }

      // Create session JWT and set cookie
      const sessionToken = await createSessionToken(user);

      const isSecure = process.env.NODE_ENV === "production" || req.headers["x-forwarded-proto"] === "https" || req.protocol === "https";
      res.cookie(SESSION_COOKIE, sessionToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? "none" : "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE * 1000,
      });

      // Redirect to app
      let returnTo = "/";
      if (state && typeof state === "string") {
        try {
          const parsed = JSON.parse(Buffer.from(state, "base64url").toString());
          if (parsed.returnTo && parsed.returnTo.startsWith("/")) returnTo = parsed.returnTo;
        } catch { /* ignore */ }
      }

      res.redirect(returnTo);
    } catch (error) {
      console.error("[Auth] Google callback error:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  // Get current session
  app.get("/api/auth/session", async (req: Request, res: Response) => {
    // Try DB-backed user first
    const user = await getUserFromRequest(req);
    if (user) {
      return res.json({
        user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, role: user.role },
        authenticated: true,
      });
    }

    // Fall back to JWT payload directly (dev mode or DB not connected)
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
      const cookies = parseCookieHeader(cookieHeader);
      const token = cookies[SESSION_COOKIE];
      if (token) {
        const session = await verifySessionToken(token);
        if (session) {
          return res.json({
            user: { id: 1, name: session.name, email: session.email, avatarUrl: session.avatarUrl, role: "user" },
            authenticated: true,
          });
        }
      }
    }

    res.json({ user: null, authenticated: false });
  });

  // Logout
  app.post("/api/auth/logout", (_req: Request, res: Response) => {
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.json({ success: true });
  });
}
