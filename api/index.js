export const config = { runtime: "edge" };

/**
 * Global configuration:
 * Set "UPSTREAM_PROVIDER" in Vercel Environment Variables.
 * Example: https://api.yourserver.com
 */
const REMOTE_SERVICE = (process.env.UPSTREAM_PROVIDER || "").replace(/\/$/, "");

const HOP_BY_HOP_HEADERS = new Set([
  "host",
  "connection",
  "upgrade",
  "forwarded",
  "te",
  "trailer",
  "transfer-encoding",
  "proxy-authenticate",
  "proxy-authorization",
]);

export default async function handler(req) {
  const url = new URL(req.url);

  // Default health check for browser access
  if (req.method === "GET" && url.pathname !== "/sync") {
    return new Response("Service Status: Operational", { 
        status: 200,
        headers: { "content-type": "text/plain" }
    });
  }

  if (!REMOTE_SERVICE) {
    return new Response("Service Configuration Missing", { status: 404 });
  }

  try {
    const targetUrl = REMOTE_SERVICE + url.pathname + url.search;
    const forwardHeaders = new Headers();

    // Single-pass header sanitization
    for (const [key, value] of req.headers) {
      const k = key.toLowerCase();
      
      if (HOP_BY_HOP_HEADERS.has(k) || k.startsWith("x-vercel-")) {
        continue;
      }
      
      // Standardize client IP forwarding
      if (k === "x-real-ip" || k === "x-forwarded-for") {
        forwardHeaders.set("x-forwarded-for", value);
        continue;
      }
      
      forwardHeaders.set(key, value);
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
      duplex: "half",
      redirect: "manual",
    });

    return response;
  } catch (err) {
    // Generic error logging for debugging
    console.error("Gateway Error:", err.message);
    return new Response("Service Unavailable", { status: 504 });
  }
}