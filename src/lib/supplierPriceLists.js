// Supplier price lists don't live in QuickBooks, ServiceM8 or Outlook — none of the
// three expose multi-supplier cost pricing. Instead, drop one CSV per supplier into
// data/supplier-price-lists/ (columns: sku,description,cost,rrp) and this consolidates
// them, tagged by supplier (the filename). QuickBooks' own Item list (your sale prices)
// is synced separately as data/quickbooks-items.json for reference.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { parseCsv } from "./csv.js";

const DIR = "data/supplier-price-lists";

export function loadSupplierPriceLists() {
  if (!existsSync(DIR)) return [];
  const files = readdirSync(DIR).filter((f) => f.endsWith(".csv"));
  const items = [];
  for (const file of files) {
    const supplier = path.basename(file, ".csv");
    const rows = parseCsv(readFileSync(path.join(DIR, file), "utf8"));
    for (const row of rows) {
      items.push({
        supplier,
        sku: row.sku || row.SKU || null,
        description: row.description || row.Description || null,
        cost: row.cost ? Number(row.cost) : null,
        rrp: row.rrp ? Number(row.rrp) : null,
      });
    }
  }
  return items;
}
