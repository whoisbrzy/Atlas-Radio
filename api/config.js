// Public runtime config for the client. Vercel injects the environment
// variables you set in Project → Settings → Environment Variables.
// Everything here is safe to expose: the client ID is public (it appears
// in the OAuth URL) and developer IDs only gate client-side UI.
module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    clientId: process.env.DISCORD_CLIENT_ID || "",
    developerIds: (process.env.DEVELOPER_IDS || "")
      .split(",")
      .map(id => id.trim())
      .filter(Boolean),
    blockedCountries: (process.env.BLOCKED_COUNTRIES || "")
      .split(",")
      .map(code => code.trim().toUpperCase())
      .filter(code => /^[A-Z]{2}$/.test(code))
  });
};
