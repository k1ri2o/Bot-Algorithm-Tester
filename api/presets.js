// Presets management for scans
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

function normalizeName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 64);
}

export default async function handler(req) {
  if (!verifyTokens(req.url)) {
    return json(null, 401, { error: 'Not authorized' });
  }

  const u = new URL(req.url);
  const postUrl = u.searchParams.get('postUrl') || 'default';
  const listKey = `scans:${postUrl}:__presets__`;

  if (req.method === 'GET') {
    const list = (await kv.get(listKey)) || [];
    return json(null, 200, { presets: list });
  }

  if (req.method === 'POST') {
    // Create preset, optional copyFrom
    const body = await req.json();
    let name = normalizeName(body && body.name);
    const copyFrom = normalizeName(body && body.copyFrom);
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

  if (req.method === 'PATCH') {
    // Rename preset
    const body = await req.json();
    const oldName = normalizeName(body && body.oldName);
    const newName = normalizeName(body && body.newName);
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

  if (req.method === 'DELETE') {
    // Delete preset
    const body = await req.json();
    const name = normalizeName(body && body.name);
    if (!name) return json(null, 400, { error: 'name required' });
    const current = (await kv.get(listKey)) || [];
    const updated = current.filter(n => n !== name);
    await kv.set(listKey, updated);
    const key = `scans:${postUrl}:${name}`;
    await kv.del(key);
    return json(null, 200, { ok: true });
  }

  return json(null, 405, { error: 'Method not allowed' });
}

export const config = {
  runtime: 'edge'
};



