import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler, Request } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { createClient, type User as SupabaseUser } from "@supabase/supabase-js";
import { storage } from "./storage";

const hasReplitAuthConfig = Boolean(
  process.env.REPL_ID &&
    process.env.SESSION_SECRET &&
    process.env.DATABASE_URL,
);
const hasSupabaseConfig = Boolean(
  process.env.SUPABASE_URL &&
    process.env.SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const configuredAuthMode = (
  process.env.AUTH_MODE ||
    (hasSupabaseConfig ? "supabase" : hasReplitAuthConfig ? "replit" : "dev")
).toLowerCase();
const authMode =
  configuredAuthMode === "supabase" && !hasSupabaseConfig
    ? "dev"
    : configuredAuthMode;
const useSupabaseAuth = authMode === "supabase";
const useReplitAuth = authMode === "replit";
const supabaseServiceRoleClient = useSupabaseAuth
  ? createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  : null;

const fallbackClaims = {
  sub: process.env.DEV_USER_ID || "dev-user",
  email: process.env.DEV_USER_EMAIL || "dev@example.com",
  first_name: process.env.DEV_USER_FIRST_NAME || "Dev",
  last_name: process.env.DEV_USER_LAST_NAME || "User",
};

let fallbackUserUpsertPromise: Promise<void> | null = null;

async function ensureFallbackUser() {
  if (!fallbackUserUpsertPromise) {
    fallbackUserUpsertPromise = upsertUser(fallbackClaims);
  }
  await fallbackUserUpsertPromise;
}

function decodeJwtPayload(token?: string) {
  if (!token) return null;
  const [_, payload] = token.split(".");
  if (!payload) return null;

  const padded = payload.padEnd(payload.length + (4 - (payload.length % 4)) % 4, "=");
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");

  try {
    return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function getSupabaseTokenFromRequest(req: Request) {
  const authHeader = req.headers.authorization;
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.substring("bearer ".length).trim();
  }
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(/sb-access-token=([^;]+)/);
  return match?.[1];
}

function buildSupabaseClaims(user: SupabaseUser, token?: string) {
  const metadata = (user.user_metadata as Record<string, unknown>) || {};
  const payload = decodeJwtPayload(token);
  const expiresAt = typeof payload?.exp === "number"
    ? payload.exp
    : Math.floor(Date.now() / 1000) + 60 * 60;

  const firstName =
    typeof metadata.first_name === "string"
      ? metadata.first_name
      : typeof metadata.name === "string"
        ? metadata.name
        : "";
  const lastName = typeof metadata.last_name === "string" ? metadata.last_name : "";
  const profileImageUrl =
    typeof metadata.profile_image_url === "string"
      ? metadata.profile_image_url
      : typeof metadata.avatar_url === "string"
        ? metadata.avatar_url
        : "";

  return {
    sub: user.id,
    email: user.email ?? "",
    first_name: firstName,
    last_name: lastName,
    profile_image_url: profileImageUrl,
    exp: expiresAt,
  };
}

async function ensureSupabaseUser(req: Request, token?: string) {
  if (!token || !supabaseServiceRoleClient) {
    return false;
  }

  const { data, error } = await supabaseServiceRoleClient.auth.getUser(token);
  const supabaseUser = data?.user;
  if (error || !supabaseUser) {
    console.error("Supabase auth validation failed", error?.message);
    return false;
  }

  const claims = buildSupabaseClaims(supabaseUser, token);
  await storage.upsertUser({
    id: supabaseUser.id,
    email: supabaseUser.email ?? "",
    firstName: claims.first_name,
    lastName: claims.last_name,
    profileImageUrl: claims.profile_image_url,
  });

  (req as any).user = {
    claims,
    access_token: token,
    expires_at: claims.exp,
  };
  return true;
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  if (configuredAuthMode === "supabase" && !hasSupabaseConfig) {
    console.warn(
      "AUTH_MODE=supabase requested but required SUPABASE_* keys are missing. Falling back to DEV auth mode.",
    );
  }

  if (useSupabaseAuth) {
    console.info(
      "Supabase auth mode enabled; provide `Authorization: Bearer <access-token>` or `sb-access-token` cookie.",
    );
    return;
  }

  if (!useReplitAuth) {
    console.warn(
      "Running in DEV auth mode. Set AUTH_MODE=replit with REPL_ID, SESSION_SECRET, and DATABASE_URL for Replit OIDC.",
    );
    await ensureFallbackUser();
    app.use((req: any, _res, next) => {
      req.user = {
        claims: fallbackClaims,
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
      };
      next();
    });
    return;
  }

  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  const registeredStrategies = new Set<string>();

  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify,
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (useSupabaseAuth) {
    const token = getSupabaseTokenFromRequest(req);
    const valid = await ensureSupabaseUser(req, token);
    if (!valid) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    return next();
  }

  if (!useReplitAuth) {
    await ensureFallbackUser();
    (req as any).user = {
      claims: fallbackClaims,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
    };
    return next();
  }

  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
