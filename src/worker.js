const DISCORD_API = "https://discord.com/api/v10";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type,X-Requested-With",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Allow-Credentials": "true"
};

const CACHEABLE_GET = new Set([
  "/users/@me",
  "/users/@me/guilds",
  "/guilds/",
  "/channels/",
  "/roles",
  "/emojis",
  "/stickers",
  "/webhooks",
  "/invites",
  "/bans",
  "/members",
  "/voice/regions"
]);

function isCacheable(path) {
  return CACHEABLE_GET.some(p => path.startsWith(p));
}

function stripAuth(headers) {
  const h = new Headers(headers);
  h.delete("authorization");
  h.delete("cookie");
  h.delete("x-forwarded-for");
  h.delete("x-real-ip");
  return h;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const path = url.pathname.replace("/api", "") + url.search;
    const targetUrl = `https://discord.com/api/v10${path}`;
    
    const auth = request.headers.get("Authorization");
    if (!auth) {
      return corsResponse({ error: "Missing Authorization" }, 401);
    }

    const method = request.method;
    const isGet = method === "GET";
    const cacheable = isGet && isCacheable(path);

    const headers = new Headers({
      "Authorization": auth,
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "Accept-Encoding": "gzip, deflate, br, zstd",
      "Connection": "keep-alive"
    });

    const init = {
      method,
      headers,
      cf: {
        cacheTtl: cacheable ? 5 : 0,
        cacheEverything: cacheable,
        cacheKey: targetUrl,
        resolveOverride: "discord.com",
        minify: { javascript: true, css: true, html: true },
        brotli: true,
        earlyHints: true
      }
    };

    if (!isGet) {
      const body = await request.text();
      if (body) init.body = body;
      init.cf.cacheTtl = 0;
      init.cf.cacheEverything = false;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    try {
      const response = await fetch(targetUrl, {
        ...init,
        signal: controller.signal
      });
      clearTimeout(timeout);

      const respHeaders = new Headers(response.headers);
      Object.entries(CORS_HEADERS).forEach(([k, v]) => respHeaders.set(k, v));
      
      respHeaders.set("X-Proxy", "cloudflare-worker");
      respHeaders.set("X-Cache", response.cf?.cacheStatus || "MISS");
      
      if (isGet && response.ok) {
        respHeaders.set("Cache-Control", "public, max-age=5, stale-while-revalidate=30");
      } else {
        respHeaders.set("Cache-Control", "no-store, must-revalidate");
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        if (retryAfter) respHeaders.set("Retry-After", retryAfter);
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: respHeaders
      });

    } catch (err) {
      clearTimeout(timeout);
      if (err.name === "AbortError") {
        return corsResponse({ error: "Request timeout", retry: true }, 504);
      }
      return corsResponse({ error: "Proxy error", detail: err.message }, 502);
    }
  }
};

function corsResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS }
  });
}