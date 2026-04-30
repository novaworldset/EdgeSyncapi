export const config = { runtime: "edge" };

/**
 * High-performance edge utility for data synchronization.
 * Environment Variable: UPSTREAM_PROVIDER (e.g., https://your-backend.com)
 */
const REMOTE_SERVICE = (process.env.UPSTREAM_PROVIDER || "").replace(/\/$/, "");

const HOP_BY_HOP = new Set([
  "host", "connection", "upgrade", "forwarded", "te", "trailer", 
  "transfer-encoding", "proxy-authenticate", "proxy-authorization",
]);

export default async function handler(req) {
  const url = new URL(req.url);

  // 1. Bot/Browser Deception: 
  // If accessed via browser (GET) without XHTTP headers, show a generic message.
  const isBrowser = req.method === "GET" && !req.headers.get("x-xhttp-id");
  
  if (isBrowser && url.pathname === "/") {
    return new Response("Service Status: Operational", { 
        status: 200,
        headers: { "content-type": "text/plain" }
    });
  }

  if (!REMOTE_SERVICE) {
    return new Response("Configuration Not Found", { status: 404 });
  }

  try {
    // 2. Dynamic Routing: Forwards any path and query strings to the upstream.
    const targetUrl = REMOTE_SERVICE + url.pathname + url.search;
    const forwardHeaders = new Headers();

    for (const [key, value] of req.headers) {
      const k = key.toLowerCase();
      
      if (HOP_BY_HOP.has(k) || k.startsWith("x-vercel-")) {
        continue;
      }
      
      // Standardize IP forwarding headers
      if (k === "x-real-ip" || k === "x-forwarded-for") {
        forwardHeaders.set("x-forwarded-for", value);
        continue;
      }
      
      forwardHeaders.set(key, value);
    }

    // 3. Optimized Fetch with Streaming
    return await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
      duplex: "half",
      redirect: "manual",
    });

  } catch (err) {
    console.error("Gateway Exception:", err.message);
    return new Response("Service Unavailable", { status: 502 });
  }
}
