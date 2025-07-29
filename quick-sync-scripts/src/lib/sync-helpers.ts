/*********************************************************************
 * sync-helpers.ts  –  shared utilities for Quick-Sync scripts
 * ---------------------------------------------------------------
 * Usage in a table-specific entry file (e.g. series-sync.ts):
 *
 *   import { quickSync } from './lib/sync-helpers';
 *
 *   quickSync({
 *     airtableTable: 'Series',
 *     fieldMap: FIELD_MAP,
 *     envEndpoints: {
 *       prod:    'https://four12global.com/wp-json/four12/v1/series-sync',
 *       staging: 'https://wordpress-1204105-5660147.cloudwaysapps.com/wp-json/four12/v1/series-sync',
 *
 *     },
 *   });
 *********************************************************************/

/* =========  Types  ========= */
export interface MediaSpec {
  airtableIdField: string;
  airtableLinkField?: string;
  wpKey: string;
}
export type FieldMap = Record<
  string,
  string | MediaSpec
>;

export interface QuickSyncConfig {
  airtableTable: string;
  fieldMap: FieldMap;
  envEndpoints: Record<string, string>;
  skuField:   string;
  titleField: string;
  allowedStatuses?: string[];
  secretName?:      string;
}


/* =========  Console helper ========= */
const log = (msg: unknown) =>
  console.log(`[${new Date().toISOString()}]`, msg);

/* =========  Common constants ========= */
const DEFAULT_ALLOWED_STATUSES = ['publish', 'draft', 'trash', 'private'];
const DEFAULT_SECRET_NAME      = 'API-SYNC';
const LAST_SYNCED_KEY          = 'last_synced';

/* =========  Auth helper ========= */
export function buildBasicAuth(secret: string, secretName = DEFAULT_SECRET_NAME) {
  if (!secret || !secret.includes(':'))
    throw new Error(`Secret "${secretName}" must be "user:app-password".`);
  return Buffer.from(secret).toString('base64');
}

/* =========  Airtable field utils ========= */
export function fieldsToFetch(
  map: FieldMap,
  skuField: string,
  titleField: string,
): string[] {
  const s = new Set<string>();
  for (const k in map) {
    const v = map[k];
    if (typeof v === 'string') s.add(k);
    else {
      s.add(v.airtableIdField);
      if (v.airtableLinkField) s.add(v.airtableLinkField);
    }
  }
  s.add('wp_id').add(skuField).add(titleField);
  return Array.from(s);
}

/* Clean & coerce values so WP gets primitives */
export function coerceValue(field: string, raw: any): any {
  if (raw == null) return null;

  // multiselects, linked records, lookups → array ⇢ names/strings
  if (Array.isArray(raw)) {
    return raw.map(x =>
      (typeof x === 'object' && x !== null && 'name' in x)
        ? x.name
        : String(x)
    );
  }

  // single attachment → url
  if (typeof raw === 'object' && raw.url)
    return raw.url;

  // single-select object → name
  if (typeof raw === 'object' && raw !== null && 'name' in raw)
    return raw.name;

  return raw; // plain string/number/date already fine
}

/* Build WP `fields` object */
export function buildSyncFields(record: any, map: FieldMap): Record<string, any> {
  const table = record.parentTable;         // Airtable API
  const fields: Record<string, any> = {};

  for (const src in map) {
    const mapping = map[src];

    // Simple 1⇢1 mapping
    if (typeof mapping === 'string') {
      const raw = record.getCellValue(src);
      if (mapping === 'post_status') {
        // status handled later (allowedStatuses check)
        fields.post_status = raw && raw.name ? raw.name.toLowerCase() :
                             typeof raw === 'string' ? raw.toLowerCase() : null;
      } else {
        fields[mapping] = coerceValue(src, raw);
      }
      continue;
    }

    // Media object
    const val = record.getCellValue(mapping.airtableIdField) ||
                (mapping.airtableLinkField && record.getCellValue(mapping.airtableLinkField));
    if (val) fields[mapping.wpKey] = val;
  }

  return fields;
}

