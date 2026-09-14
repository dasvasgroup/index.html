# Setup guide: getting API access for QuickBooks, ServiceM8 and Outlook

You need one set of credentials from each system. None of this costs money — all
three offer free developer/API access. Budget about 30–45 minutes total.

---

## 1. QuickBooks Online

1. Go to https://developer.intuit.com and sign in with your Intuit/QuickBooks account.
2. **Dashboard → Create an app** → choose "QuickBooks Online and Payments".
3. Under **Keys & OAuth**, note your **Client ID** and **Client Secret** (use the
   "Development" ones first to test against a QuickBooks sandbox company, or the
   "Production" ones once you're ready to point at your real company file — production
   keys need Intuit to review basic app info first, which is quick for internal use).
4. Under **Redirect URIs**, add: `http://localhost:8089/callback`
5. On your machine (not a server), with Node.js installed, run:
   ```
   git clone <this repo>
   cd davas-sync   # or whatever you named it
   QBO_CLIENT_ID=<your client id> QBO_CLIENT_SECRET=<your client secret> \
     node scripts/authorize-quickbooks.js
   ```
6. It prints a URL — open it, log into QuickBooks, and approve access to your
   company. The terminal will then print:
   ```
   QBO_REALM_ID=...
   QBO_REFRESH_TOKEN=...
   ```
7. Save `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_REALM_ID`, `QBO_REFRESH_TOKEN`,
   and `QBO_ENVIRONMENT` (`sandbox` or `production`) as GitHub repo secrets.

The refresh token is long-lived (rotates only after ~100 days of the sync *not*
running) — daily runs keep it alive indefinitely. If it ever does expire, just
re-run step 5.

---

## 2. ServiceM8

This one's the easy one — no OAuth flow needed.

1. Log into ServiceM8 → **Setup** → **API Access Keys** (under "Integrations").
2. Click **Add API Key**, give it a name like "Davas Sync", and generate it.
3. Copy the key and save it as the `SM8_API_KEY` GitHub repo secret.

That's the only credential ServiceM8 needs.

---

## 3. Outlook / Microsoft 365 (Microsoft Graph)

1. Go to https://portal.azure.com → **Azure Active Directory** (now "Microsoft
   Entra ID") → **App registrations** → **New registration**.
2. Name it anything (e.g. "Davas Sync"). Under "Redirect URI", choose **Web** and
   enter `http://localhost:8090/callback`.
3. After creating it, note the **Application (client) ID** and
   **Directory (tenant) ID** from the Overview page.
4. Go to **Certificates & secrets** → **New client secret** → copy the secret
   **value** immediately (it's hidden after you leave the page).
5. Go to **API permissions** → **Add a permission** → **Microsoft Graph** →
   **Delegated permissions** → add `Contacts.Read`, `User.Read`, `offline_access`.
   Click **Grant admin consent** if you're the tenant admin (needed if your org
   restricts consent).
6. On your machine, run:
   ```
   MS_TENANT_ID=<tenant id> MS_CLIENT_ID=<client id> MS_CLIENT_SECRET=<secret value> \
     node scripts/authorize-outlook.js
   ```
7. Open the printed URL, sign in with the mailbox whose contacts you want synced,
   and approve. The terminal prints `MS_REFRESH_TOKEN=...`.
8. Save `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_REFRESH_TOKEN` as
   GitHub repo secrets.

Microsoft rotates the refresh token every time it's used. The sync script logs a
new one whenever that happens — if the scheduled sync ever starts failing with an
auth error, check the most recent successful run's log for a newer token and
update the secret (or just re-run step 6).

---

## 4. Add the secrets to GitHub

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository
secret**, once for each name in `.env.example`.

## 5. Test it

Actions tab → **Daily customer sync** → **Run workflow**. Check the run log for
`[sync]` / `[error]` lines per system, then open the updated `index.html`.
