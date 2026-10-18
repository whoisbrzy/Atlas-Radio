const crypto = require("crypto");

module.exports = async (req, res) => {
  const query = req.query || {};
  const origin = getOrigin(req);
  const redirectUri = `${origin}/auth/callback`;
  const returnTo = origin;
  const state = String(query.state || "");
  const desktop = Boolean(state && req.cookies && req.cookies.atlas_desktop === state);

  if (query.error || !query.code || !state) {
    return redirectError(res, returnTo, state, "discord_denied", desktop);
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("Discord OAuth is missing DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET.");
    return redirectError(res, returnTo, state, "oauth_not_configured", desktop);
  }

  // Vercel exposes cookies on req.cookies; this value is set by /api/auth/start.
  const verifier = req.cookies && req.cookies.atlas_pkce;
  if (!verifier) return redirectError(res, returnTo, state, "oauth_session_expired", desktop);

  try {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code: String(query.code),
      redirect_uri: redirectUri,
      code_verifier: verifier
    });
    const tokenResponse = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    if (!tokenResponse.ok) throw new Error(`Discord token exchange failed (${tokenResponse.status})`);
    const tokens = await tokenResponse.json();
    if (!tokens.access_token) throw new Error("Discord returned no access token");
    const payload = Buffer.from(JSON.stringify({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      exp: Date.now() + Math.max(30, Number(tokens.expires_in) || 3600) * 1000
    })).toString("base64url");
    const signature = crypto.createHmac("sha256", clientSecret).update(payload).digest("base64url");
    const session = `${payload}.${signature}`;
    const cookies = [
      `atlas_pkce=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
      `atlas_session=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.max(30, Number(tokens.expires_in) || 3600)}`
    ];
    if (desktop) cookies.push("atlas_desktop=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
    res.setHeader("Set-Cookie", cookies);
    if (desktop) {
      return res.redirect(302, `atlas-radio://auth/callback?atlas_session=${encodeURIComponent(session)}&state=${encodeURIComponent(state)}`);
    }
    return res.redirect(302, `${returnTo}?atlas_session=1&state=${encodeURIComponent(state)}`);
  } catch (error) {
    console.error("Discord OAuth callback failed:", error.message);
    return redirectError(res, returnTo, state, "oauth_exchange_failed", desktop);
  }
};

function getOrigin(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto.split(",")[0].trim()}://${String(host).split(",")[0].trim()}`;
}

function redirectError(res, returnTo, state, error, desktop) {
  if (desktop) {
    return res.redirect(302, `atlas-radio://auth/callback?atlas_error=${encodeURIComponent(error)}&state=${encodeURIComponent(state)}`);
  }
  return res.redirect(302, `${returnTo}?atlas_error=${encodeURIComponent(error)}&state=${encodeURIComponent(state)}`);
}
