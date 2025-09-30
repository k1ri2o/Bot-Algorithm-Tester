// Vercel KV backend implementation (simplest Vercel-native)
import { kv } from '@vercel/kv';

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

// No extra setup needed here; KV credentials are injected by Vercel

export default async function handler(req) {
  if (!verifyTokens(req.url)) {
    return json(null, 401, { error: 'Not authorized' });
  }

  const u = new URL(req.url);
  const postUrl = u.searchParams.get('postUrl') || 'default';
  const preset = u.searchParams.get('preset') || 'default';
  const key = `scans:${postUrl}:${preset}`;

  if (req.method === 'GET') {
    const data = await kv.get(key);
    if (!data) return json(null, 404, { error: 'No data yet' });
    return json(null, 200, data);
  }
  // List presets for a postUrl
  if (req.method === 'HEAD') {
    const listKey = `scans:${postUrl}:__presets__`;
    const list = (await kv.get(listKey)) || [];
    return json(null, 200, { presets: list });
  }
  if (req.method === 'POST') {
    const body = await req.json();
    if (!body || !Array.isArray(body.labels) || typeof body.metrics !== 'object') {
      return json(null, 400, { error: 'Invalid payload' });
    }
    await kv.set(key, body);
    const listKey = `scans:${postUrl}:__presets__`;
    try {
      const current = (await kv.get(listKey)) || [];
      if (!current.includes(preset)) {
        await kv.set(listKey, current.concat([preset]));
      }
    } catch (e) {}
    return json(null, 200, { ok: true });
  }
  return json(null, 405, { error: 'Method not allowed' });
}

export const config = {
  runtime: 'edge'
};


