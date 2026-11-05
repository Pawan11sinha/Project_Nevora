// A local stand-in for Supabase Auth and RPC, for testing cookie and session plumbing.
// It proves nothing about real Supabase behaviour. All credentials here are fake.
import { createServer } from "node:http";

const port = Number(process.argv[2] ?? 54999);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const users = {
  "customer@mock.test": { id: "00000000-0000-4000-8000-000000000001", admin: false },
  "admin@mock.test": { id: "00000000-0000-4000-8000-000000000002", admin: true },
};
const tokens = new Map();
const refresh = new Map();
let ttl = 3600, failRpc = false, seq = 0;
let stats = { user: 0, password: 0, refresh: 0, rpc: 0 };

function session(email) {
  const u = users[email];
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const access_token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: u.id, email, role: "authenticated", aud: "authenticated", exp, jti: ++seq })}.mock`;
  const refresh_token = `mock-refresh-${++seq}`;
  tokens.set(access_token, email);
  refresh.set(refresh_token, email);
  return {
    access_token, refresh_token, token_type: "bearer", expires_in: ttl, expires_at: exp,
    user: { id: u.id, aud: "authenticated", role: "authenticated", email, app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
  };
}

createServer((req, res) => {
  let raw = "";
  req.on("data", (d) => (raw += d));
  req.on("end", () => {
    const url = new URL(req.url, "http://x");
    const send = (status, body) => {
      res.writeHead(status, { "content-type": "application/json", "x-supabase-api-version": "2024-01-01" });
      res.end(JSON.stringify(body));
    };
    const body = raw ? JSON.parse(raw) : {};
    const bearer = (req.headers.authorization ?? "").replace("Bearer ", "");
    if (url.pathname === "/__mock/stats") return send(200, stats);
    if (url.pathname === "/__mock/reset") { stats = { user: 0, password: 0, refresh: 0, rpc: 0 }; return send(200, {}); }
    if (url.pathname === "/__mock/config") {
      if (url.searchParams.has("ttl")) ttl = Number(url.searchParams.get("ttl"));
      if (url.searchParams.has("failRpc")) failRpc = url.searchParams.get("failRpc") === "1";
      return send(200, { ttl, failRpc });
    }
    if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "password") {
      stats.password++;
      if (!users[body.email] || body.password !== "mock-password") return send(400, { code: "invalid_credentials", error_code: "invalid_credentials", msg: "Invalid login credentials" });
      return send(200, session(body.email));
    }
    if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "refresh_token") {
      stats.refresh++;
      const email = refresh.get(body.refresh_token);
      if (!email) return send(400, { error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
      return send(200, session(email));
    }
    if (url.pathname === "/auth/v1/user") {
      stats.user++;
      const email = tokens.get(bearer);
      if (!email) return send(403, { code: 403, error_code: "bad_jwt", msg: "invalid JWT" });
      const u = users[email];
      return send(200, { id: u.id, aud: "authenticated", role: "authenticated", email, app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" });
    }
    if (url.pathname === "/auth/v1/logout") return send(204, {});
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      stats.rpc++;
      if (failRpc) return send(500, { code: "XX000", message: "INTERNAL_DB_DETAIL_MARKER", details: null, hint: null });
      if (url.pathname.endsWith("deploy_test_is_admin")) return send(200, Boolean(users[tokens.get(bearer)]?.admin));
      if (url.pathname.endsWith("deploy_test_take_one")) return send(200, true);
      if (url.pathname.endsWith("deploy_test_load_purchase")) return send(200, true);
    }
    send(404, { message: "not mocked" });
  });
}).listen(port, "127.0.0.1", () => console.log(`mock supabase on ${port}`));
