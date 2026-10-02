const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const ACCEPT = "Joyfully accepting";
const DECLINE = "Regretfully declining";
const SESSION_COOKIE = "__Host-vt-rsvp";
const SESSION_SECONDS = 12 * 60 * 60;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
export async function digest(value) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(bytes)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
function constantEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length)
    return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++)
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
function textField(data, field, max, required = false) {
  const value = data[field] ?? "";
  if (
    typeof value !== "string" ||
    value.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  ) {
    throw new HttpError(400, "Please check your form details and try again.");
  }
  const cleaned = value.trim();
  if (required && !cleaned)
    throw new HttpError(400, "Please enter your name and phone number.");
  return cleaned;
}
export function validateRSVP(data) {
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new HttpError(400, "Invalid form.");
  if (data._honey) throw new HttpError(400, "Unable to accept this response.");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      data.submission_id || "",
    )
  ) {
    throw new HttpError(400, "Please refresh the invitation and try again.");
  }
  const full_name = textField(data, "full_name", 100, true);
  const phone = textField(data, "phone", 30, true);
  if (
    !/^[+\d\s().-]+$/.test(phone) ||
    phone.replace(/\D/g, "").length < 7 ||
    phone.replace(/\D/g, "").length > 15
  ) {
    throw new HttpError(
      400,
      "Please enter a valid phone number, including your country code if needed.",
    );
  }
  if (![ACCEPT, DECLINE].includes(data.attendance))
    throw new HttpError(400, "Please choose whether you will attend.");
  const attending = data.attendance === ACCEPT;
  if (attending && !["One day", "Both days"].includes(data.days))
    throw new HttpError(400, "Please choose how many days you will attend.");
  if (
    attending &&
    (!Number.isInteger(data.additional_guests) ||
      data.additional_guests < 0 ||
      data.additional_guests > 8)
  ) {
    throw new HttpError(
      400,
      "Please choose between 0 and 8 additional guests.",
    );
  }
  return {
    full_name,
    phone,
    attendance: data.attendance,
    days: attending ? data.days : "Not attending",
    additional_guests: attending ? data.additional_guests : 0,
    guest_names:
      attending && data.additional_guests > 0
        ? textField(data, "guest_names", 300)
        : "",
    notes: attending ? textField(data, "notes", 1000) : "",
  };
}
async function readJSON(request) {
  if (!request.headers.get("Content-Type")?.startsWith("application/json"))
    throw new HttpError(415, "JSON is required.");
  if (Number(request.headers.get("Content-Length") || 0) > 8192)
    throw new HttpError(413, "Form is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Please complete the form.");
  let length = 0,
    chunks = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 8192) {
      await reader.cancel();
      throw new HttpError(413, "Form is too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HttpError(400, "Invalid form data.");
  }
}
function requireOrigin(request, env, admin = false) {
  const origin = request.headers.get("Origin");
  const allowed = admin
    ? [new URL(request.url).origin]
    : (env.ALLOWED_ORIGINS || "").split(",");
  if (!origin || !allowed.includes(origin))
    throw new HttpError(403, "This request is not allowed.");
}
async function rateLimit(request, env, kind) {
  if (!env.RATE_LIMIT_SALT)
    throw new HttpError(
      503,
      "RSVP is temporarily unavailable. Please try again shortly.",
    );
  const now = Math.floor(Date.now() / 1000);
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  const fingerprint = await digest(`${env.RATE_LIMIT_SALT}:${ip}`);
  const limits =
    kind === "login"
      ? [
          [60, 10],
          [86400, 100],
        ]
      : [
          [60, 20],
          [86400, 200],
        ];
  const statements = limits.map(([window]) =>
    env.DB.prepare(
      "INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
    ).bind(
      `${kind}:${fingerprint}:${window}:${Math.floor(now / window)}`,
      (Math.floor(now / window) + 1) * window,
    ),
  );
  statements.push(
    env.DB.prepare("DELETE FROM rate_limits WHERE expires_at < ?").bind(
      now - 86400,
    ),
  );
  const results = await env.DB.batch(statements);
  if (limits.some(([, max], i) => results[i].results[0].count > max)) {
    throw new HttpError(
      429,
      "Too many attempts. Please wait a few minutes before trying again.",
    );
  }
}
function cookieToken(request) {
  const token = request.headers
    .get("Cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(SESSION_COOKIE + "="))
    ?.slice(SESSION_COOKIE.length + 1);
  return /^[0-9a-f]{64}$/.test(token || "") ? token : "";
}
async function requireSession(request, env) {
  const token = cookieToken(request);
  if (!token)
    throw new HttpError(401, "Please sign in to view the guest list.");
  const hash = await digest(token);
  const row = await env.DB.prepare(
    "SELECT expires_at FROM sessions WHERE token_hash = ?",
  )
    .bind(hash)
    .first();
  if (!row || row.expires_at <= Math.floor(Date.now() / 1000))
    throw new HttpError(401, "Your session has expired. Please sign in again.");
  return hash;
}
const sessionCookie = (token, seconds) =>
  `${SESSION_COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${seconds}`;

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (request.method === "OPTIONS" && path === "/api/rsvp") {
    requireOrigin(request, env);
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "600",
      },
    });
  }
  if (path === "/api/rsvp" && request.method === "POST") {
    requireOrigin(request, env);
    await rateLimit(request, env, "rsvp");
    const input = await readJSON(request);
    const data = validateRSVP(input);
    const hash = await digest(JSON.stringify(data));
    await env.DB.prepare(
      "INSERT INTO rsvps (id,payload_hash,full_name,phone,attendance,days,additional_guests,guest_names,notes) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
    )
      .bind(
        input.submission_id,
        hash,
        data.full_name,
        data.phone,
        data.attendance,
        data.days,
        data.additional_guests,
        data.guest_names,
        data.notes,
      )
      .run();
    const stored = await env.DB.prepare(
      "SELECT id,payload_hash,created_at FROM rsvps WHERE id = ?",
    )
      .bind(input.submission_id)
      .first();
    if (!stored)
      throw new HttpError(
        503,
        "We could not confirm your RSVP. Please try again.",
      );
    if (stored.payload_hash !== hash)
      throw new HttpError(
        409,
        "This response reference was already used. Please refresh and resubmit your updated details.",
      );
    return json(
      { success: true, receipt: stored.id, received_at: stored.created_at },
      201,
    );
  }
  if (path === "/api/login" && request.method === "POST") {
    requireOrigin(request, env, true);
    await rateLimit(request, env, "login");
    const input = await readJSON(request);
    const password = typeof input?.password === "string" ? input.password : "";
    if (
      !env.ADMIN_PASSWORD_HASH ||
      password.length > 200 ||
      !constantEqual(await digest(password), env.ADMIN_PASSWORD_HASH)
    ) {
      throw new HttpError(401, "The password is incorrect. Please try again.");
    }
    const token = [...crypto.getRandomValues(new Uint8Array(32))]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
    const now = Math.floor(Date.now() / 1000);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now),
      env.DB.prepare(
        "INSERT INTO sessions (token_hash,expires_at) VALUES (?,?)",
      ).bind(await digest(token), now + SESSION_SECONDS),
    ]);
    return json({ success: true }, 200, {
      "Set-Cookie": sessionCookie(token, SESSION_SECONDS),
    });
  }
  if (path === "/api/logout" && request.method === "POST") {
    requireOrigin(request, env, true);
    const token = cookieToken(request);
    if (token)
      await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?")
        .bind(await digest(token))
        .run();
    return json({ success: true }, 200, { "Set-Cookie": sessionCookie("", 0) });
  }
  if (path === "/api/admin/rsvps" && request.method === "GET") {
    await requireSession(request, env);
    const { results } = await env.DB.prepare(
      "SELECT id,full_name,phone,attendance,days,additional_guests,guest_names,notes,created_at FROM rsvps ORDER BY created_at DESC",
    ).all();
    return json({ responses: results, fetched_at: new Date().toISOString() });
  }
  if (path.startsWith("/api/")) return json({ error: "Not found." }, 404);
  if (path === "/") return Response.redirect(url.origin + "/admin", 302);
  if (path === "/robots.txt") return new Response("User-agent: *\nDisallow: /");
  if (request.method !== "GET" && request.method !== "HEAD")
    return new Response("Method not allowed", { status: 405 });
  if (!["/admin", "/admin/", "/admin.css", "/admin.js"].includes(path))
    return new Response("Not found", { status: 404 });
  if (path === "/admin" || path === "/admin/") url.pathname = "/index.html";
  return env.ASSETS.fetch(new Request(url, request));
}
export default {
  async fetch(request, env) {
    let response;
    try {
      response = await route(request, env);
    } catch (error) {
      response = json(
        {
          error:
            error instanceof HttpError
              ? error.message
              : "The service is temporarily unavailable. Please try again shortly.",
        },
        error instanceof HttpError ? error.status : 503,
      );
    }
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "DENY");
    headers.set("Referrer-Policy", "no-referrer");
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    const origin = request.headers.get("Origin");
    if (
      new URL(request.url).pathname === "/api/rsvp" &&
      (env.ALLOWED_ORIGINS || "").split(",").includes(origin)
    ) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Vary", "Origin");
    }
    if (response.status === 429) headers.set("Retry-After", "300");
    return new Response(response.body, { status: response.status, headers });
  },
};
