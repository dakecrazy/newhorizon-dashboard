import { verifyMessage } from "@ethersproject/wallet";
import jwt from "@tsndr/cloudflare-worker-jwt";

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") return handleOptions(req);

    if (url.pathname === "/challenge") return challenge(req, env);
    if (url.pathname === "/update") return update(req, env);
    if (url.pathname === "/verify") return verify(req, env);
    if (url.pathname === "/data") return data(req, env);
    if (url.pathname === "/market") return market();

    return new Response("Not Found", { status: 404 });
  }
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-update-key"
};

function jsonResponse(data, init = {}) {
  const headers = new Headers(init.headers || {});
  Object.entries(CORS_HEADERS).forEach(([key, value]) => headers.set(key, value));
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function handleOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

async function challenge(req, env) {
  const { address } = await req.json();
  if (!address) {
    return jsonResponse({ ok: false }, { status: 400 });
  }

  const nonce = crypto.randomUUID();
  const key = `nonce:${address.toLowerCase()}`;

  await env.KV.put(key, nonce, { expirationTtl: 300 });

  const message = `Equity Dashboard Login\nNonce: ${nonce}`;
  return jsonResponse({ ok: true, message });
}
async function verify(req, env) {
  const { address, signature, message } = await req.json();

  const nonceKey = `nonce:${address.toLowerCase()}`;
  const nonce = await env.KV.get(nonceKey);
  if (!nonce) {
    return jsonResponse({ ok: false }, { status: 401 });
  }

  const expectedMessage = `Equity Dashboard Login\nNonce: ${nonce}`;
  if (message !== expectedMessage) {
    return jsonResponse({ ok: false }, { status: 401 });
  }

  let recovered;
  try {
    recovered = verifyMessage(message, signature);
  } catch {
    return jsonResponse({ ok: false }, { status: 401 });
  }

  if (recovered.toLowerCase() !== address.toLowerCase()) {
    return jsonResponse({ ok: false }, { status: 401 });
  }

  const whitelist = env.ALLOWED_ADDRESSES
    .split(",")
    .map(a => a.toLowerCase());

  if (!whitelist.includes(address.toLowerCase())) {
    return jsonResponse({ ok: false }, { status: 403 });
  }

  await env.KV.delete(nonceKey);

  const token = await jwt.sign(
    { sub: address, exp: Math.floor(Date.now() / 1000) + 3600 },
    env.JWT_SECRET
  );

  return jsonResponse({ ok: true, token });
}
async function update(req, env) {
  if (req.headers.get("x-update-key") !== env.UPDATE_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { equity, analysis } = await req.json();

  await env.NEWHORIZON_WORKER.put("current-equity", JSON.stringify(equity));
  await env.NEWHORIZON_WORKER.put("current-analysis", analysis);

  return jsonResponse({ ok: true });
}

async function data(req, env) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token || !(await jwt.verify(token, env.JWT_SECRET))) {
    return new Response("Unauthorized", { status: 401 });
  }

  return jsonResponse({
    equity: JSON.parse(await env.NEWHORIZON_WORKER.get("current-equity")),
    analysis: await env.NEWHORIZON_WORKER.get("current-analysis")
  });
}

async function market() {
  const url = "https://api.hyperliquid.xyz/info";
  const requests = [
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "metaAndAssetCtxs" })
    }).then((r) => r.json()),
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "spotMetaAndAssetCtxs" })
    }).then((r) => r.json()),
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "metaAndAssetCtxs", dex: "xyz" })
    }).then((r) => r.json())
  ];

  const [perpResult, spotResult, hip3Result] = await Promise.all(requests);
  const [perpMeta, perpAssetCtxs] = perpResult;
  const [spotMeta, spotAssetCtxs] = spotResult;
  const [hip3Meta, hip3AssetCtxs] = hip3Result;

  const btcIndex = perpMeta.universe.findIndex((u) => u.name === "BTC");
  const ethIndex = perpMeta.universe.findIndex((u) => u.name === "ETH");
  const tslaIndex = hip3Meta.universe.findIndex((u) => u.name === "xyz:TSLA");
  const nvdaIndex = hip3Meta.universe.findIndex((u) => u.name === "xyz:NVDA");
  const xautIndex = 182;

  return jsonResponse({
    btc: perpAssetCtxs[btcIndex]?.markPx ?? null,
    eth: perpAssetCtxs[ethIndex]?.markPx ?? null,
    tsla: hip3AssetCtxs[tslaIndex]?.markPx ?? null,
    nvda: hip3AssetCtxs[nvdaIndex]?.markPx ?? null,
    xaut: spotAssetCtxs[xautIndex]?.markPx ?? null
  });
}
