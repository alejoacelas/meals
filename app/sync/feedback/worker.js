// meals - feedback backend. Creates public GitHub issues from app feedback and
// proxies browser audio to a managed transcription endpoint.

const MAX_JSON_BYTES = 20_000;
const MAX_FIELD_CHARS = 4_000;

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const url = new URL(request.url);
    try {
      if (request.method === "GET" && url.pathname === "/health") {
        return json({ ok: true, service: "meals-feedback" }, 200, cors);
      }
      if (request.method === "POST" && url.pathname === "/feedback") {
        return await handleFeedback(request, env, cors);
      }
      if (request.method === "POST" && url.pathname === "/transcribe") {
        return await handleTranscribe(request, env, cors);
      }
      return json({ error: "not found" }, 404, cors);
    } catch (error) {
      return json({ error: "request failed", detail: publicError(error) }, 500, cors);
    }
  },
};

async function handleFeedback(request, env, cors) {
  requireEnv(env, [
    "GITHUB_APP_ID",
    "GITHUB_APP_INSTALLATION_ID",
    "GITHUB_APP_PRIVATE_KEY",
    "GITHUB_REPO_OWNER",
    "GITHUB_REPO_NAME",
  ]);

  const feedback = normalizeFeedback(await readJson(request));
  const issue = await draftIssue(env, feedback);
  const created = await createIssue(env, issue);

  return json({
    ok: true,
    number: created.number,
    url: created.html_url,
  }, 200, cors);
}

async function handleTranscribe(request, env, cors) {
  requireEnv(env, [
    "MEALS_FEEDBACK_TRANSCRIPTION_API_KEY",
    "MEALS_FEEDBACK_TRANSCRIPTION_ENDPOINT",
  ]);

  const contentType = request.headers.get("Content-Type") || "";
  const upstream = new FormData();
  upstream.set("model", env.TRANSCRIPTION_MODEL || "nvidia/parakeet-tdt-0.6b-v3");

  if (contentType.includes("multipart/form-data")) {
    const incoming = await request.formData();
    const file = incoming.get("file") || incoming.get("audio");
    if (!file) return json({ error: "missing file" }, 400, cors);
    upstream.set("file", file);
    copyOptionalFields(incoming, upstream, ["language", "response_format", "timestamp_granularities"]);
  } else {
    const body = await readJson(request);
    if (!body.file && !body.fileUrl && !body.url) return json({ error: "missing file URL" }, 400, cors);
    upstream.set("file", String(body.file || body.fileUrl || body.url));
    ["language", "response_format", "timestamp_granularities"].forEach((field) => {
      if (body[field]) upstream.set(field, String(body[field]));
    });
  }

  const res = await fetch(env.MEALS_FEEDBACK_TRANSCRIPTION_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.MEALS_FEEDBACK_TRANSCRIPTION_API_KEY}` },
    body: upstream,
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: {
      ...cors,
      "Content-Type": res.headers.get("Content-Type") || "application/json",
    },
  });
}

async function draftIssue(env, feedback) {
  const fallback = fallbackIssue(feedback);
  if (!env.MEALS_FEEDBACK_OPENAI_API_KEY) return fallback;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.MEALS_FEEDBACK_OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || "gpt-4.1-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "You turn meals app feedback into a concise public GitHub issue.",
              "Return JSON with title and body only.",
              "Do not invent facts. Keep the body readable and actionable.",
            ].join(" "),
          },
          { role: "user", content: JSON.stringify(feedback) },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    return {
      title: cleanTitle(parsed.title) || fallback.title,
      body: cleanBody(parsed.body) || fallback.body,
    };
  } catch (error) {
    return fallback;
  }
}

function fallbackIssue(feedback) {
  const recipe = feedback.recipe?.title || feedback.recipe?.slug || "meals app";
  const signal = feedback.feedback || feedback.type || "feedback";
  const title = cleanTitle(`Feedback: ${recipe} - ${signal}`);
  const lines = [
    "## Feedback",
    "",
    `- Signal: ${cleanLine(signal)}`,
    feedback.message ? `- Message: ${cleanLine(feedback.message)}` : null,
    feedback.recipe?.title ? `- Recipe: ${cleanLine(feedback.recipe.title)}` : null,
    feedback.recipe?.slug ? `- Recipe slug: \`${cleanLine(feedback.recipe.slug)}\`` : null,
    feedback.kitchen ? `- Kitchen: ${cleanLine(feedback.kitchen)}` : null,
    feedback.diet ? `- Diet: ${cleanLine(feedback.diet)}` : null,
    feedback.page ? `- Page: ${cleanLine(feedback.page)}` : null,
    "",
    "## Raw context",
    "",
    "```json",
    JSON.stringify(feedback, null, 2).slice(0, MAX_FIELD_CHARS),
    "```",
  ].filter(Boolean);
  return { title, body: lines.join("\n") };
}

