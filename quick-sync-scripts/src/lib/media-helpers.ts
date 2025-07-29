/*********************************************************************
 * media-helpers.ts  –  shared “step 1” image‑sync utilities
 *
 * Usage in an entry file (e.g. series‑media.ts):
 *
 *   import { mediaSync } from './lib/media-helpers';
 *
 *   mediaSync({
 *     airtableTable: 'Series',
 *     imageFields: IMAGE_FIELDS,
 *     envMediaEndpoints: {
 *       prod:    'https://four12global.com/wp-json/wp/v2/media',
 *       staging: 'https://wordpress-1204105-5660147.cloudwaysapps.com/wp-json/wp/v2/media',
 *     },
 *     lastModifiedField:  'media_last_modified',
 *     publishTimestampField: 'media_publish_timestamp',
 *   });
 *********************************************************************/

import { buildBasicAuth } from './sync-helpers';          // already exists

/* =========  Types  ========= */
export interface ImageFieldConfig {
  /** Airtable attachment field (array of objects with .url)              */
  attachmentField:      string;
  /** Field that stores WP media ID(s) (“123, 456”)                        */
  wpIdField:            string;
  /** Field that stores WP media URL(s)                                    */
  wpUrlField:           string;
  /** Cache of the original Airtable URL(s); lets us detect a changed img  */
  airtableCacheField:   string;
  /** Optional Airtable text field for external URL                        */
  externalUrlField?:    string;
  /** Multi‑upload?  Default false (= single attachment)                   */
  isMultiple?: boolean;
}

export interface MediaSyncConfig {
  airtableTable:          string;
  envMediaEndpoints:      Record<string, string>;  // keyed by `env` input
  imageFields:            ImageFieldConfig[];
  lastModifiedField:      string;                  // “media_last_modified”
  publishTimestampField:  string;                  // “media_publish_timestamp”
  secretName?:            string;                  // default "API‑SYNC"
}

/* =========  Small helpers ========= */
const log = (m: unknown) => console.log(`[${new Date().toISOString()}]`, m);
const SECRET_DEFAULT = 'API-SYNC';

async function download(attachment: any) {
  const res = await fetch(attachment.url);
  if (!res.ok) throw new Error(`↘ download ${attachment.url} → HTTP ${res.status}`);
  return {
    blob: await res.blob() as Blob,
    filename:  attachment.filename ?? 'file',
    contentType: res.headers.get('content-type') ?? 'application/octet-stream',
    srcUrl: attachment.url,
  };
}

async function uploadToWp(
  endpoint: string,
  basicAuth: string,
  { blob, filename, contentType }: { blob: Blob; filename: string; contentType: string },
) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
    body: blob,
  });
  const json = await res.json();
  if (!res.ok || !json?.id) {
    throw new Error(`↗ WP upload failed ${res.status}: ${JSON.stringify(json).slice(0,200)}`);
  }
  return { id: String(json.id), url: json.source_url as string };
}

