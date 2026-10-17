const crypto = require("crypto");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const session = req.cookies && req.cookies.atlas_session;
  if (!clientSecret || !session) return res.status(401).json({ error: "not_authenticated" });
  const parts = session.split(".");
  if (parts.length !== 2) return res.status(401).json({ error: "invalid_session" });
  const expected = crypto.createHmac("sha256", clientSecret).update(parts[0]).digest();
  let actual;
  try { actual = Buffer.from(parts[1], "base64url"); } catch (_) { return res.status(401).json({ error: "invalid_session" }); }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    return res.status(401).json({ error: "invalid_session" });
  }
  let payload;
  try { payload = JSON.parse(Buffer.from(parts[0], "base64url").toString()); } catch (_) {
    return res.status(401).json({ error: "invalid_session" });
  }
  if (!payload.accessToken || payload.exp < Date.now()) return res.status(401).json({ error: "session_expired" });
  try {
    const response = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${payload.accessToken}` }
    });
    if (response.status === 401 && payload.refreshToken) {
      const refresh = await fetch("https://discord.com/api/v10/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.DISCORD_CLIENT_ID,
          client_secret: clientSecret,
          grant_type: "refresh_token",
          refresh_token: payload.refreshToken
        })
      });
      if (!refresh.ok) return res.status(401).json({ error: "session_expired" });
      const tokens = await refresh.json();
      if (!tokens.access_token) return res.status(401).json({ error: "session_expired" });
      const renewed = Buffer.from(JSON.stringify({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || payload.refreshToken,
        exp: Date.now() + Math.max(30, Number(tokens.expires_in) || 3600) * 1000
      })).toString("base64url");
      const renewedSignature = crypto.createHmac("sha256", clientSecret).update(renewed).digest("base64url");
      res.setHeader("Set-Cookie", `atlas_session=${renewed}.${renewedSignature}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.max(30, Number(tokens.expires_in) || 3600)}`);
      const profile = await fetch("https://discord.com/api/v10/users/@me", {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });
      if (!profile.ok) throw new Error(`Discord profile lookup failed (${profile.status})`);
      return res.status(200).json(await profile.json());
    }
    if (!response.ok) throw new Error(`Discord profile lookup failed (${response.status})`);
    return res.status(200).json(await response.json());
  } catch (error) {
    console.error("Discord profile lookup failed:", error.message);
    return res.status(502).json({ error: "discord_unavailable" });
  }
};
