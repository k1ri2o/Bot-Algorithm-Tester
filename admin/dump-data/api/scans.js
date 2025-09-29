import { get } from '@vercel/edge-config';

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

const EDGE_CONFIG_ID = process.env.EDGE_CONFIG || process.env.NEXT_PUBLIC_EDGE_CONFIG || '';
const EDGE_ADMIN_TOKEN = process.env.EDGE_CONFIG_ADMIN_TOKEN || '';

export default async function handler(req) {
  if (!verifyTokens(req.url)) {
    return json(null, 401, { error: 'Not authorized' });
  }

  const u = new URL(req.url);
  const postUrl = u.searchParams.get('postUrl') || 'default';
  const key = `scans:${postUrl}`;

  if (req.method === 'GET') {
    const data = await get(key);
    if (!data) return json(null, 404, { error: 'No data yet' });
    return json(null, 200, data);
  }
  if (req.method === 'POST') {
    const body = await req.json();
    if (!body || !Array.isArray(body.labels) || typeof body.metrics !== 'object') {
      return json(null, 400, { error: 'Invalid payload' });
    }
    if (!EDGE_CONFIG_ID || !EDGE_ADMIN_TOKEN) return json(null, 500, { error: 'Edge Config credentials missing' });
    const resp = await fetch(`https://api.vercel.com/v1/edge-config/${EDGE_CONFIG_ID}/items`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${EDGE_ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ items: [{ operation: 'upsert', key, value: body }] })
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return json(null, 500, { error: `Edge write failed (${resp.status}) ${text}` });
    }
    return json(null, 200, { ok: true });
  }
  return json(null, 405, { error: 'Method not allowed' });
}

export const config = {
  runtime: 'edge'
};


