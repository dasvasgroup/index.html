# Supplier price lists

None of QuickBooks, ServiceM8 or Outlook store multi-supplier cost pricing, so this
folder is a manual drop point instead of an API sync.

Add one CSV file per supplier, named `<supplier-name>.csv`, with these columns:

```
sku,description,cost,rrp
```

Every `.csv` file here is combined by the sync script into `data/supplier-price-lists/combined.json`
and counted on the dashboard. Your own sale prices (QuickBooks Items) are synced
automatically into `data/quickbooks-items.json`.