/* =========  WP fetch helper ========= */
export async function postToWp(
  url: string,
  authB64: string,
  payload: any
) {
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Basic ${authB64}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    // Even on error, it's useful to return the status
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  
  // Return an object with both the parsed data and the status code
  return {
    data: JSON.parse(text),
    status: res.status
  };
}

/* =========  Main orchestrator ========= */
export async function quickSync(cfg: QuickSyncConfig, inputConfig: any) {
  const {
    airtableTable,
    fieldMap,
    envEndpoints,
    skuField,
    titleField,
    allowedStatuses = DEFAULT_ALLOWED_STATUSES,
    secretName     = DEFAULT_SECRET_NAME,
  } = cfg;
  if (!skuField || !titleField)
    throw new Error('quickSync: skuField and titleField are required');

  // Use the passed-in inputConfig object
  const { recordId, env } = inputConfig;
  if (!recordId) throw new Error('Automation must pass {recordId}.');
  if (!env || !envEndpoints[env]) {
    const availableEnvs = Object.keys(envEndpoints).join(', ');
    throw new Error(`Input variable "env" is missing or invalid. Please provide one of the following: ${availableEnvs}`);
  }
  const wpUrl = envEndpoints[env];

  const syncEpoch = Math.floor(Date.now() / 1000);
  log(`Quick-Sync (${airtableTable}) start – epoch ${syncEpoch}`);

  /* ── Auth ── */
  const authSecret = await input.secret(secretName);
  const authB64    = buildBasicAuth(authSecret, secretName);

  /* ── Fetch record ── */
  const table  = base.getTable(airtableTable);
  const fieldsNeeded = fieldsToFetch(fieldMap, skuField, titleField);
  const record = await table.selectRecordAsync(recordId, { fields: fieldsNeeded });
  if (!record) throw new Error(`Record ${recordId} not found in ${airtableTable}`);

  /* ── Build fields ── */
  const fields = buildSyncFields(record, fieldMap);

// Ensure SKU & title exist
fields.sku ??= record.getCellValueAsString(skuField);

// Get the destination key for the title from the field map (e.g., 'post_title' or 'name')
const titleDestinationKey = (typeof fieldMap[titleField] === 'string')
  ? fieldMap[titleField] as string
  : null;

// Only add the title if its destination key is known and it's not already set.
if (titleDestinationKey) {
    fields[titleDestinationKey] ??= record.getCellValueAsString(titleField) || record.name;
}

fields[LAST_SYNCED_KEY] = syncEpoch;

// We still need the title for logging purposes, regardless of its key
const titleForLogging = (titleDestinationKey && fields[titleDestinationKey])
    ? fields[titleDestinationKey]
    : record.getCellValueAsString(titleField) || record.name;

  // post_status whitelist
  if (fields.post_status && !allowedStatuses.includes(fields.post_status))
    delete fields.post_status;

  /* ── Assemble payload ── */
  const payload = {
    airtableRecordId: record.id,
    sku:   fields.sku,
    wp_id: record.getCellValue('wp_id') || null,
    fields,
  };
  console.log(JSON.stringify(payload, null, 2).substring(0, 5000));
  output.set(
    'payloadSent',
    JSON.stringify(payload, null, 2).slice(0, 2500)
  );

  
/* ── POST to WP ── */
log(`POSTing to ${wpUrl}`);
// Use destructuring to get both `data` and `status` from the response
const { data, status } = await postToWp(wpUrl, authB64, payload);

/* ── Handle response ── */
const postId = data.term_id ?? data.post_id ?? data?.data?.post_id;
const action   = data.action  ?? 'unknown';
const message  = data.message ?? '';

output.set(
  'syncStatus',
  // Use the `status` variable we just received
  data && postId ? 'Success' : `HTTP_${status}`
);
output.set('action',     action);
output.set('message',    message);
output.set('postTitle',  titleForLogging);
output.set('wpPostId',   postId ?? null);
log(`✅ WP ${action} –  ${titleForLogging}`);
}