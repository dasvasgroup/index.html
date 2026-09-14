# Davas Customer Sync

Pulls customers, invoices, quotes and job/site-visit entries from **QuickBooks
Online**, **ServiceM8** and **Outlook**, merges them into one customer database,
tags each customer by installed system type (alarm / camera / monitoring), and
publishes the result as this repo's `index.html` — a static dashboard hosted for
free via GitHub Pages, rebuilt every night by a GitHub Actions workflow.

No server, database or hosting bill required — everything lives in this repo.

## What it produces

- `index.html` — dashboard: customer counts, segment sizes, sync status, customer table.
- `data/customers.json` / `data/customers.csv` — the full merged customer database.
- `data/segments/{alarm,camera,monitoring,unclassified}.csv` — ready-to-import
  marketing lists, one row per customer.
- `data/invoices.json`, `data/quotes.json` — raw QuickBooks invoices/estimates.
- `data/jobs.json`, `data/job-activities.json` — ServiceM8 jobs and site-visit
  ("foray") diary entries.
- `data/quickbooks-items.json` — your QuickBooks item/price list.
- `data/supplier-price-lists/combined.json` — consolidated supplier cost price
  lists (see below — this one's a manual CSV drop, not an API sync).

## How customers get tagged

A customer is tagged `alarm`, `camera` and/or `monitoring` based on keywords found
in: QuickBooks invoice/quote line item names, and ServiceM8 job category + job
description. See `SYSTEM_KEYWORDS` in `src/lib/merge.js` — edit that list to match
your actual product/category naming so tagging stays accurate.

## Setup

You said you don't have API access to any of the three systems yet — **start with
[SETUP.md](./SETUP.md)**, which walks through registering a QuickBooks app, a
ServiceM8 API key, and an Azure AD app for Outlook, and getting the tokens this
project needs.

Once you have credentials:

1. Add them as GitHub repository secrets (Settings → Secrets and variables →
   Actions) — see `.env.example` for the exact names.
2. Enable GitHub Pages for this repo (Settings → Pages → Deploy from branch →
   the branch this workflow commits to → `/ (root)`), so `index.html` is served
   publicly (or keep it unpublished and just open the file from the repo).
3. Run the workflow once manually: Actions → "Daily customer sync" → Run workflow.
   After that it runs automatically every night.

## Running locally

```
cp .env.example .env   # fill in your credentials
node scripts/sync.js
```

## Supplier price lists

Not something any of these three systems provide — see
`data/supplier-price-lists/README.md` for the manual CSV format.

## Sending marketing campaigns

This project **produces** the segmented lists (`data/segments/*.csv`) — it doesn't
send email itself. Import the relevant CSV into whatever you send campaigns from
(Outlook contact groups, Mailchimp, etc).
