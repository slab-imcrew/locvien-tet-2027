const PAYMENT = { bank: "ACB", account: "833336666" };

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8" },
});

const clean = (value, max = 500) => String(value ?? "").trim().slice(0, max);
const MARKETING_STATUSES = new Set(["new", "reviewing", "qualified", "handoff"]);
const SALES_STATUSES = new Set(["unassigned", "assigned", "in_progress", "won", "lost"]);
const CHANNELS = new Set(["zalo", "email", "call"]);

function paymentText(name, phone) {
  const asciiName = clean(name, 80)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9]/g, "");
  return `${asciiName}${clean(phone, 20).replace(/\D/g, "")}`.slice(0, 80);
}

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64url(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

async function createToken(secret) {
  const payload = base64url(new TextEncoder().encode(JSON.stringify({ exp: Date.now() + 86_400_000 })));
  return `${payload}.${await sign(payload, secret)}`;
}

async function validToken(request, secret) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || signature !== await sign(payload, secret)) return false;
  try { return JSON.parse(new TextDecoder().decode(fromBase64url(payload))).exp > Date.now(); } catch { return false; }
}

function qrUrl(description, amount) {
  const params = new URLSearchParams({ acc: PAYMENT.account, bank: PAYMENT.bank, amount: String(amount), des: description, template: "compact", showinfo: "true", fullacc: "true" });
  return `https://vietqr.app/img?${params.toString()}`;
}

async function api(request, env) {
  const url = new URL(request.url);
  const secret = env.ADMIN_PASSWORD || "1111";

  if (url.pathname === "/api/admin/login" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (String(body.password || "") !== secret) return json({ error: "Mật khẩu không đúng." }, 401);
    return json({ token: await createToken(secret) });
  }

  if (url.pathname === "/api/leads" && request.method === "POST") {
    if (!env.DB) return json({ error: "Database chưa được cấu hình." }, 503);
    const body = await request.json().catch(() => ({}));
    const name = clean(body.name, 100), company = clean(body.company, 160), phone = clean(body.phone, 30);
    if (!name || !company || !phone) return json({ error: "Vui lòng điền đủ họ tên, doanh nghiệp và số điện thoại." }, 400);
    const amount = Number(String(body.amount ?? "").replace(/\D/g, ""));
    if (!Number.isSafeInteger(amount) || amount <= 0) return json({ error: "Vui lòng nhập giá trị đơn hàng hợp lệ để tạo QR." }, 400);
    const description = paymentText(name, phone), createdAt = new Date().toISOString();
    const result = await env.DB.prepare(`INSERT INTO leads (name, company, phone, quantity, budget, custom_need, note, payment_description, amount, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(name, company, phone, clean(body.quantity, 60), clean(body.budget, 60), clean(body.custom, 80), clean(body.note, 1000), description, amount, createdAt).run();
    return json({ id: result.meta.last_row_id, createdAt, payment: { ...PAYMENT, amount, description, qrUrl: qrUrl(description, amount) } }, 201);
  }

  const leadMatch = url.pathname.match(/^\/api\/admin\/leads\/(\d+)(?:\/(activities))?$/);

  if (leadMatch && request.method === "PATCH") {
    if (!await validToken(request, secret)) return json({ error: "Unauthorized" }, 401);
    if (!env.DB) return json({ error: "Database chưa được cấu hình." }, 503);
    const leadId = Number(leadMatch[1]), body = await request.json().catch(() => ({}));
    const current = await env.DB.prepare("SELECT * FROM leads WHERE id = ?").bind(leadId).first();
    if (!current) return json({ error: "Không tìm thấy lead." }, 404);
    const marketingStatus = MARKETING_STATUSES.has(body.marketing_status) ? body.marketing_status : current.marketing_status;
    const salesStatus = SALES_STATUSES.has(body.sales_status) ? body.sales_status : current.sales_status;
    const assignedTo = clean(body.assigned_to, 100);
    const handedOffAt = marketingStatus === "handoff" ? (current.handed_off_at || new Date().toISOString()) : current.handed_off_at;
    await env.DB.prepare("UPDATE leads SET marketing_status = ?, sales_status = ?, assigned_to = ?, handed_off_at = ? WHERE id = ?").bind(marketingStatus, salesStatus, assignedTo, handedOffAt, leadId).run();
    if (body.activity_note) await env.DB.prepare("INSERT INTO lead_activities (lead_id, channel, note, created_by, created_at) VALUES (?, 'system', ?, ?, ?)").bind(leadId, clean(body.activity_note, 500), clean(body.created_by, 100), new Date().toISOString()).run();
    return json({ ok: true });
  }

  if (leadMatch && leadMatch[2] === "activities" && request.method === "GET") {
    if (!await validToken(request, secret)) return json({ error: "Unauthorized" }, 401);
    const activities = await env.DB.prepare("SELECT * FROM lead_activities WHERE lead_id = ? ORDER BY created_at DESC").bind(Number(leadMatch[1])).all();
    return json({ activities: activities.results });
  }

  if (leadMatch && leadMatch[2] === "activities" && request.method === "POST") {
    if (!await validToken(request, secret)) return json({ error: "Unauthorized" }, 401);
    if (!env.DB) return json({ error: "Database chưa được cấu hình." }, 503);
    const leadId = Number(leadMatch[1]), body = await request.json().catch(() => ({}));
    if (!CHANNELS.has(body.channel) || !clean(body.note, 1000)) return json({ error: "Vui lòng chọn kênh và ghi nội dung tư vấn." }, 400);
    const createdAt = new Date().toISOString();
    await env.DB.prepare("INSERT INTO lead_activities (lead_id, channel, note, created_by, created_at) VALUES (?, ?, ?, ?, ?)").bind(leadId, body.channel, clean(body.note, 1000), clean(body.created_by, 100), createdAt).run();
    await env.DB.prepare("UPDATE leads SET last_activity_at = ? WHERE id = ?").bind(createdAt, leadId).run();
    return json({ ok: true, createdAt }, 201);
  }

  if (url.pathname === "/api/admin/leads" && request.method === "GET") {
    if (!await validToken(request, secret)) return json({ error: "Unauthorized" }, 401);
    if (!env.DB) return json({ error: "Database chưa được cấu hình." }, 503);
    const marketing = url.searchParams.get("marketing_status");
    const sales = url.searchParams.get("sales_status");
    let query = "SELECT * FROM leads";
    const conditions = [], bindings = [];
    if (MARKETING_STATUSES.has(marketing)) { conditions.push("marketing_status = ?"); bindings.push(marketing); }
    if (SALES_STATUSES.has(sales)) { conditions.push("sales_status = ?"); bindings.push(sales); }
    if (conditions.length) query += ` WHERE ${conditions.join(" AND ")}`;
    query += " ORDER BY COALESCE(last_activity_at, created_at) DESC LIMIT 200";
    const { results } = await env.DB.prepare(query).bind(...bindings).all();
    return json({ leads: results });
  }

  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return api(request, env);
    return env.ASSETS.fetch(request);
  },
};
