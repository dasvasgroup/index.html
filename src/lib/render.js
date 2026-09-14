function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function fmtMoney(n) {
  return `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function renderDashboard({ customers, segments, syncedAt, sourceStatus, supplierItemCount }) {
  const segmentSummary = Object.entries(segments)
    .map(([name, list]) => `<li><strong>${escapeHtml(name)}</strong>: ${list.length} customers`
      + ` — <a href="data/segments/${escapeHtml(name)}.csv">download CSV</a></li>`)
    .join("\n");

  const rows = customers
    .slice(0, 500)
    .map((c) => `<tr>
      <td>${escapeHtml(c.name)}</td>
      <td>${escapeHtml(c.email)}</td>
      <td>${escapeHtml(c.phone)}</td>
      <td>${escapeHtml(c.systems.join(", ") || "—")}</td>
      <td>${fmtMoney(c.invoiceTotal)}</td>
      <td>${fmtMoney(c.openBalance)}</td>
      <td>${escapeHtml(c.lastActivityDate || "—")}</td>
    </tr>`)
    .join("\n");

  const statusRows = Object.entries(sourceStatus)
    .map(([name, ok]) => `<li>${escapeHtml(name)}: ${ok === true ? "✅ synced" : ok === "skipped" ? "⚪ not configured" : "❌ error"}</li>`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Davas Customer Sync</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, sans-serif; margin: 0; padding: 24px 16px; background: #f7f7f8; color: #1a1a1a; }
  h1 { margin-bottom: 4px; }
  .meta { color: #666; margin-bottom: 24px; }
  .cards { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
  .card { background: white; border-radius: 8px; padding: 16px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); min-width: 160px; }
  .card .n { font-size: 28px; font-weight: 700; }
  .card .l { color: #666; font-size: 13px; }
  table { border-collapse: collapse; width: 100%; background: white; border-radius: 8px; overflow: hidden; }
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 14px; }
  th { background: #efefef; }
  section { margin-bottom: 32px; max-width: 1100px; }
  ul { line-height: 1.7; }
  @media (prefers-color-scheme: dark) {
    body { background: #111; color: #eee; }
    .card, table { background: #1c1c1c; }
    th { background: #2a2a2a; }
    td, th { border-color: #333; }
  }
</style>
</head>
<body>
  <h1>Customer &amp; Sync Dashboard</h1>
  <p class="meta">Last synced: ${escapeHtml(syncedAt)}</p>

  <div class="cards">
    <div class="card"><div class="n">${customers.length}</div><div class="l">Total customers</div></div>
    <div class="card"><div class="n">${segments.alarm.length}</div><div class="l">Alarm systems</div></div>
    <div class="card"><div class="n">${segments.camera.length}</div><div class="l">Camera systems</div></div>
    <div class="card"><div class="n">${segments.monitoring.length}</div><div class="l">Monitoring</div></div>
    <div class="card"><div class="n">${segments.unclassified.length}</div><div class="l">Unclassified</div></div>
    <div class="card"><div class="n">${supplierItemCount}</div><div class="l">Supplier price list items</div></div>
  </div>

  <section>
    <h2>Sync status</h2>
    <ul>${statusRows}</ul>
  </section>

  <section>
    <h2>Marketing segments</h2>
    <ul>${segmentSummary}</ul>
  </section>

  <section>
    <h2>Customers (first 500)</h2>
    <p>Full data: <a href="data/customers.json">data/customers.json</a></p>
    <table>
      <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Systems</th><th>Invoiced</th><th>Open balance</th><th>Last activity</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>
</body>
</html>
`;
}
