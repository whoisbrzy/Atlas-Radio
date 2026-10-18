const { getDiscordSession, getGuilds } = require("../../lib/discord-auth");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const session = await getDiscordSession(req, res).catch(() => null);
  if (!session) return res.status(401).json({ error: "not_authenticated" });
  try {
    const guilds = await getGuilds(session.accessToken);
    return res.status(200).json({ servers: guilds.map(guild => ({
      id: String(guild.id),
      name: String(guild.name || "Discord server"),
      icon: guild.icon && /^\d+$/.test(String(guild.id)) ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128` : null
    })) });
  } catch (error) {
    console.error("Discord server list failed:", error.message);
    if (error.message.includes("(403)")) return res.status(403).json({ error: "discord_scope_missing" });
    return res.status(502).json({ error: "discord_unavailable" });
  }
};
