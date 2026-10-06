export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (request.method === "OPTIONS") {
      return new Response(null, { 
        status: 204, 
        headers: { 
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
          "Access-Control-Allow-Headers": "Authorization,Content-Type",
        } 
      });
    }

    const path = url.pathname.replace("/api", "") + url.search;
    const targetUrl = `https://discord.com/api/v10${path}`;
    
    const auth = request.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), { 
        status: 401, 
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
      });
    }

    const method = request.method;
    const isGet = method === "GET";

    const headers = new Headers({
      "Authorization": auth,
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "Accept-Encoding": "gzip, deflate, br",
    });

    const init = { method, headers };
    if (!isGet) {
      const body = await request.text();
      if (body) init.body = body;
    }

    try {
      const response = await fetch(targetUrl, init);
      
      const respHeaders = new Headers(response.headers);
      respHeaders.set("Access-Control-Allow-Origin", "*");
      respHeaders.set("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
      respHeaders.set("Access-Control-Allow-Headers", "Authorization,Content-Type");
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: respHeaders
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: "Proxy error", detail: err.message }), { 
        status: 502, 
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
      });
    }
  }
};
