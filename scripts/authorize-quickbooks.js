// One-time local helper to get a QuickBooks refresh token.
// Run this on your own machine (not in CI) after registering an app at
// https://developer.intuit.com — see SETUP.md for the full walkthrough.
//
// Usage:
//   QBO_CLIENT_ID=xxx QBO_CLIENT_SECRET=xxx node scripts/authorize-quickbooks.js
//
// It starts a tiny local server, opens the Intuit consent screen in your browser,
// and prints the refresh token + realm ID to save as repo secrets.

import { createServer } from "node:http";
import { URL } from "node:url";

const clientId = process.env.QBO_CLIENT_ID;
const clientSecret = process.env.QBO_CLIENT_SECRET;
const redirectUri = "http://localhost:8089/callback";
const scope = "com.intuit.quickbooks.accounting";

if (!clientId || !clientSecret) {
  console.error("Set QBO_CLIENT_ID and QBO_CLIENT_SECRET env vars first.");
  process.exit(1);
}

const authUrl = new URL("https://appcenter.intuit.com/connect/oauth2");
authUrl.searchParams.set("client_id", clientId);
authUrl.searchParams.set("scope", scope);
authUrl.searchParams.set("redirect_uri", redirectUri);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("state", "davas-sync");

console.log("\nOpen this URL in your browser and sign in / accept access to the correct company:\n");
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
  const realmId = url.searchParams.get("realmId");

  try {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenRes = await fetch("https://oauth.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });
    const json = await tokenRes.json();
    res.end("Success — you can close this tab and check your terminal.");
    console.log("\nSave these as repository secrets:\n");
    console.log("QBO_REALM_ID=", realmId);
    console.log("QBO_REFRESH_TOKEN=", json.refresh_token);
    console.log("\n(the refresh token is long-lived but rotates ~ every 100 days of inactivity;");
    console.log("re-run this script if daily sync ever starts failing with an auth error)\n");
  } catch (err) {
    res.writeHead(500);
    res.end("Error — check terminal");
    console.error(err);
  } finally {
    server.close();
  }
}).listen(8089);
