// meals — kitchen sync. A tiny public key/value store so a kitchen name follows
// you across devices. Deploy to Cloudflare Workers (free). See README.md.
//
// By design this is PUBLIC and unauthenticated: anyone who knows a kitchen name
// can read and overwrite it — exactly the app's sharing model. Store nothing
// secret. The endpoint URL is safe to commit (in app/config.js).

const MAX_BYTES = 100_000; // a kitchen is a small basket + a list of saved slugs

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const url = new URL(request.url);
    const name = decodeURIComponent(url.pathname.replace(/^\/+/, "")).toLowerCase().trim().slice(0, 64);
    if (!name) return json({ error: "missing kitchen name in path" }, 400, cors);
    const key = "k:" + name;

    if (request.method === "GET") {
      const v = await env.KITCHENS.get(key);
      return json(v ? JSON.parse(v) : {}, 200, cors);
    }
    if (request.method === "PUT") {
      let body;
      try { body = await request.json(); } catch (e) { return json({ error: "invalid JSON" }, 400, cors); }
      const s = JSON.stringify(body);
      if (s.length > MAX_BYTES) return json({ error: "payload too large" }, 413, cors);
      await env.KITCHENS.put(key, s);
      return json({ ok: true }, 200, cors);
    }
    return json({ error: "method not allowed" }, 405, cors);
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
