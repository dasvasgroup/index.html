import { mkdirSync, writeFileSync } from "node:fs";
import { config, isConfigured } from "../src/lib/config.js";
import { fetchQuickBooksData } from "../src/lib/quickbooks.js";
import { fetchServiceM8Data } from "../src/lib/servicem8.js";
import { fetchOutlookData } from "../src/lib/outlook.js";
import { buildCustomerDatabase, buildSegments } from "../src/lib/merge.js";
import { loadSupplierPriceLists } from "../src/lib/supplierPriceLists.js";
import { toCsv } from "../src/lib/csv.js";
import { renderDashboard } from "../src/lib/render.js";

const empty = {
  quickbooks: { customers: [], invoices: [], quotes: [], items: [] },
  servicem8: { customers: [], jobs: [], jobActivities: [] },
  outlook: { contacts: [] },
};

const sourceStatus = {};

async function safeFetch(name, isReady, fetcher) {
  if (!isReady) {
    console.log(`[skip] ${name}: not configured (missing env vars) — see SETUP.md`);
    sourceStatus[name] = "skipped";
    return null;
  }
  try {
    console.log(`[sync] fetching ${name}...`);
    const data = await fetcher();
    sourceStatus[name] = true;
    return data;
  } catch (err) {
    console.error(`[error] ${name} sync failed:`, err.message);
    sourceStatus[name] = false;
    return null;
  }
}

async function main() {
  mkdirSync("data/segments", { recursive: true });
  mkdirSync("data/supplier-price-lists", { recursive: true });

  const qbo = (await safeFetch("quickbooks", isConfigured("quickbooks"), () => fetchQuickBooksData(config.quickbooks)))
    || empty.quickbooks;
  const sm8 = (await safeFetch("servicem8", isConfigured("servicem8"), () => fetchServiceM8Data(config.servicem8)))
    || empty.servicem8;
  const outlookResult = await safeFetch("outlook", isConfigured("outlook"), () => fetchOutlookData(config.outlook));
  const outlook = outlookResult || empty.outlook;

  if (outlookResult?.rotatedRefreshToken) {
    console.log(
      "[warn] Outlook issued a new refresh token this run. Update the MS_REFRESH_TOKEN " +
      "secret with the value logged below, or the next sync will fail once the old token expires:"
    );
    console.log(outlookResult.rotatedRefreshToken);
  }

  const customers = buildCustomerDatabase({ quickbooks: qbo, servicem8: sm8, outlook });
  const segments = buildSegments(customers);
  const supplierItems = loadSupplierPriceLists();

  writeFileSync("data/customers.json", JSON.stringify(customers, null, 2));
  writeFileSync("data/invoices.json", JSON.stringify(qbo.invoices, null, 2));
  writeFileSync("data/quotes.json", JSON.stringify(qbo.quotes, null, 2));
  writeFileSync("data/quickbooks-items.json", JSON.stringify(qbo.items, null, 2));
  writeFileSync("data/jobs.json", JSON.stringify(sm8.jobs, null, 2));
  writeFileSync("data/job-activities.json", JSON.stringify(sm8.jobActivities, null, 2));
  writeFileSync("data/supplier-price-lists/combined.json", JSON.stringify(supplierItems, null, 2));

  const customerColumns = [
    { label: "name", value: (c) => c.name },
    { label: "email", value: (c) => c.email },
    { label: "phone", value: (c) => c.phone },
    { label: "systems", value: (c) => c.systems.join("; ") },
    { label: "invoice_total", value: (c) => c.invoiceTotal.toFixed(2) },
    { label: "open_balance", value: (c) => c.openBalance.toFixed(2) },
    { label: "last_activity_date", value: (c) => c.lastActivityDate || "" },
  ];
  for (const [name, list] of Object.entries(segments)) {
    writeFileSync(`data/segments/${name}.csv`, toCsv(list, customerColumns));
  }
  writeFileSync("data/customers.csv", toCsv(customers, customerColumns));

  const syncedAt = new Date().toISOString();
  writeFileSync("data/last-sync.json", JSON.stringify({ syncedAt, sourceStatus }, null, 2));

  const html = renderDashboard({
    customers,
    segments,
    syncedAt,
    sourceStatus,
    supplierItemCount: supplierItems.length,
  });
  writeFileSync("index.html", html);

  console.log(`[done] ${customers.length} customers, segments: ` +
    Object.entries(segments).map(([k, v]) => `${k}=${v.length}`).join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
