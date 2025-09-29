import { kv as defaultKv, createClient } from '@vercel/kv';

const REQUIRED_SECURITY_TOKEN = '59LdrEJCGFlfGNN';
const REQUIRED_ADMIN_TOKEN = 'assist_aff';

function json(res, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function verifyTokens(url) {
  const u = new URL(url);
  const securityToken = u.searchParams.get('securityToken');
  const adminToken = u.searchParams.get('adminToken');
  return securityToken === REQUIRED_SECURITY_TOKEN && adminToken === REQUIRED_ADMIN_TOKEN;
}

// Support both standard env names and ones created with a custom prefix
const url =
  process.env.KV_REST_API_URL ||
  process.env.KV_REST_API_KV_REST_API_URL ||
  process.env.KV_URL ||
  process.env.KV_REST_API_KV_URL;

const token =
  process.env.KV_REST_API_TOKEN ||
  process.env.KV_REST_API_KV_REST_API_TOKEN;

const kv = url && token ? createClient({ url, token }) : defaultKv;

export default async function handler(req) {
  if (!verifyTokens(req.url)) {
    return json(null, 401, { error: 'Not authorized' });
  }

  const u = new URL(req.url);
  const postUrl = u.searchParams.get('postUrl') || 'default';
  const key = `scans:${postUrl}`;

  if (req.method === 'GET') {
    const data = await kv.get(key);
    if (!data) return json(null, 404, { error: 'No data yet' });
    return json(null, 200, data);
  }
  if (req.method === 'POST') {
    const body = await req.json();
    if (!body || !Array.isArray(body.labels) || typeof body.metrics !== 'object') {
      return json(null, 400, { error: 'Invalid payload' });
    }
    await kv.set(key, body);
    return json(null, 200, { ok: true });
  }
  return json(null, 405, { error: 'Method not allowed' });
}

export const config = {
  runtime: 'edge'
};


