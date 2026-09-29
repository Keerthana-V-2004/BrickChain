import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export const NONCE_COOKIE = "estatehub_nonce";
export const SESSION_COOKIE = "estatehub_session";
export const CHALLENGE_MAX_AGE = 5 * 60;
export const SESSION_MAX_AGE = 8 * 60 * 60;

const developmentSecretKey = Symbol.for("estatehub.development-session-secret");
if (process.env.NODE_ENV !== "production" && !globalThis[developmentSecretKey]) {
  globalThis[developmentSecretKey] = randomBytes(32).toString("hex");
}

function getSessionSecret() {
  if (process.env.SESSION_SECRET) {
    if (process.env.SESSION_SECRET.length < 32) {
      throw new Error("SESSION_SECRET must be at least 32 characters long.");
    }
    return process.env.SESSION_SECRET;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be configured in production.");
  }
  return globalThis[developmentSecretKey];
}

export function getSiteOrigin(req) {
  if (process.env.SITE_URL) {
    return new URL(process.env.SITE_URL).origin;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("SITE_URL must be configured in production.");
  }
  const forwardedProtocol = req.headers["x-forwarded-proto"]?.split(",")[0];
  const protocol = forwardedProtocol || "http";
  return new URL(`${protocol}://${req.headers.host}`).origin;
}

export function isSameOriginRequest(req, siteOrigin) {
  return req.headers.origin === siteOrigin;
}

export function serializeAuthCookie(name, value, req, maxAge) {
  const secure = process.env.NODE_ENV === "production" ||
    req.headers["x-forwarded-proto"] === "https";
  return `${name}=${encodeURIComponent(value)}; Path=/api/auth; Max-Age=${maxAge}; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
}

export function clearAuthCookie(name, req) {
  return serializeAuthCookie(name, "", req, 0);
}

export function createSessionToken(address, chainId) {
  const issuedAt = Date.now();
  const payload = Buffer.from(JSON.stringify({
    address,
    chainId,
    issuedAt,
    expiresAt: issuedAt + SESSION_MAX_AGE * 1000,
  })).toString("base64url");
  const signature = createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
  return payload + "." + signature;
}

export function readSession(token) {
  if (!token) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;

  const expected = createHmac("sha256", getSessionSecret()).update(payload).digest();
  const supplied = Buffer.from(signature, "base64url");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!session.address || !Number.isSafeInteger(session.chainId) || session.expiresAt <= Date.now()) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}