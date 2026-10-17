module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Set-Cookie", [
    "atlas_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    "atlas_pkce=; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
  ]);
  return res.status(204).end();
};
