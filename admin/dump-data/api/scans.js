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
  const manage = u.searchParams.get('manage');

  // Preset management via this endpoint to avoid routing issues
  const listKey = `scans:${postUrl}:__presets__`;
  if (manage === 'list' && req.method === 'GET') {
    const list = (await kv.get(listKey)) || [];
    return json(null, 200, { presets: list });
  }
  if (manage === 'create' && req.method === 'POST') {
    const body = await req.json();
    const name = String(body && body.name || '').trim();
    const copyFrom = String(body && body.copyFrom || '').trim();
    if (!name) return json(null, 400, { error: 'name required' });
    const current = (await kv.get(listKey)) || [];
    if (!current.includes(name)) {
      await kv.set(listKey, current.concat([name]));
    }
    if (copyFrom) {
      const srcKey = `scans:${postUrl}:${copyFrom}`;
      const dstKey = `scans:${postUrl}:${name}`;
      const data = await kv.get(srcKey);
      if (data) await kv.set(dstKey, data);
    }
    return json(null, 200, { ok: true });
  }
  if (manage === 'rename' && req.method === 'PATCH') {
    const body = await req.json();
    const oldName = String(body && body.oldName || '').trim();
    const newName = String(body && body.newName || '').trim();
    if (!oldName || !newName) return json(null, 400, { error: 'oldName and newName required' });
    if (oldName === newName) return json(null, 200, { ok: true });
    const current = (await kv.get(listKey)) || [];
    if (!current.includes(oldName)) return json(null, 404, { error: 'preset not found' });
    const srcKey = `scans:${postUrl}:${oldName}`;
    const dstKey = `scans:${postUrl}:${newName}`;
    const data = await kv.get(srcKey);
    if (data) await kv.set(dstKey, data);
    await kv.del(srcKey);
    const updated = current.filter(n => n !== oldName);
    if (!updated.includes(newName)) updated.push(newName);
    await kv.set(listKey, updated);
    return json(null, 200, { ok: true });
  }
  if (manage === 'delete' && req.method === 'DELETE') {
    const body = await req.json();
    const name = String(body && body.name || '').trim();
    if (!name) return json(null, 400, { error: 'name required' });
    const current = (await kv.get(listKey)) || [];
    const updated = current.filter(n => n !== name);
    await kv.set(listKey, updated);
    const delKey = `scans:${postUrl}:${name}`;
    await kv.del(delKey);
    return json(null, 200, { ok: true });
  }

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


