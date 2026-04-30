export const config = {
  runtime: "edge",
};

const TARGET_DOMAIN = (process.env.TARGET_DOMAIN || "").replace(/\/$/, "");

const STRIP_HEADERS = new Set([
  "host", "connection", "keep-alive", "proxy-authenticate", 
  "proxy-authorization", "te", "trailer", "transfer-encoding", 
  "upgrade", "forwarded", "x-forwarded-host", "x-forwarded-proto", 
  "x-forwarded-port",
]);

export default async function handler(req) {
  if (!TARGET_DOMAIN) {
    return new Response("Infrastructure Configuration Missing", { status: 500 });
  }

  try {
    const url = new URL(req.url);
    const targetUrl = TARGET_DOMAIN + url.pathname + url.search;

    const headers = new Headers();
    for (const [key, value] of req.headers) {
      const k = key.toLowerCase();
      if (STRIP_HEADERS.has(k) || k.startsWith("x-vercel-")) continue;
      headers.set(k, value);
    }

    const fetchOpts = {
      method: req.method,
      headers,
      redirect: "manual",
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      fetchOpts.body = req.body;
      fetchOpts.duplex = "half";[cite: 3]
    }

    const upstream = await fetch(targetUrl, fetchOpts);
    
    if (url.pathname === "/static/assets/sync") {
        const text = await upstream.text();
        return new Response(text, { status: upstream.status });
    }

    const respHeaders = new Headers();
    for (const [k, v] of upstream.headers) {
      if (k.toLowerCase() === "transfer-encoding") continue;
      respHeaders.set(k, v);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: respHeaders,
    });
  } catch (err) {
    return new Response("Service Temporarily Unavailable", { status: 503 });
  }
}
