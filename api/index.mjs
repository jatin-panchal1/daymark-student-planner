// api/entry.ts
import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";

// server/db.ts
import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// drizzle/schema.ts
import { boolean, date, index, integer, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
var users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  avatarUrl: text("avatarUrl"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: varchar("role", { length: 16 }).default("user").notNull(),
  googleAccessToken: text("googleAccessToken"),
  googleRefreshToken: text("googleRefreshToken"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var subjects = pgTable("subjects", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 120 }).notNull(),
  code: varchar("code", { length: 40 }),
  color: varchar("color", { length: 20 }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => ({ userIdx: index("subjects_user_idx").on(table.userId), nameUserUniq: uniqueIndex("subjects_name_user_uniq").on(table.name, table.userId) }));
var schedules = pgTable("schedule", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  subjectId: integer("subjectId").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  dayOfWeek: integer("dayOfWeek").notNull(),
  startTime: varchar("startTime", { length: 10 }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" })
}, (table) => ({ subjectIdx: index("schedule_subject_idx").on(table.subjectId), userIdx: index("schedule_user_idx").on(table.userId) }));
var tasks = pgTable("tasks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: varchar("title", { length: 255 }).notNull(),
  subjectId: integer("subjectId").references(() => subjects.id, { onDelete: "set null" }),
  isCompleted: boolean("isCompleted").default(false).notNull(),
  dueDate: date("dueDate"),
  priority: varchar("priority", { length: 16 }).default("Medium").notNull(),
  recurringDays: varchar("recurringDays", { length: 32 }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => ({ userIdx: index("tasks_user_idx").on(table.userId), dueIdx: index("tasks_due_idx").on(table.dueDate) }));
var libraryBooks = pgTable("libraryBooks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: varchar("title", { length: 255 }).notNull(),
  author: varchar("author", { length: 180 }),
  issuedOn: date("issuedOn"),
  returnBy: date("returnBy"),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => ({ userIdx: index("library_books_user_idx").on(table.userId) }));
var calendarEvents = pgTable("calendarEvents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  kind: varchar("kind", { length: 16 }).notNull(),
  // "holiday" | "dayoff" | "exam"
  title: varchar("title", { length: 255 }).notNull(),
  startDate: date("startDate").notNull(),
  endDate: date("endDate"),
  subject: varchar("subject", { length: 255 }),
  examTime: varchar("examTime", { length: 16 }),
  afterClass: boolean("afterClass").default(false),
  afterSubject: varchar("afterSubject", { length: 255 }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => ({ userIdx: index("calendar_events_user_idx").on(table.userId) }));
var classCheckins = pgTable("classCheckins", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  subjectId: integer("subjectId").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  checkinDate: date("checkinDate").notNull(),
  status: varchar("status", { length: 16 }).notNull(),
  // "attended" | "absent"
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => ({ userIdx: index("checkins_user_idx").on(table.userId), dateIdx: index("checkins_date_idx").on(table.checkinDate) }));
var codingSettings = pgTable("codingSettings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  leetcodeUsername: varchar("leetcodeUsername", { length: 100 }),
  codeforcesHandle: varchar("codeforcesHandle", { length: 100 }),
  leetcodeTarget: integer("leetcodeTarget").default(150).notNull(),
  codeforcesTarget: integer("codeforcesTarget").default(200).notNull(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/db.ts
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const client = postgres(process.env.DATABASE_URL);
      _db = drizzle(client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values = { openId: user.openId };
  const updateSet = {};
  ["name", "email", "loginMethod", "avatarUrl", "googleAccessToken", "googleRefreshToken"].forEach((field) => {
    if (user[field] !== void 0) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  if (user.lastSignedIn !== void 0) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== void 0) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  values.lastSignedIn ??= /* @__PURE__ */ new Date();
  updateSet.lastSignedIn ??= /* @__PURE__ */ new Date();
  updateSet.updatedAt = /* @__PURE__ */ new Date();
  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}
async function listSubjects(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(subjects).where(eq(subjects.userId, userId)).orderBy(asc(subjects.name));
}
async function createSubject(data) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(subjects).values(data).returning({ id: subjects.id });
  return result[0].id;
}
async function upsertSubjectByName(data) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(subjects).values(data).onConflictDoUpdate({
    target: [subjects.name, subjects.userId],
    set: { code: data.code, color: data.color }
  }).returning({ id: subjects.id });
  return result[0].id;
}
async function deleteSubject(subjectId, userId) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(subjects).where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)));
}
async function clearAllSubjects(userId) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(subjects).where(eq(subjects.userId, userId));
}
async function listSchedules(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(schedules).where(eq(schedules.userId, userId)).orderBy(asc(schedules.dayOfWeek));
}
async function createSchedules(data) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  if (data.length === 0) return;
  await db.insert(schedules).values(data);
}
async function deleteSchedulesForSubject(subjectId) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(schedules).where(eq(schedules.subjectId, subjectId));
}
async function listTasks(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tasks).where(eq(tasks.userId, userId)).orderBy(asc(tasks.isCompleted), asc(tasks.dueDate), desc(tasks.createdAt));
}
async function createTask(data) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(tasks).values(data).returning({ id: tasks.id });
  return result[0].id;
}
async function updateTask(taskId, userId, isCompleted) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(tasks).set({ isCompleted }).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
}
async function deleteTask(taskId, userId) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
}
async function listCalendarEvents(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(calendarEvents).where(eq(calendarEvents.userId, userId)).orderBy(asc(calendarEvents.startDate));
}
async function createCalendarEvent(data) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(calendarEvents).values(data).returning({ id: calendarEvents.id });
  return result[0].id;
}
async function bulkCreateCalendarEvents(data) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  if (data.length === 0) return [];
  const result = await db.insert(calendarEvents).values(data).returning({ id: calendarEvents.id });
  return result.map((r) => r.id);
}
async function deleteCalendarEvent(eventId, userId) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(calendarEvents).where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)));
}
async function listCheckins(userId, date2) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(classCheckins).where(and(eq(classCheckins.userId, userId), eq(classCheckins.checkinDate, date2)));
}
async function upsertCheckin(data) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const existing = await db.select().from(classCheckins).where(
    and(
      eq(classCheckins.subjectId, data.subjectId),
      eq(classCheckins.checkinDate, data.checkinDate),
      eq(classCheckins.userId, data.userId)
    )
  ).limit(1);
  if (existing.length > 0) {
    await db.update(classCheckins).set({ status: data.status }).where(eq(classCheckins.id, existing[0].id));
    return existing[0].id;
  } else {
    const result = await db.insert(classCheckins).values(data).returning({ id: classCheckins.id });
    return result[0].id;
  }
}
async function getCodingSettings(userId) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(codingSettings).where(eq(codingSettings.userId, userId)).limit(1);
  return result[0] ?? null;
}
async function upsertCodingSettings(userId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const existing = await db.select().from(codingSettings).where(eq(codingSettings.userId, userId)).limit(1);
  const updateData = { updatedAt: /* @__PURE__ */ new Date() };
  if (data.leetcodeUsername !== void 0) updateData.leetcodeUsername = data.leetcodeUsername;
  if (data.codeforcesHandle !== void 0) updateData.codeforcesHandle = data.codeforcesHandle;
  if (data.leetcodeTarget !== void 0) updateData.leetcodeTarget = data.leetcodeTarget;
  if (data.codeforcesTarget !== void 0) updateData.codeforcesTarget = data.codeforcesTarget;
  if (existing.length > 0) {
    await db.update(codingSettings).set(updateData).where(eq(codingSettings.userId, userId));
  } else {
    await db.insert(codingSettings).values({ userId, ...data });
  }
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (process.env.NODE_ENV === "production") return true;
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app2) {
  app2.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/auth.ts
import { SignJWT as SignJWT2, jwtVerify as jwtVerify2 } from "jose";
import { parse as parseCookieHeader3 } from "cookie";
var GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
var GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
var GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
var SESSION_COOKIE = "daymark_session";
var SESSION_MAX_AGE = 30 * 24 * 60 * 60;
function getJwtSecret() {
  const secret = process.env.JWT_SECRET || "dev-secret-change-in-production";
  return new TextEncoder().encode(secret);
}
function getRedirectUri(req) {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${protocol}://${host}/api/auth/google/callback`;
}
async function createSessionToken(user) {
  return new SignJWT2({
    openId: user.openId,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl
  }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${SESSION_MAX_AGE}s`).sign(getJwtSecret());
}
async function verifySessionToken(token) {
  try {
    const { payload } = await jwtVerify2(token, getJwtSecret());
    return payload;
  } catch {
    return null;
  }
}
async function getUserFromRequest(req) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = parseCookieHeader3(cookieHeader);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session?.openId) return null;
  try {
    const user = await getUserByOpenId(session.openId);
    return user ?? null;
  } catch {
    return null;
  }
}
function registerGoogleAuthRoutes(app2) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.warn("[Auth] Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
  }
  app2.get("/api/auth/google", async (req, res) => {
    if (!clientId || !clientSecret) {
      if (process.env.NODE_ENV === "production") {
        return res.status(500).json({ error: "OAuth is not configured on this server." });
      }
      console.log("[Auth] Dev mode: creating local session (no Google credentials configured)");
      const devUser = {
        id: 1,
        openId: "dev_local_user",
        name: "Dev Student",
        email: "dev@daymark.local",
        avatarUrl: null,
        role: "admin",
        loginMethod: "dev",
        googleAccessToken: null,
        googleRefreshToken: null,
        createdAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date(),
        lastSignedIn: /* @__PURE__ */ new Date()
      };
      const sessionToken = await createSessionToken(devUser);
      res.cookie(SESSION_COOKIE, sessionToken, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE * 1e3
      });
      return res.redirect("/");
    }
    const redirectUri = getRedirectUri(req);
    const scope = "openid email profile https://www.googleapis.com/auth/calendar.events.readonly";
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
  app2.get("/api/auth/google/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      if (!code || typeof code !== "string") {
        return res.status(400).json({ error: "Missing authorization code" });
      }
      if (!clientId || !clientSecret) {
        return res.status(500).json({ error: "Google OAuth is not configured" });
      }
      const redirectUri = getRedirectUri(req);
      const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code"
        })
      });
      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        console.error("[Auth] Token exchange failed:", errorData);
        return res.status(400).json({ error: "Failed to exchange authorization code" });
      }
      const tokenData = await tokenResponse.json();
      const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      if (!userInfoResponse.ok) {
        return res.status(400).json({ error: "Failed to get user information" });
      }
      const googleUser = await userInfoResponse.json();
      const openId = `google_${googleUser.sub}`;
      let user = null;
      try {
        await upsertUser({
          openId,
          name: googleUser.name,
          email: googleUser.email,
          avatarUrl: googleUser.picture,
          loginMethod: "google",
          lastSignedIn: /* @__PURE__ */ new Date(),
          googleAccessToken: tokenData.access_token,
          googleRefreshToken: tokenData.refresh_token ?? void 0
        });
        user = await getUserByOpenId(openId) || null;
      } catch (err) {
        console.error("[Auth] Database error (falling back to temporary session):", err);
      }
      if (!user) {
        user = {
          id: 0,
          openId,
          name: googleUser.name,
          email: googleUser.email,
          avatarUrl: googleUser.picture,
          role: "user",
          loginMethod: "google",
          createdAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date(),
          lastSignedIn: /* @__PURE__ */ new Date()
        };
      }
      const sessionToken = await createSessionToken(user);
      const isSecure = process.env.NODE_ENV === "production" || req.headers["x-forwarded-proto"] === "https" || req.protocol === "https";
      res.cookie(SESSION_COOKIE, sessionToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? "none" : "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE * 1e3
      });
      let returnTo = "/";
      if (state && typeof state === "string") {
        try {
          const parsed = JSON.parse(Buffer.from(state, "base64url").toString());
          if (parsed.returnTo && parsed.returnTo.startsWith("/")) returnTo = parsed.returnTo;
        } catch {
        }
      }
      res.redirect(returnTo);
    } catch (error) {
      console.error("[Auth] Google callback error:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  });
  app2.get("/api/auth/session", async (req, res) => {
    const user = await getUserFromRequest(req);
    if (user) {
      return res.json({
        user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, role: user.role },
        authenticated: true
      });
    }
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
      const cookies = parseCookieHeader3(cookieHeader);
      const token = cookies[SESSION_COOKIE];
      if (token) {
        const session = await verifySessionToken(token);
        if (session) {
          return res.json({
            user: { id: 1, name: session.name, email: session.email, avatarUrl: session.avatarUrl, role: "user" },
            authenticated: true
          });
        }
      }
    }
    res.json({ user: null, authenticated: false });
  });
  app2.post("/api/auth/logout", (_req, res) => {
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.json({ success: true });
  });
}

// server/_core/storageProxy.ts
function registerStorageProxy(app2) {
  app2.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/routers.ts
import { z as z2 } from "zod";

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/services/leetcode.ts
var LEETCODE_GRAPHQL = "https://leetcode.com/graphql";
async function leetcodeQuery(query, variables = {}) {
  const response = await fetch(LEETCODE_GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Referer": "https://leetcode.com" },
    body: JSON.stringify({ query, variables })
  });
  if (!response.ok) throw new Error(`LeetCode API error: ${response.status}`);
  const data = await response.json();
  if (data.errors) throw new Error(data.errors[0]?.message || "LeetCode GraphQL error");
  return data.data;
}
async function getLeetCodeProfile(username) {
  const data = await leetcodeQuery(`
    query getUserProfile($username: String!) {
      matchedUser(username: $username) {
        username
        profile { ranking }
        submitStatsGlobal {
          acSubmissionNum { difficulty count }
        }
        contributions { points }
      }
      allQuestionsCount { difficulty count }
    }
  `, { username });
  const user = data.matchedUser;
  if (!user) throw new Error(`LeetCode user "${username}" not found`);
  const stats = user.submitStatsGlobal.acSubmissionNum;
  const totals = data.allQuestionsCount;
  const findCount = (arr, d) => arr.find((s) => s.difficulty === d)?.count || 0;
  return {
    username: user.username,
    totalSolved: findCount(stats, "All"),
    easySolved: findCount(stats, "Easy"),
    mediumSolved: findCount(stats, "Medium"),
    hardSolved: findCount(stats, "Hard"),
    easyTotal: findCount(totals, "Easy"),
    mediumTotal: findCount(totals, "Medium"),
    hardTotal: findCount(totals, "Hard"),
    ranking: user.profile?.ranking || 0,
    contributionPoints: user.contributions?.points || 0
  };
}
async function getRecentSubmissions(username, limit = 20) {
  const data = await leetcodeQuery(`
    query getRecentSubmissions($username: String!, $limit: Int!) {
      recentAcSubmissionList(username: $username, limit: $limit) {
        title
        titleSlug
        statusDisplay
        lang
        timestamp
      }
    }
  `, { username, limit });
  return (data.recentAcSubmissionList || []).map((s) => ({
    title: s.title,
    titleSlug: s.titleSlug,
    statusDisplay: s.statusDisplay || "Accepted",
    lang: s.lang,
    timestamp: Number(s.timestamp)
  }));
}
async function getContestInfo(username) {
  const data = await leetcodeQuery(`
    query getContestRanking($username: String!) {
      userContestRanking(username: $username) {
        rating
        globalRanking
        attendedContestsCount
      }
      userContestRankingHistory(username: $username) {
        contest { title startTime }
        rating
        ranking
      }
    }
  `, { username });
  const ranking = data.userContestRanking;
  const history = (data.userContestRankingHistory || []).filter((h) => h.rating > 0).map((h) => ({
    contestTitle: h.contest.title,
    rating: Math.round(h.rating),
    ranking: h.ranking,
    timestamp: h.contest.startTime
  }));
  return {
    rating: ranking ? Math.round(ranking.rating) : 0,
    globalRanking: ranking?.globalRanking || 0,
    attendedContestsCount: ranking?.attendedContestsCount || 0,
    history
  };
}
async function getSubmissionCalendar(username) {
  const data = await leetcodeQuery(`
    query getCalendar($username: String!) {
      matchedUser(username: $username) {
        submissionCalendar
        streak
        totalActiveDays: submitStatsGlobal {
          acSubmissionNum { count difficulty }
        }
      }
    }
  `, { username });
  const user = data.matchedUser;
  let calendar = {};
  try {
    calendar = JSON.parse(user?.submissionCalendar || "{}");
  } catch {
  }
  let streak = 0;
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ts = Math.floor(d.getTime() / 1e3).toString();
    if (calendar[ts] && calendar[ts] > 0) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return {
    submissionCalendar: calendar,
    streak: user?.streak || streak,
    totalActiveDays: Object.keys(calendar).length
  };
}
async function getFullLeetCodeData(username) {
  const [profile, submissions, contest, calendar] = await Promise.all([
    getLeetCodeProfile(username),
    getRecentSubmissions(username),
    getContestInfo(username).catch(() => ({ rating: 0, globalRanking: 0, attendedContestsCount: 0, history: [] })),
    getSubmissionCalendar(username).catch(() => ({ submissionCalendar: {}, streak: 0, totalActiveDays: 0 }))
  ]);
  return { profile, submissions, contest, calendar };
}

// server/services/codeforces.ts
var CF_API = "https://codeforces.com/api";
async function cfRequest(method, params = {}) {
  const url = new URL(`${CF_API}/${method}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`Codeforces API error: ${response.status}`);
  const data = await response.json();
  if (data.status !== "OK") throw new Error(data.comment || "Codeforces API returned non-OK status");
  return data.result;
}
async function getUserInfo(handle) {
  const result = await cfRequest("user.info", { handles: handle });
  const user = result[0];
  if (!user) throw new Error(`Codeforces user "${handle}" not found`);
  return {
    handle: user.handle,
    rating: user.rating || 0,
    maxRating: user.maxRating || 0,
    rank: user.rank || "unrated",
    maxRank: user.maxRank || "unrated",
    avatar: user.titlePhoto || user.avatar || "",
    contribution: user.contribution || 0,
    friendOfCount: user.friendOfCount || 0,
    registrationTimeSeconds: user.registrationTimeSeconds || 0
  };
}
async function getRecentSubmissions2(handle, count = 20) {
  const result = await cfRequest("user.status", { handle, from: "1", count: String(count) });
  return result.map((s) => ({
    id: s.id,
    problemName: s.problem?.name || "Unknown",
    problemRating: s.problem?.rating || 0,
    verdict: s.verdict || "UNKNOWN",
    language: s.programmingLanguage || "",
    timestamp: s.creationTimeSeconds || 0,
    contestId: s.contestId || 0,
    problemIndex: s.problem?.index || ""
  }));
}
async function getSolvedCount(handle) {
  const result = await cfRequest("user.status", { handle, from: "1", count: "10000" });
  const accepted = /* @__PURE__ */ new Set();
  const byRating = {};
  for (const s of result) {
    if (s.verdict === "OK") {
      const key = `${s.problem?.contestId}-${s.problem?.index}`;
      if (!accepted.has(key)) {
        accepted.add(key);
        const rating = s.problem?.rating || 0;
        if (rating > 0) {
          byRating[rating] = (byRating[rating] || 0) + 1;
        }
      }
    }
  }
  return { total: accepted.size, byRating };
}
async function getRatingHistory(handle) {
  const result = await cfRequest("user.rating", { handle });
  return result.map((r) => ({
    contestId: r.contestId,
    contestName: r.contestName,
    rank: r.rank,
    oldRating: r.oldRating,
    newRating: r.newRating,
    ratingChange: r.newRating - r.oldRating,
    timestamp: r.ratingUpdateTimeSeconds
  }));
}
async function getUpcomingContests() {
  const result = await cfRequest("contest.list", { gym: "false" });
  return result.filter((c) => c.phase === "BEFORE").sort((a, b) => a.startTimeSeconds - b.startTimeSeconds).slice(0, 10).map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    phase: c.phase,
    startTimeSeconds: c.startTimeSeconds,
    durationSeconds: c.durationSeconds
  }));
}
async function getFullCodeforcesData(handle) {
  const [userInfo, solvedCount, submissions, ratingHistory, upcomingContests] = await Promise.all([
    getUserInfo(handle),
    getSolvedCount(handle),
    getRecentSubmissions2(handle),
    getRatingHistory(handle).catch(() => []),
    getUpcomingContests().catch(() => [])
  ]);
  return { userInfo, solvedCount, submissions, ratingHistory, upcomingContests };
}

