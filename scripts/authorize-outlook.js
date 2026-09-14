// One-time local helper to get an Outlook (Microsoft Graph) refresh token.
// Run this on your own machine (not in CI) after registering an app in Azure AD —
// see SETUP.md for the full walkthrough.
//
// Usage:
//   MS_TENANT_ID=xxx MS_CLIENT_ID=xxx MS_CLIENT_SECRET=xxx node scripts/authorize-outlook.js

import { createServer } from "node:http";
import { URL } from "node:url";

const tenantId = process.env.MS_TENANT_ID;
const clientId = process.env.MS_CLIENT_ID;
const clientSecret = process.env.MS_CLIENT_SECRET;
const redirectUri = "http://localhost:8090/callback";
const scope = "offline_access User.Read Contacts.Read";

if (!tenantId || !clientId || !clientSecret) {
  console.error("Set MS_TENANT_ID, MS_CLIENT_ID and MS_CLIENT_SECRET env vars first.");
  process.exit(1);
}

const authUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
authUrl.searchParams.set("client_id", clientId);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("redirect_uri", redirectUri);
authUrl.searchParams.set("response_mode", "query");
authUrl.searchParams.set("scope", scope);

console.log("\nOpen this URL in your browser and sign in with the mailbox you want to sync:\n");
console.log(authUrl.toString());
console.log("\nWaiting for redirect to", redirectUri, "...\n");

const server = createServer(async (req, res) => {
  const url = new URL(req.url, redirectUri);
  if (url.pathname !== "/callback") {
    res.writeHead(404);
    res.end();
    return;
  }
  const code = url.searchParams.get("code");

  try {
    const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        scope,
      }),
    });
    const json = await tokenRes.json();
    res.end("Success — you can close this tab and check your terminal.");
    console.log("\nSave this as a repository secret:\n");
    console.log("MS_REFRESH_TOKEN=", json.refresh_token);
    console.log("\n(Microsoft rotates this token on every use — the sync script logs a new");
    console.log("one whenever it changes; update the secret if the scheduled sync starts failing)\n");
  } catch (err) {
    res.writeHead(500);
    res.end("Error — check terminal");
    console.error(err);
  } finally {
    server.close();
  }
}).listen(8090);
