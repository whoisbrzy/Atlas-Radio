import { next } from "@vercel/functions";

export default function middleware(request) {
  const blocked = (process.env.BLOCKED_COUNTRIES || "")
    .split(",")
    .map(code => code.trim().toUpperCase())
    .filter(code => /^[A-Z]{2}$/.test(code));
  const country = String(request.headers.get("x-vercel-ip-country") || "").toUpperCase();
  if (country && blocked.includes(country)) {
    return new Response(
      "<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Atlas unavailable</title><body style=\"margin:0;background:#080808;color:#f5f5f5;font:16px system-ui;display:grid;min-height:100vh;place-items:center;text-align:center\"><main><h1>Atlas is unavailable in your region</h1><p>Access to Atlas is restricted in your country.</p></main></body></html>",
      { status: 451, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
    );
  }
  return next();
}

export const config = { matcher: "/:path*" };
