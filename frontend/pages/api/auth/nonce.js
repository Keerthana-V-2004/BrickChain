import { randomBytes } from "crypto";
import {
  CHALLENGE_MAX_AGE,
  NONCE_COOKIE,
  getSiteOrigin,
  serializeAuthCookie,
} from "../../../lib/auth";

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const nonce = randomBytes(16).toString("hex");
    const origin = getSiteOrigin(req);
    const issuedAt = new Date();
    const expirationTime = new Date(issuedAt.getTime() + CHALLENGE_MAX_AGE * 1000);

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Set-Cookie", serializeAuthCookie(NONCE_COOKIE, nonce, req, CHALLENGE_MAX_AGE));
    return res.status(200).json({
      nonce,
      domain: new URL(origin).host,
      uri: origin,
      issuedAt: issuedAt.toISOString(),
      expirationTime: expirationTime.toISOString(),
    });
  } catch (error) {
    console.error("Could not issue wallet authentication challenge:", error);
    return res.status(500).json({ error: "Could not start wallet sign-in." });
  }
}