// server/routers.ts
var daySchema = z2.number().int().min(0).max(6);
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  planner: router({
    subjects: protectedProcedure.query(({ ctx }) => listSubjects(ctx.user.id)),
    schedules: protectedProcedure.query(({ ctx }) => listSchedules(ctx.user.id)),
    tasks: protectedProcedure.query(({ ctx }) => listTasks(ctx.user.id)),
    createSubject: protectedProcedure.input(z2.object({ name: z2.string().min(1).max(120), code: z2.string().max(40).optional(), color: z2.string().max(20).optional(), days: z2.array(daySchema).min(1), startTime: z2.string().max(10).optional(), times: z2.record(z2.string(), z2.string().max(10)).optional() })).mutation(async ({ ctx, input }) => {
      const subjectId = await createSubject({ name: input.name, code: input.code, color: input.color, userId: ctx.user.id });
      await createSchedules(input.days.map((day) => {
        const t2 = input.times?.[String(day)] ?? input.startTime ?? void 0;
        return { subjectId, dayOfWeek: day, startTime: t2, userId: ctx.user.id };
      }));
      return { subjectId, days: input.days };
    }),
    deleteSubject: protectedProcedure.input(z2.object({ subjectId: z2.number().int().positive() })).mutation(({ ctx, input }) => deleteSubject(input.subjectId, ctx.user.id)),
    upsertSubject: protectedProcedure.input(z2.object({ name: z2.string().min(1).max(120), code: z2.string().max(40).optional(), color: z2.string().max(20).optional(), days: z2.array(daySchema).min(1), startTime: z2.string().max(10).optional(), times: z2.record(z2.string(), z2.string().max(10)).optional() })).mutation(async ({ ctx, input }) => {
      const subjectId = await upsertSubjectByName({ name: input.name, code: input.code, color: input.color, userId: ctx.user.id });
      await deleteSchedulesForSubject(subjectId);
      await createSchedules(input.days.map((day) => {
        const t2 = input.times?.[String(day)] ?? input.startTime ?? void 0;
        return { subjectId, dayOfWeek: day, startTime: t2, userId: ctx.user.id };
      }));
      return { subjectId, days: input.days };
    }),
    clearAllSubjects: protectedProcedure.mutation(async ({ ctx }) => {
      await clearAllSubjects(ctx.user.id);
      return { success: true };
    }),
    createTask: protectedProcedure.input(z2.object({ title: z2.string().min(1).max(255), subjectId: z2.number().int().positive().optional(), dueDate: z2.string().date().nullable().optional(), priority: z2.enum(["High", "Medium", "Low"]).default("Medium"), recurringDays: z2.array(z2.number().int().min(1).max(6)).default([]) })).mutation(async ({ ctx, input }) => {
      const taskId = await createTask({ title: input.title, subjectId: input.subjectId, dueDate: input.dueDate || null, priority: input.priority, recurringDays: input.recurringDays.join(","), userId: ctx.user.id });
      return { taskId };
    }),
    toggleTask: protectedProcedure.input(z2.object({ taskId: z2.number().int().positive(), isCompleted: z2.boolean() })).mutation(({ ctx, input }) => updateTask(input.taskId, ctx.user.id, input.isCompleted)),
    deleteTask: protectedProcedure.input(z2.object({ taskId: z2.number().int().positive() })).mutation(({ ctx, input }) => deleteTask(input.taskId, ctx.user.id)),
    // Calendar events
    events: protectedProcedure.query(({ ctx }) => listCalendarEvents(ctx.user.id)),
    createEvent: protectedProcedure.input(z2.object({
      kind: z2.enum(["holiday", "dayoff", "exam"]),
      title: z2.string().min(1).max(255),
      startDate: z2.string().date(),
      endDate: z2.string().date().optional(),
      subject: z2.string().max(255).optional(),
      examTime: z2.string().max(16).optional(),
      afterClass: z2.boolean().optional(),
      afterSubject: z2.string().max(255).optional()
    })).mutation(async ({ ctx, input }) => {
      const eventId = await createCalendarEvent({ ...input, endDate: input.endDate || input.startDate, userId: ctx.user.id });
      return { eventId };
    }),
    importEvents: protectedProcedure.input(z2.object({
      events: z2.array(z2.object({
        kind: z2.enum(["holiday", "dayoff", "exam"]),
        title: z2.string().min(1).max(255),
        startDate: z2.string().date(),
        endDate: z2.string().date().optional(),
        subject: z2.string().max(255).optional(),
        examTime: z2.string().max(16).optional()
      }))
    })).mutation(async ({ ctx, input }) => {
      const data = input.events.map((e) => ({ ...e, endDate: e.endDate || e.startDate, userId: ctx.user.id }));
      const ids = await bulkCreateCalendarEvents(data);
      return { count: ids.length };
    }),
    deleteEvent: protectedProcedure.input(z2.object({ eventId: z2.number().int().positive() })).mutation(({ ctx, input }) => deleteCalendarEvent(input.eventId, ctx.user.id)),
    // Class check-ins
    checkins: protectedProcedure.input(z2.object({ date: z2.string().date() })).query(({ ctx, input }) => listCheckins(ctx.user.id, input.date)),
    checkIn: protectedProcedure.input(z2.object({ subjectId: z2.number().int().positive(), checkinDate: z2.string().date(), status: z2.enum(["attended", "absent"]) })).mutation(({ ctx, input }) => upsertCheckin({ ...input, userId: ctx.user.id }))
  }),
  coding: router({
    getSettings: protectedProcedure.query(({ ctx }) => getCodingSettings(ctx.user.id)),
    saveSettings: protectedProcedure.input(z2.object({ leetcodeUsername: z2.string().optional(), codeforcesHandle: z2.string().optional(), leetcodeTarget: z2.number().int().min(0).optional(), codeforcesTarget: z2.number().int().min(0).optional() })).mutation(({ ctx, input }) => upsertCodingSettings(ctx.user.id, input)),
    leetcodeProfile: publicProcedure.input(z2.object({ username: z2.string().min(1) })).query(async ({ input }) => {
      return getFullLeetCodeData(input.username);
    }),
    codeforcesProfile: publicProcedure.input(z2.object({ handle: z2.string().min(1) })).query(async ({ input }) => {
      return getFullCodeforcesData(input.handle);
    }),
    upcomingContests: publicProcedure.query(async () => {
      return getUpcomingContests();
    })
  }),
  googleCalendar: router({
    connected: protectedProcedure.query(async ({ ctx }) => {
      return { connected: !!ctx.user.googleAccessToken };
    }),
    events: protectedProcedure.input(z2.object({
      timeMin: z2.string(),
      timeMax: z2.string()
    })).query(async ({ ctx, input }) => {
      const token = ctx.user.googleAccessToken;
      if (!token) return { events: [], connected: false };
      try {
        const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
        url.searchParams.set("timeMin", input.timeMin);
        url.searchParams.set("timeMax", input.timeMax);
        url.searchParams.set("singleEvents", "true");
        url.searchParams.set("orderBy", "startTime");
        url.searchParams.set("maxResults", "100");
        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
          console.warn("[GoogleCalendar] API error:", res.status, await res.text().catch(() => ""));
          return { events: [], connected: true, error: res.status === 401 ? "Token expired \u2014 please re-login" : "Could not fetch events" };
        }
        const data = await res.json();
        const events = (data.items ?? []).map((item) => ({
          id: `gcal-${item.id}`,
          title: item.summary || "Untitled",
          start: item.start?.date || item.start?.dateTime?.split("T")[0] || "",
          end: item.end?.date || item.end?.dateTime?.split("T")[0] || "",
          kind: "google",
          allDay: !!item.start?.date,
          time: item.start?.dateTime ? new Date(item.start.dateTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : void 0
        }));
        return { events, connected: true };
      } catch (err) {
        console.error("[GoogleCalendar] Fetch error:", err);
        return { events: [], connected: true, error: "Network error" };
      }
    })
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await getUserFromRequest(opts.req);
  } catch {
    user = null;
  }
  if (!user) {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch {
      user = null;
    }
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// api/entry.ts
process.env.NODE_ENV = process.env.NODE_ENV || "production";
var app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
registerStorageProxy(app);
registerGoogleAuthRoutes(app);
registerOAuthRoutes(app);
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext
  })
);
var entry_default = app;
export {
  entry_default as default
};
