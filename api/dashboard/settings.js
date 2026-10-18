const { getDiscordSession, getGuilds, readServerSettings, writeServerSettings, isSameOrigin } = require("../../lib/discord-auth");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!isSameOrigin(req)) return res.status(403).json({ error: "origin_not_allowed" });
  if (req.method !== "GET" && req.method !== "PUT") {
    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  const session = await getDiscordSession(req, res).catch(() => null);
  if (!session) return res.status(401).json({ error: "not_authenticated" });
  const guildId = String(req.query.guildId || "");
  if (!/^\d{15,22}$/.test(guildId)) return res.status(400).json({ error: "invalid_server" });

  try {
    const guilds = await getGuilds(session.accessToken);
    if (!guilds.some(guild => String(guild.id) === guildId)) return res.status(403).json({ error: "server_not_accessible" });
    if (req.method === "GET") return res.status(200).json({ settings: await readServerSettings(session.userId, guildId) });

    const settings = normalizeSettings(req.body);
    await writeServerSettings(session.userId, guildId, settings);
    return res.status(200).json({ settings });
  } catch (error) {
    const storageUnavailable = error.message.includes("storage is not configured");
    const invalidSettings = error.message === "Invalid settings.";
    if (!storageUnavailable) console.error("Dashboard settings request failed:", error.message);
    return res.status(storageUnavailable ? 503 : invalidSettings ? 400 : 502).json({ error: storageUnavailable ? "settings_storage_not_configured" : invalidSettings ? "invalid_settings" : "settings_unavailable" });
  }
};

function normalizeSettings(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid settings.");
  const presets = Array.isArray(input.presets) ? input.presets.slice(0, 40).map((preset, index) => {
    const label = String(preset && preset.label || "").trim().slice(0, 40);
    const text = String(preset && preset.text || "").trim().slice(0, 500);
    return { id: String(preset && preset.id || `preset-${index}`).slice(0, 80), label, text };
  }).filter(preset => preset.label && preset.text) : [];
  const style = ["Natural", "Dispatch", "Calm", "Urgent", "Custom"].includes(input.voiceStyle) ? input.voiceStyle : "Natural";
  const boundedInt = value => Number.isInteger(value) ? Math.max(-10, Math.min(10, value)) : 0;
  return {
    callSign: String(input.callSign || "").trim().slice(0, 40),
    includeCallSign: Boolean(input.includeCallSign),
    sayOver: Boolean(input.sayOver),
    voiceStyle: style,
    voiceRate: boundedInt(input.voiceRate),
    voicePitch: boundedInt(input.voicePitch),
    presets
  };
}
