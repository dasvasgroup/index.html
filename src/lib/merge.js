// Unifies customer records pulled from QuickBooks, ServiceM8 and Outlook into one
// customer database, keyed primarily by email (falling back to normalised phone,
// then normalised name) since none of the three systems share a common ID.

const SYSTEM_KEYWORDS = {
  alarm: ["alarm", "intruder", "security system", "back to base"],
  camera: ["camera", "cctv", "video surveillance", "nvr", "dvr"],
  monitoring: ["monitoring", "back to base", "central station"],
};

function normalisePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(-9) : null;
}

function normaliseName(name) {
  if (!name) return null;
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function keyFor(record) {
  if (record.email) return `email:${record.email.trim().toLowerCase()}`;
  const phone = normalisePhone(record.phone);
  if (phone) return `phone:${phone}`;
  const name = normaliseName(record.name);
  if (name) return `name:${name}`;
  return `id:${record.source}:${record.sourceId}`;
}

function detectSystems(text) {
  const found = new Set();
  const lower = (text || "").toLowerCase();
  for (const [system, keywords] of Object.entries(SYSTEM_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) found.add(system);
  }
  return found;
}

export function buildCustomerDatabase({ quickbooks, servicem8, outlook }) {
  const byKey = new Map();

  function upsert(record) {
    const key = keyFor(record);
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        name: record.name || null,
        email: record.email || null,
        phone: record.phone || null,
        address: record.address || null,
        sources: {},
        systems: new Set(),
        invoiceTotal: 0,
        openBalance: 0,
        quoteCount: 0,
        jobCount: 0,
        lastActivityDate: null,
      });
    }
    const entry = byKey.get(key);
    entry.name = entry.name || record.name || null;
    entry.email = entry.email || record.email || null;
    entry.phone = entry.phone || record.phone || null;
    entry.address = entry.address || record.address || null;
    entry.sources[record.source] = record.sourceId;
    return entry;
  }

  for (const c of quickbooks.customers) upsert(c);
  for (const c of servicem8.customers) upsert(c);
  for (const c of outlook.contacts) upsert(c);

  // Map ServiceM8 company UUID -> merged customer key, so jobs can be attached back.
  const sm8UuidToKey = new Map();
  for (const [key, entry] of byKey) {
    if (entry.sources.servicem8) sm8UuidToKey.set(entry.sources.servicem8, key);
  }
  // Map QuickBooks customer Id -> merged customer key, for invoices/quotes.
  const qboIdToKey = new Map();
  for (const [key, entry] of byKey) {
    if (entry.sources.quickbooks) qboIdToKey.set(entry.sources.quickbooks, key);
  }

  for (const inv of quickbooks.invoices) {
    const key = qboIdToKey.get(inv.customerRef);
    if (!key) continue;
    const entry = byKey.get(key);
    entry.invoiceTotal += inv.total;
    entry.openBalance += inv.balance;
    bumpDate(entry, inv.date);
    for (const item of inv.lineItems) {
      for (const s of detectSystems(item)) entry.systems.add(s);
    }
  }

  for (const q of quickbooks.quotes) {
    const key = qboIdToKey.get(q.customerRef);
    if (!key) continue;
    const entry = byKey.get(key);
    entry.quoteCount += 1;
    bumpDate(entry, q.date);
    for (const item of q.lineItems) {
      for (const s of detectSystems(item)) entry.systems.add(s);
    }
  }

  for (const j of servicem8.jobs) {
    const key = sm8UuidToKey.get(j.customerRef);
    if (!key) continue;
    const entry = byKey.get(key);
    entry.jobCount += 1;
    bumpDate(entry, j.date);
    for (const s of detectSystems(j.category)) entry.systems.add(s);
    for (const s of detectSystems(j.description)) entry.systems.add(s);
  }

  const customers = [...byKey.values()].map((entry) => ({
    ...entry,
    systems: [...entry.systems].sort(),
  }));

  return customers.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

function bumpDate(entry, dateStr) {
  if (!dateStr) return;
  if (!entry.lastActivityDate || dateStr > entry.lastActivityDate) {
    entry.lastActivityDate = dateStr;
  }
}

export function buildSegments(customers) {
  const segments = { alarm: [], camera: [], monitoring: [], unclassified: [] };
  for (const c of customers) {
    if (c.systems.length === 0) {
      segments.unclassified.push(c);
      continue;
    }
    for (const system of c.systems) {
      if (segments[system]) segments[system].push(c);
    }
  }
  return segments;
}
