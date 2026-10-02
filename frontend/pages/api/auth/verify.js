import { getAddress, verifyMessage } from "ethers";
import config from "../../../config.json";
import { createSignInMessage } from "../../../lib/auth-message";
import {
  CHALLENGE_MAX_AGE,
  NONCE_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  getSiteOrigin,
  isSameOriginRequest,
  serializeAuthCookie,
  clearAuthCookie,
} from "../../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const origin = getSiteOrigin(req);
    if (!isSameOriginRequest(req, origin)) {
      return res.status(403).json({ error: "Sign-in request origin was not trusted." });
    }

    const nonce = req.cookies[NONCE_COOKIE];
    const { address, chainId, issuedAt, expirationTime, signature } = req.body || {};
    const numericChainId = Number(chainId);
    if (!nonce || !address || !signature || !Number.isSafeInteger(numericChainId)) {
      return res.status(400).json({ error: "The wallet challenge is incomplete or expired." });
    }
    if (!config[String(numericChainId)]) {
      return res.status(403).json({ error: "This network is not configured for EstateHub." });
    }

    const issuedAtMs = Date.parse(issuedAt);
    const expirationMs = Date.parse(expirationTime);
    const now = Date.now();
    if (
      !Number.isFinite(issuedAtMs) ||
      !Number.isFinite(expirationMs) ||
      issuedAtMs > now + 30_000 ||
      now > expirationMs ||
      expirationMs - issuedAtMs > CHALLENGE_MAX_AGE * 1000
    ) {
      return res.status(401).json({ error: "The wallet challenge expired. Try signing in again." });
    }

    const normalizedAddress = getAddress(address);
    const message = createSignInMessage({
      domain: new URL(origin).host,
      address: normalizedAddress,
      uri: origin,
      chainId: numericChainId,
      nonce,
      issuedAt: new Date(issuedAtMs).toISOString(),
      expirationTime: new Date(expirationMs).toISOString(),
    });
    const recoveredAddress = getAddress(verifyMessage(message, signature));
    if (recoveredAddress !== normalizedAddress) {
      return res.status(401).json({ error: "Wallet signature did not match the account." });
    }

    const sessionToken = createSessionToken(normalizedAddress, numericChainId);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Set-Cookie", [
      clearAuthCookie(NONCE_COOKIE, req),
      clearAuthCookie(SESSION_COOKIE, req),
      serializeAuthCookie(SESSION_COOKIE, sessionToken, req, SESSION_MAX_AGE, "/"),
    ]);
    return res.status(200).json({ address: normalizedAddress });
  } catch (error) {
    console.error("Wallet authentication failed:", error);
    return res.status(401).json({ error: "Wallet authentication could not be verified." });
  }
}