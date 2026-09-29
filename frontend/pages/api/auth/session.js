import { SESSION_COOKIE, readSession } from "../../../lib/auth";

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  res.setHeader("Cache-Control", "no-store");
  try {
    const session = readSession(req.cookies[SESSION_COOKIE]);
    if (!session) return res.status(200).json({ authenticated: false });
    return res.status(200).json({
      authenticated: true,
      address: session.address,
      chainId: session.chainId,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    console.error("Could not read wallet session:", error);
    return res.status(500).json({ error: "Could not read wallet session." });
  }
}