/* =========  Field‑by‑field processor ========= */
async function processImageField(
  record: any,
  spec: ImageFieldConfig,
  wpEndpoint: string,
  basicAuth: string,
  onError?: (err: Error) => void,
) {
  const a = record.getCellValue(spec.attachmentField) ?? [];
  const prevWpIds   = (record.getCellValue(spec.wpIdField)  ?? '') as string;
  const prevWpUrls  = (record.getCellValue(spec.wpUrlField) ?? '') as string;
  const prevAirtUrl = (record.getCellValue(spec.airtableCacheField) ?? '') as string;
  const externalUrl = spec.externalUrlField
    ? (record.getCellValueAsString?.(spec.externalUrlField) || '').trim()
    : '';

  // If no attachments but an external link exists → just use that
  if (a.length === 0 && externalUrl) {
    const changed = externalUrl !== prevWpUrls;
    return {
      wpIds:     null,
      wpUrls:    externalUrl,
      cacheUrls: null,
      changed,
    };
  }

  /* ----- No attachment?  Maybe clear stale WP refs ------ */
  if (a.length === 0) {
    if (prevWpIds || prevWpUrls || prevAirtUrl) {
      return { wpIds: null, wpUrls: null, cacheUrls: null, changed: true };
    }
    return { changed: false };
  }

  /* ----- SINGLE attachment (99 % of your use‑cases) ----- */
  if (!spec.isMultiple) {
    const att = a[0];
    const airtableUrl = att.url;
    if (airtableUrl === prevAirtUrl && prevWpIds) {
      // unchanged – skip
      return { changed: false };
    }
    // New file or first run
    try {
      const { blob, filename, contentType } = await download(att);
      const { id, url } = await uploadToWp(wpEndpoint, basicAuth, { blob, filename, contentType });
      return { wpIds: id, wpUrls: url, cacheUrls: airtableUrl, changed: true };
    } catch (err) {
      if (onError) onError(err as Error);
      log(`⚠️  single-upload failed ${att.url}: ${(err as Error).message}`);
      return { changed: false };
    }
  }

  /* ----- MULTI attachment ----- */
  if (spec.isMultiple) {
    const uploads: Array<{id:string; url:string}> = [];
    for (const at of a) {
      try {
        const { blob, filename, contentType } = await download(at);
        const { id, url } = await uploadToWp(wpEndpoint, basicAuth, { blob, filename, contentType });
        uploads.push({ id, url });
      } catch (err) {
        if (onError) onError(err as Error);
        log(`❌  multi‑upload failed ${at.url}: ${(err as Error).message}`);
      }
    }
    if (uploads.length) {
      return {
        wpIds: uploads.map(u => u.id).join(","),
        wpUrls: uploads.map(u => u.url).join(","),
        cacheUrls: a.map((att: any) => att.url).join(","),
        changed: true,
      };
    }
    return { changed: false };
  }
  // fallback
  return { changed: false };
}

/* =========  Orchestrator ========= */
export async function mediaSync(cfg: MediaSyncConfig, inputConfig: any) {
  let hadErrors = false;
  const {
    airtableTable,
    envMediaEndpoints,
    imageFields,
    lastModifiedField,
    publishTimestampField,
    secretName = SECRET_DEFAULT,
  } = cfg;

  /* —— Inputs —— */
  // Use the passed-in inputConfig object, just like in quickSync
  const { recordId, env } = inputConfig;
  if (!recordId) throw new Error('Automation must pass {recordId}.');
  // The same safe check for the 'env' variable
  if (!env || !envMediaEndpoints[env]) {
    const availableEnvs = Object.keys(envMediaEndpoints).join(', ');
    throw new Error(`Input variable "env" is missing or invalid. Please provide one of the following: ${availableEnvs}`);
  }
  const wpEndpoint = envMediaEndpoints[env];
  const basicAuth  = buildBasicAuth(await input.secret(secretName), secretName);

  const table  = base.getTable(airtableTable);
  const fields = [
    lastModifiedField,
    publishTimestampField,
    ...imageFields.flatMap(f => [
      f.attachmentField,
      f.wpIdField,
      f.wpUrlField,
      f.airtableCacheField,
    ]),
  ];
  const rec = await table.selectRecordAsync(recordId, { fields });
  if (!rec) throw new Error(`Record ${recordId} not found.`);

  /* —— Short‑circuit if nothing changed —— */
  const lastMod  = rec.getCellValue(lastModifiedField)       as string | null;
  const lastSync = rec.getCellValue(publishTimestampField)   as string | null;
  if (lastMod && lastSync && Date.parse(lastMod) <= Date.parse(lastSync)) {
    log('⏭ Images unchanged since last sync – skipping');
    return;
  }

  /* —— Process every image spec —— */
  const updates: Record<string, any> = {};
  let anyChanges = false;

  for (const spec of imageFields) {
    try {
      const r = await processImageField(rec, spec, wpEndpoint, basicAuth, (err) => { hadErrors = true; });
      if (r && r.changed) {
        updates[spec.wpIdField]          = r.wpIds   ?? null;
        updates[spec.wpUrlField]         = r.wpUrls  ?? null;
        updates[spec.airtableCacheField] = r.cacheUrls ?? null;
        anyChanges = true;
      }
    } catch (err) {
      hadErrors = true;
      log(`⚠️  ${spec.attachmentField}: ${(err as Error).message}`);
      // do NOT touch fields on error – leave stale values
    }
  }

  if (anyChanges) {
    if (!hadErrors) {
      updates[publishTimestampField] = new Date().toISOString();
    } else {
      log('⚠️  Skipping timestamp because at least one upload failed');
    }
    await table.updateRecordAsync(rec, updates);
    log('✅ Media sync complete & fields updated');
  } else {
    log('✔ No media changes detected – nothing to write');
  }
}
