// Outlook / Microsoft 365 client via Microsoft Graph.
// Docs: https://learn.microsoft.com/en-us/graph/api/user-list-contacts
//
// Auth model: OAuth2 with a delegated refresh token (obtained once via
// scripts/authorize-outlook.js, since reading a specific mailbox's contacts
// requires delegated permissions, not just an app-only client-credentials grant).

const GRAPH = "https://graph.microsoft.com/v1.0";

async function refreshAccessToken({ tenantId, clientId, clientSecret, refreshToken }) {
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: "offline_access User.Read Contacts.Read",
    }),
  });
  if (!res.ok) {
    throw new Error(`Outlook token refresh failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function getAllPages(accessToken, path) {
  let url = `${GRAPH}${path}`;
  const items = [];
  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Outlook request failed (${path}): ${res.status} ${await res.text()}`);
    }
    const json = await res.json();
    items.push(...(json.value || []));
    url = json["@odata.nextLink"] || null;
  }
  return items;
}

export async function fetchOutlookData(cfg) {
  const { access_token: accessToken, refresh_token: newRefreshToken } = await refreshAccessToken(cfg);

  const contacts = await getAllPages(accessToken, "/me/contacts?$top=200");

  return {
    contacts: contacts.map(mapContact),
    // Outlook rotates refresh tokens on use; the caller should persist this
    // back to the MS_REFRESH_TOKEN secret if it changed, or the next run will fail.
    rotatedRefreshToken: newRefreshToken || null,
  };
}

function mapContact(c) {
  return {
    source: "outlook",
    sourceId: c.id,
    name: c.displayName || `${c.givenName || ""} ${c.surname || ""}`.trim(),
    email: c.emailAddresses?.[0]?.address || null,
    phone: c.mobilePhone || c.businessPhones?.[0] || null,
    company: c.companyName || null,
  };
}
