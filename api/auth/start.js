const crypto = require("crypto");

module.exports = (req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId || !process.env.DISCORD_CLIENT_SECRET) {
    return res.status(503).json({ error: "discord_not_configured" });
  }
  const origin = getOrigin(req);
  const state = String(req.query.state || "");
  const challenge = String(req.query.challenge || "");
  const verifier = String(req.query.verifier || "");
  if (!/^[\w-]{16,128}$/.test(state) || !/^[A-Za-z0-9_-]{43}$/.test(challenge) || !/^[a-f0-9]{64}$/.test(verifier)) {
    return res.status(400).json({ error: "invalid_oauth_request" });
  }
  const expected = crypto.createHash("sha256").update(verifier).digest("base64url");
  if (expected !== challenge) return res.status(400).json({ error: "invalid_pkce" });
  res.setHeader("Set-Cookie", `atlas_pkce=${verifier}; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  const redirect = `${origin}/auth/callback`;
  const query = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirect,
    scope: "identify",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256"
  });
  return res.redirect(302, `https://discord.com/oauth2/authorize?${query}`);
};

function getOrigin(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto.split(",")[0].trim()}://${String(host).split(",")[0].trim()}`;
}
