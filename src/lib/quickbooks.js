// QuickBooks Online (Accounting API v3) client.
// Docs: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities
//
// Auth model: QuickBooks uses OAuth2 authorization-code grant. We store a long-lived
// refresh token (obtained once via scripts/authorize-quickbooks.js) and exchange it for
// a short-lived access token on every run.

const TOKEN_URL = "https://oauth.intuit.com/oauth2/v1/tokens/bearer";

function apiBase(environment) {
  return environment === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

async function refreshAccessToken({ clientId, clientSecret, refreshToken }) {
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    throw new Error(`QuickBooks token refresh failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return json.access_token;
}

async function query(cfg, accessToken, sql) {
  const url = `${apiBase(cfg.environment)}/v3/company/${cfg.realmId}/query?query=${encodeURIComponent(sql)}&minorversion=70`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`QuickBooks query failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return json.QueryResponse || {};
}

// Fetches every row of an entity type, paging with STARTPOSITION/MAXRESULTS.
async function queryAll(cfg, accessToken, entity, extraWhere = "") {
  const pageSize = 200;
  let startPosition = 1;
  const results = [];
  for (;;) {
    const where = extraWhere ? ` WHERE ${extraWhere}` : "";
    const sql = `SELECT * FROM ${entity}${where} STARTPOSITION ${startPosition} MAXRESULTS ${pageSize}`;
    const page = await query(cfg, accessToken, sql);
    const rows = page[entity] || [];
    results.push(...rows);
    if (rows.length < pageSize) break;
    startPosition += pageSize;
  }
  return results;
}

export async function fetchQuickBooksData(cfg) {
  const accessToken = await refreshAccessToken(cfg);

  const [customers, invoices, estimates, items] = await Promise.all([
    queryAll(cfg, accessToken, "Customer"),
    queryAll(cfg, accessToken, "Invoice"),
    queryAll(cfg, accessToken, "Estimate"),
    queryAll(cfg, accessToken, "Item"),
  ]);

  return {
    customers: customers.map(mapCustomer),
    invoices: invoices.map(mapInvoice),
    quotes: estimates.map(mapEstimate),
    items: items.map(mapItem),
  };
}

function mapCustomer(c) {
  return {
    source: "quickbooks",
    sourceId: c.Id,
    name: c.DisplayName || c.CompanyName || `${c.GivenName || ""} ${c.FamilyName || ""}`.trim(),
    email: c.PrimaryEmailAddr?.Address || null,
    phone: c.PrimaryPhone?.FreeFormNumber || c.Mobile?.FreeFormNumber || null,
    address: formatAddress(c.BillAddr),
    balance: c.Balance ?? 0,
    active: c.Active !== false,
  };
}

function mapInvoice(inv) {
  return {
    source: "quickbooks",
    sourceId: inv.Id,
    docNumber: inv.DocNumber || null,
    customerRef: inv.CustomerRef?.value || null,
    customerName: inv.CustomerRef?.name || null,
    date: inv.TxnDate || null,
    dueDate: inv.DueDate || null,
    total: inv.TotalAmt ?? 0,
    balance: inv.Balance ?? 0,
    status: (inv.Balance ?? 0) > 0 ? "open" : "paid",
    lineItems: (inv.Line || [])
      .filter((l) => l.SalesItemLineDetail)
      .map((l) => l.SalesItemLineDetail?.ItemRef?.name)
      .filter(Boolean),
  };
}

function mapEstimate(est) {
  return {
    source: "quickbooks",
    sourceId: est.Id,
    docNumber: est.DocNumber || null,
    customerRef: est.CustomerRef?.value || null,
    customerName: est.CustomerRef?.name || null,
    date: est.TxnDate || null,
    expirationDate: est.ExpirationDate || null,
    total: est.TotalAmt ?? 0,
    status: est.TxnStatus || null,
    lineItems: (est.Line || [])
      .filter((l) => l.SalesItemLineDetail)
      .map((l) => l.SalesItemLineDetail?.ItemRef?.name)
      .filter(Boolean),
  };
}

function mapItem(item) {
  return {
    source: "quickbooks",
    sourceId: item.Id,
    name: item.Name,
    type: item.Type || null,
    unitPrice: item.UnitPrice ?? null,
    purchaseCost: item.PurchaseCost ?? null,
    incomeAccount: item.IncomeAccountRef?.name || null,
    active: item.Active !== false,
  };
}

function formatAddress(addr) {
  if (!addr) return null;
  return [addr.Line1, addr.Line2, addr.City, addr.CountrySubDivisionCode, addr.PostalCode]
    .filter(Boolean)
    .join(", ");
}
