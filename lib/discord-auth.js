const crypto = require("crypto");

async function getDiscordSession(req, res) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const session = req.cookies && req.cookies.atlas_session;
  if (!clientId || !clientSecret || !session) return null;

  const parts = session.split(".");
  if (parts.length !== 2) return null;
  const expected = crypto.createHmac("sha256", clientSecret).update(parts[0]).digest();
  let actual;
  try { actual = Buffer.from(parts[1], "base64url"); } catch (_) { return null; }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;

  let payload;
  try { payload = JSON.parse(Buffer.from(parts[0], "base64url").toString()); } catch (_) { return null; }
  if (!payload.accessToken) return null;

  if (payload.exp < Date.now() + 60_000 && payload.refreshToken) {
    const refresh = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: payload.refreshToken
      })
    });
    if (!refresh.ok) return null;
    const tokens = await refresh.json();
    if (!tokens.access_token) return null;
    payload = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || payload.refreshToken,
      exp: Date.now() + Math.max(30, Number(tokens.expires_in) || 3600) * 1000
    };
    const renewed = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto.createHmac("sha256", clientSecret).update(renewed).digest("base64url");
    const maxAge = Math.max(30, Number(tokens.expires_in) || 3600);
    res.setHeader("Set-Cookie", `atlas_session=${renewed}.${signature}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`);
  }

  const profileResponse = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bearer ${payload.accessToken}` }
  });
  if (!profileResponse.ok) return null;
  const profile = await profileResponse.json();
  if (!/^\d{15,22}$/.test(String(profile.id || ""))) return null;
  return { userId: String(profile.id), profile, accessToken: payload.accessToken };
}

async function getGuilds(accessToken) {
  const response = await fetch("https://discord.com/api/v10/users/@me/guilds?limit=200", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error(`Discord server list failed (${response.status})`);
  const guilds = await response.json();
  if (!Array.isArray(guilds)) throw new Error("Discord returned an invalid server list.");
  return guilds;
}

async function readServerSettings(userId, guildId) {
  const result = await kvCommand(["GET", `atlas:v1:${userId}:${guildId}`]);
  if (!result) return null;
  try { return JSON.parse(result); } catch (_) { return null; }
}

async function writeServerSettings(userId, guildId, settings) {
  await kvCommand(["SET", `atlas:v1:${userId}:${guildId}`, JSON.stringify(settings)]);
}

async function kvCommand(command) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("Shared settings storage is not configured.");
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command)
  });
  if (!response.ok) throw new Error(`Settings storage failed (${response.status}).`);
  const data = await response.json();
  if (data.error) throw new Error("Settings storage request failed.");
  return data.result;
}

function isSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return req.headers["sec-fetch-site"] !== "cross-site";
  try {
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    return new URL(origin).host === String(host).split(",")[0].trim();
  } catch (_) { return false; }
}

module.exports = { getDiscordSession, getGuilds, readServerSettings, writeServerSettings, isSameOrigin };
