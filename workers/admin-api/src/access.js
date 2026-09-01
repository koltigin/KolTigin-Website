import { HttpError } from "./util.js";

function b64urlToBytes(input) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function decodeJwt(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new HttpError(401, "Missing Access assertion");
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  return { header, payload, signed: `${parts[0]}.${parts[1]}`, signature: b64urlToBytes(parts[2]) };
}

async function getJwks(env) {
  const team = String(env.ACCESS_TEAM_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!team) throw new HttpError(500, "Access is not configured");
  const url = `https://${team}/cdn-cgi/access/certs`;
  const response = await fetch(url, { cf: { cacheTtl: 3600 } }).catch(() => null);
  if (!response || !response.ok) throw new HttpError(401, "Could not validate Access assertion");
  return response.json();
}

function findJwk(jwks, kid) {
  const keys = (jwks && jwks.keys) || [];
  return keys.find((key) => key.kid === kid) || keys[0];
}

async function importRsaKey(jwk) {
  return crypto.subtle.importKey(
    "jwk",
    { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

export async function assertAccess(request, env) {
  if ((env.TEST_MODE === "1" || env.TEST_MODE === true) && !env.GITHUB_TOKEN) {
    return { email: "test@local", sub: "test" };
  }
  const token = request.headers.get("CF-Access-Jwt-Assertion") || "";
  if (!token) throw new HttpError(401, "Cloudflare Access is required");
  const { header, payload, signed, signature } = decodeJwt(token);
  const aud = env.ACCESS_AUD;
  const team = String(env.ACCESS_TEAM_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!aud || !team) throw new HttpError(500, "Access is not configured");
  const expectedIss = `https://${team}`;
  if (payload.iss !== expectedIss && payload.iss !== `${expectedIss}/`) {
    throw new HttpError(401, "Access assertion is not valid");
  }
  const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audience.includes(aud)) throw new HttpError(401, "Access assertion is not valid");
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now - 30) throw new HttpError(401, "Access assertion expired");
  const jwks = await getJwks(env);
  const jwk = findJwk(jwks, header.kid);
  if (!jwk || !jwk.n || !jwk.e) throw new HttpError(401, "Access assertion is not valid");
  const key = await importRsaKey(jwk);
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    signature,
    new TextEncoder().encode(signed)
  );
  if (!ok) throw new HttpError(401, "Access assertion is not valid");
  const email = String(payload.email || payload.identity?.email || "").toLowerCase();
  const allow = String(env.ACCESS_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length && !allow.includes(email)) {
    throw new HttpError(403, "This Access identity cannot publish");
  }
  return { email, sub: payload.sub || "" };
}