async function createIssue(env, issue) {
  const token = await installationToken(env);
  const owner = encodeURIComponent(env.GITHUB_REPO_OWNER);
  const repo = encodeURIComponent(env.GITHUB_REPO_NAME);
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: "POST",
    headers: githubHeaders(token),
    body: JSON.stringify({
      title: cleanTitle(issue.title),
      body: cleanBody(issue.body),
    }),
  });
  if (!res.ok) throw new Error(`GitHub issue create ${res.status}: ${await res.text()}`);
  return res.json();
}

async function installationToken(env) {
  const jwt = await githubJwt(env);
  const res = await fetch(
    `https://api.github.com/app/installations/${env.GITHUB_APP_INSTALLATION_ID}/access_tokens`,
    { method: "POST", headers: githubHeaders(jwt) },
  );
  if (!res.ok) throw new Error(`GitHub installation token ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (!data.token) throw new Error("GitHub did not return an installation token");
  return data.token;
}

async function githubJwt(env) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = { iat: now - 60, exp: now + 9 * 60, iss: String(env.GITHUB_APP_ID) };
  const input = `${base64urlJson(header)}.${base64urlJson(payload)}`;
  const key = await importPrivateKey(env.GITHUB_APP_PRIVATE_KEY);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(input),
  );
  return `${input}.${base64urlBytes(new Uint8Array(signature))}`;
}

async function importPrivateKey(pemValue) {
  const pem = String(pemValue).replace(/\\n/g, "\n");
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    bytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function githubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "meals-feedback-worker",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function readJson(request) {
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > MAX_JSON_BYTES) throw new Error("request body too large");
  return request.json();
}

function normalizeFeedback(input) {
  const body = input && typeof input === "object" ? input : {};
  return {
    type: cleanField(body.type || "feedback", 80),
    feedback: cleanField(body.feedback || body.signal || "", 80),
    message: cleanField(body.message || body.text || body.transcript || "", MAX_FIELD_CHARS),
    kitchen: cleanField(body.kitchen || body.username || "", 120),
    diet: cleanField(body.diet || "", 40),
    page: cleanField(body.page || body.url || "", 500),
    recipe: body.recipe && typeof body.recipe === "object" ? {
      slug: cleanField(body.recipe.slug || "", 120),
      title: cleanField(body.recipe.title || "", 200),
    } : null,
    context: body.context && typeof body.context === "object" ? body.context : {},
    createdAt: new Date().toISOString(),
  };
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = String(env.ALLOWED_ORIGINS || "*").split(",").map((x) => x.trim()).filter(Boolean);
  const allowOrigin = allowed.includes("*") || allowed.includes(origin) ? (origin || "*") : allowed[0] || "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function copyOptionalFields(from, to, fields) {
  fields.forEach((field) => {
    const value = from.get(field);
    if (value != null && value !== "") to.set(field, value);
  });
}

function requireEnv(env, names) {
  const missing = names.filter((name) => !env[name]);
  if (missing.length) throw new Error(`missing env: ${missing.join(", ")}`);
}

function cleanField(value, max) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanLine(value) {
  return cleanField(value, 500).replace(/[<>]/g, "");
}

function cleanTitle(value) {
  return cleanField(value, 120) || "Meals feedback";
}

function cleanBody(value) {
  return String(value == null ? "" : value).trim().slice(0, 60_000);
}

function publicError(error) {
  const message = error && error.message ? error.message : String(error);
  if (/secret|key|token|authorization/i.test(message)) return "configuration error";
  return message.slice(0, 200);
}

function base64urlJson(obj) {
  return base64urlBytes(new TextEncoder().encode(JSON.stringify(obj)));
}

function base64urlBytes(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
