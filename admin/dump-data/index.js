import { kv } from '@vercel/kv';

const REQUIRED_SECURITY_TOKEN = '59LdrEJCGFlfGNN';
const REQUIRED_ADMIN_TOKEN = 'assist_aff';
const MAX_SCANS = 30;

function verifyTokens(url) {
  const u = new URL(url);
  const securityToken = u.searchParams.get('securityToken');
  const adminToken = u.searchParams.get('adminToken');
  return securityToken === REQUIRED_SECURITY_TOKEN && adminToken === REQUIRED_ADMIN_TOKEN;
}

function formatInteger(n) {
  const x = Math.round(Number(n) || 0);
  return String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatPercent(n, decimals) {
  const val = Number.isFinite(n) ? n : 0;
  return val.toFixed(decimals) + '%';
}

function buildTableHtml(labels, metrics) {
  const headerCells = ['<th></th>'].concat(labels.map(l => `<th>${l}</th>`)).join('');

  function row(metricKey, label) {
    const arr = Array.isArray(metrics[metricKey]) ? metrics[metricKey] : [];
    const tds = arr.map(v => `<td>${formatInteger(v)}</td>`).join('');
    return `<tr data-metric="${metricKey}"><td>${label}</td>${tds}</tr>`;
  }

  const views = metrics.views || [];
  const likes = metrics.likes || [];
  const comments = metrics.comments || [];
  const saves = metrics.saves || [];
  const shares = metrics.shares || [];

  function ratioRow(label, numArr) {
    const cells = labels.map((_, idx) => {
      const v = Number(views[idx]) || 0;
      const n = Number(numArr[idx]) || 0;
      if (v <= 0) return '<td>0%</td>';
      const decimals = (label === 'comments' || label === 'shares') ? 3 : 2;
      return `<td>${formatPercent((n / v) * 100, decimals)}</td>`;
    }).join('');
    return `<tr data-metric="${label}_ratio"><td>${label}</td>${cells}</tr>`;
  }

  return `
  <table id="scanTable" style="margin-top:16px;">
    <thead>
      <tr>${headerCells}</tr>
    </thead>
    <tbody>
      ${row('views', 'views')}
      ${row('likes', 'likes')}
      ${row('comments', 'comments')}
      ${row('saves', 'saves')}
      ${row('shares', 'shares')}
      <tr><td>--ratios--</td></tr>
      ${ratioRow('likes', likes)}
      ${ratioRow('comments', comments)}
      ${ratioRow('saves', saves)}
      ${ratioRow('shares', shares)}
    </tbody>
  </table>`;
}

export default async function handler(req) {
  if (!verifyTokens(req.url)) {
    return new Response('Not authorized', { status: 401, headers: { 'content-type': 'text/plain' } });
  }

  const u = new URL(req.url);
  const postUrl = u.searchParams.get('postUrl') || 'default';
  const key = `scans:${postUrl}`;

  let labels = [];
  let metrics = { views: [], likes: [], comments: [], saves: [], shares: [] };
  try {
    const data = await kv.get(key);
    if (data && Array.isArray(data.labels) && data.metrics) {
      labels = data.labels.slice(0, MAX_SCANS);
      metrics = {
        views: (data.metrics.views || []).slice(0, MAX_SCANS),
        likes: (data.metrics.likes || []).slice(0, MAX_SCANS),
        comments: (data.metrics.comments || []).slice(0, MAX_SCANS),
        saves: (data.metrics.saves || []).slice(0, MAX_SCANS),
        shares: (data.metrics.shares || []).slice(0, MAX_SCANS)
      };
    }
  } catch (e) {
    // ignore and render empty
  }

  const tableHtml = (labels.length > 0) ? buildTableHtml(labels, metrics) : '<div>No scans found</div>';

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans'; background: #fff; color: #111827; padding: 16px; }
    h2 { font-size: 16px; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    thead th { background: #eef2ff; position: sticky; top: 0; z-index: 1; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; min-width: 100px; }
    th:first-child, td:first-child { text-align: left; }
    tbody td:first-child { font-weight: 600; }
  </style>
</head>
<body>
  ${tableHtml}
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  });
}

export const config = {
  runtime: 'edge'
};


