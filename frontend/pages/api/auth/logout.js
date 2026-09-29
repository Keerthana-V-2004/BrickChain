import {
  NONCE_COOKIE,
  SESSION_COOKIE,
  clearAuthCookie,
  getSiteOrigin,
  isSameOriginRequest,
} from "../../../lib/auth";

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const origin = getSiteOrigin(req);
    if (!isSameOriginRequest(req, origin)) {
      return res.status(403).json({ error: "Logout request origin was not trusted." });
    }
    res.setHeader("Set-Cookie", [
      clearAuthCookie(NONCE_COOKIE, req),
      clearAuthCookie(SESSION_COOKIE, req),
    ]);
    return res.status(200).json({ authenticated: false });
  } catch (error) {
    console.error("Could not end wallet session:", error);
    return res.status(500).json({ error: "Could not end wallet session." });
  }
}