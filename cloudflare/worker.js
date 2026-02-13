import { verifyMessage } from "@ethersproject/wallet";
import jwt from "@tsndr/cloudflare-worker-jwt";

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (url.pathname === "/challenge") return challenge(req, env);
    if (url.pathname === "/update") return update(req, env);
    if (url.pathname === "/verify") return verify(req, env);
    if (url.pathname === "/data") return data(req, env);

    return new Response("Not Found", { status: 404 });
  }
};

async function challenge(req, env) {
  const { address } = await req.json();
  if (!address) {
    return Response.json({ ok: false }, { status: 400 });
  }

  const nonce = crypto.randomUUID();
  const key = `nonce:${address.toLowerCase()}`;

  await env.KV.put(key, nonce, { expirationTtl: 300 });

  const message = `Equity Dashboard Login\nNonce: ${nonce}`;
  return Response.json({ ok: true, message });
}
async function verify(req, env) {
  const { address, signature, message } = await req.json();

  const nonceKey = `nonce:${address.toLowerCase()}`;
  const nonce = await env.KV.get(nonceKey);
  if (!nonce) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const expectedMessage = `Equity Dashboard Login\nNonce: ${nonce}`;
  if (message !== expectedMessage) {
    return Response.json({ ok: false }, { status: 401 });
  }

  let recovered;
  try {
    recovered = verifyMessage(message, signature);
  } catch {
    return Response.json({ ok: false }, { status: 401 });
  }

  if (recovered.toLowerCase() !== address.toLowerCase()) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const whitelist = env.ALLOWED_ADDRESSES
    .split(",")
    .map(a => a.toLowerCase());

  if (!whitelist.includes(address.toLowerCase())) {
    return Response.json({ ok: false }, { status: 403 });
  }

  await env.KV.delete(nonceKey);

  const token = await jwt.sign(
    { sub: address, exp: Math.floor(Date.now() / 1000) + 3600 },
    env.JWT_SECRET
  );

  return Response.json({ ok: true, token });
}
async function update(req, env) {
  if (req.headers.get("x-update-key") !== env.UPDATE_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { equity, analysis } = await req.json();

  await env.NEWHORIZON_WORKER.put("current-equity", JSON.stringify(equity));
  await env.NEWHORIZON_WORKER.put("current-analysis", analysis);

  return Response.json({ ok: true });
}

async function data(req, env) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token || !(await jwt.verify(token, env.JWT_SECRET))) {
    return new Response("Unauthorized", { status: 401 });
  }

  return Response.json({
    equity: JSON.parse(await env.NEWHORIZON_WORKER.get("current-equity")),
    analysis: await env.NEWHORIZON_WORKER.get("current-analysis")
  });
}
