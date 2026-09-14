// ServiceM8 client.
// Docs: https://developer.servicem8.com/docs
//
// Auth model: a static API key from Setup -> API Access Keys, sent as HTTP Basic auth
// (API key as the username, blank password).

const BASE = "https://api.servicem8.com/api_1.0";

async function get(apiKey, path) {
  const basicAuth = Buffer.from(`${apiKey}:`).toString("base64");
  const res = await fetch(`${BASE}/${path}`, {
    headers: {
      Authorization: `Basic ${basicAuth}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`ServiceM8 request failed (${path}): ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function fetchServiceM8Data(cfg) {
  const [companies, jobs, jobActivities, categories] = await Promise.all([
    get(cfg.apiKey, "company.json"),
    get(cfg.apiKey, "job.json"),
    get(cfg.apiKey, "jobactivity.json"),
    get(cfg.apiKey, "category.json"),
  ]);

  const categoryById = new Map(categories.map((c) => [c.uuid, c.name]));

  return {
    customers: companies.filter((c) => c.active === "1" || c.active === 1).map(mapCompany),
    jobs: jobs.map((j) => mapJob(j, categoryById)),
    jobActivities: jobActivities.map(mapJobActivity),
  };
}

function mapCompany(c) {
  return {
    source: "servicem8",
    sourceId: c.uuid,
    name: c.name,
    email: c.email || null,
    phone: c.mobile || c.phone || null,
    address: [c.address_street, c.address_city, c.address_state, c.address_postcode]
      .filter(Boolean)
      .join(", ") || null,
    active: c.active === "1" || c.active === 1,
  };
}

// A "job" is the closest ServiceM8 concept to a quote/work order; job_status covers
// Quote / Work Order / Completed / Unsuccessful. Category name is used downstream to
// tag customers by installed system type (alarm / camera / monitoring).
function mapJob(j, categoryById) {
  return {
    source: "servicem8",
    sourceId: j.uuid,
    customerRef: j.company_uuid,
    jobNumber: j.generated_job_id || null,
    status: j.status || null,
    category: categoryById.get(j.category_uuid) || null,
    description: j.job_description || null,
    date: j.date || null,
    total: j.total_invoice_amount ? Number(j.total_invoice_amount) : 0,
  };
}

// "Foray" entries: on-site visit / diary notes logged against a job, i.e. ServiceM8's
// job activity records (technician check-in/out, notes for a site visit).
function mapJobActivity(a) {
  return {
    source: "servicem8",
    sourceId: a.uuid,
    jobRef: a.job_uuid,
    staffRef: a.staff_uuid || null,
    startDate: a.start_date || null,
    endDate: a.end_date || null,
    activityType: a.activity_type || null,
    notes: a.activity_description || null,
  };
}
