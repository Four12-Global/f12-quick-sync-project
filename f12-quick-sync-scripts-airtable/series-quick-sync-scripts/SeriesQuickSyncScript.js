/**
 * SeriesQuickSyncScript.js
 * Syncs Series record data from Airtable to WordPress via Quick-Sync plugin.
 * Version: 2.3 (Simplified publish_timestamp handling, enhanced logging)
 *
 * Key Changes in this version:
 * - Sends current time as 'last_synced' to WordPress.
 * - Does NOT update Airtable's 'publish_timestamp' field itself; this is handled
 *   by a subsequent conditional Airtable automation action.
 * - Prioritizes sending WordPress Media IDs (`*_wp_id` fields) for active images.
 * - Includes a fallback to send WordPress Media URLs (`*_link` fields) for active
 *   images if their `*_wp_id` is missing (Note: this will cause PHP to re-sideload).
 * - Handles deprecated `manual_` image fields by sending their historical links.
 * - Adds timestamps to console log messages.
 */

// -------- CONFIGURATION (production) ---------------------------------
const WP_ENDPOINT_URL   = 'https://four12global.com/wp-json/four12/v1/series-sync';
const AIRTABLE_TABLE_NAME = 'Series';
const API_SECRET_NAME     = 'API-SYNC';

const AIRTABLE_TITLE_FIELD = 'series_title';
const AIRTABLE_SKU_FIELD = 'series_sku';
const AIRTABLE_WP_ID_FIELD = 'wp_id';

const ALLOWED_POST_STATUSES = ['publish', 'draft', 'trash', 'private'];

// One-stop field map:  Airtable field(s)   ➜   WordPress payload key
// For images, we now define a structure to handle preferred ID and fallback Link
const FIELD_MAP = {
    // ── Core WP fields ────────────────────────────────────────────────
    'series_title':               'post_title',
    'series_slug':                'post_name',
    'long_date':                  'post_date',
    'website_status':             'post_status',
    'series_sku':                 'sku', // Also used for top-level SKU in payload
    'excerpt':                    'post_excerpt',

    // Custom permalink (Permalink Manager)
    'series_permalink':           'custom_permalink_uri',

    // ── Taxonomies ────────────────────────────────────────────────────
    'global_categories':          'global-categories',
    'series_filter_category':     'series-categories',
    'topics':                     'topics',
    'series_template':            'series-templates',

    // ── ACTIVE Media fields (Prioritize WP ID, fallback to WP URL) ─────
    // Structure: { airtableIdField: 'field_name_wp_id', airtableLinkField: 'field_name_link', wpKey: 'wp_payload_key' }
    'featured_image':    { airtableIdField: 'featured_image_wp_id',    airtableLinkField: 'featured_image_link',    wpKey: '_thumbnail_id' },
    'listing_image':     { airtableIdField: 'listing_image_wp_id',     airtableLinkField: 'listing_image_link',     wpKey: 'listing-image' },
    'no_words_image':    { airtableIdField: 'no_words_image_wp_id',    airtableLinkField: 'no_words_image_link',    wpKey: 'no-words-image' },
    'banner_image':      { airtableIdField: 'banner_image_wp_id',      airtableLinkField: 'banner_image_link',      wpKey: 'banner-image' },
    'primary_cta_image': { airtableIdField: 'primary_cta_image_wp_id', airtableLinkField: 'primary_cta_image_link', wpKey: 'manual1-image' }, // Renamed to primary_cta_image

    // ── Meta / Custom Fields (Including new CTA fields) ────────────────
    'series_description_title':   'series-description_title',
    'series_description':         'series-description',
    'who_is_it_for':              'series-who-is-it-for',
    'series_purpose':             'series-purpose',
    'series_colour_1':            'series-colour-1',
    'series_colour_2':            'series-colour-2',
    'print_pdf_link':             'link_five',
    'custom_pdf_link':            'link_ten',
    'youtube_playlist':           'youtube-playlist-link',
    'spotify_playlist':           'spotify-playlist-link',
    'apple_playlist':             'apple-playlist-link',
    'highlights_video':           'highlights-video',

    // Primary CTA fields (formerly Manual 1)
    'primary_cta_heading':        'manual1-title',
    'primary_cta_title':          'manual1-link-title',
    'primary_cta_link':           'manual1-link',

    // Secondary CTA fields (formerly Manual 2)
    'secondary_cta_heading':      'manual2-title',
    'secondary_cta_title':        'manual2-link-title',
    'secondary_cta_link':         'manual2-link',
    // 'secondary_cta_image' from Airtable is NOT mapped as per your table.

    'seo_description':            '_aioseo_description',
    'session_title':              'custom-session-title',
    'sessions_list':              'series-episode-list',
    'session_list_1':             'series-episode-list-more',
    'session_list_2':             'series-episode-list-3',
    'session_list_3':             'series-episode-list-4',
    'publish_timestamp':          'last_synced'
};
const WP_LAST_SYNCED_KEY = 'last_synced'; // The key WordPress expects for the sync timestamp

// Helper function to extract all Airtable field names needed for fetching
function getAllAirtableFieldNames(map) {
    const names = new Set();
    for (const airtableKeyOrPlaceholder in map) {
        const mapValue = map[airtableKeyOrPlaceholder];
        if (typeof mapValue === 'string') {
            // This is a direct mapping where airtableKeyOrPlaceholder is the Airtable field name
            names.add(airtableKeyOrPlaceholder);
        } else if (typeof mapValue === 'object' && mapValue !== null && mapValue.airtableIdField) {
            // This is an active image field structure
            names.add(mapValue.airtableIdField);
            if (mapValue.airtableLinkField) {
                names.add(mapValue.airtableLinkField);
            }
        }
        // If mapValue is an object but not our image structure, airtableKeyOrPlaceholder might be the field name
        // (though current FIELD_MAP doesn't use such structures for non-images).
        // For safety, if it's an unhandled object structure, we might assume airtableKeyOrPlaceholder is a field.
        // However, with the current FIELD_MAP, this is not strictly necessary.
    }
    // Ensure essential fields for SKU and Title fallbacks are always included
    names.add(AIRTABLE_TITLE_FIELD);
    names.add(AIRTABLE_SKU_FIELD);
    names.add(AIRTABLE_WP_ID_FIELD);   // make sure wp_id travels with the record
    return Array.from(names);
}

function log(message) {
    const nowUTC = new Date(); // Get current time in UTC

    // Create a new Date object adjusted for UTC+2
    // getTime() gives milliseconds since epoch (UTC)
    // Add 2 hours in milliseconds (2 hours * 60 minutes/hour * 60 seconds/minute * 1000 milliseconds/second)
    const nowGMTPlus2 = new Date(nowUTC.getTime() + (2 * 60 * 60 * 1000));

    // Now format nowGMTPlus2 using UTC methods to AVOID local timezone conversion by formatting functions
    // We want to display the *values* of nowGMTPlus2 as if it were UTC, because we've already done the +2 adjustment.
    const year = nowGMTPlus2.getUTCFullYear();
    const month = String(nowGMTPlus2.getUTCMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(nowGMTPlus2.getUTCDate()).padStart(2, '0');
    const hours = String(nowGMTPlus2.getUTCHours()).padStart(2, '0');
    const minutes = String(nowGMTPlus2.getUTCMinutes()).padStart(2, '0');
    const seconds = String(nowGMTPlus2.getUTCSeconds()).padStart(2, '0');
    
    const friendlyTimestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

    console.log(`[${friendlyTimestamp}] ${message}`);
}

// ====== START OF SCRIPT EXECUTION ======
(async () => {
    const syncAttemptTime = Math.floor(Date.now() / 1000);
    log(`🚀 QuickSync Script started. Sync Attempt Time (ISO for WP): ${syncAttemptTime}`);
    let recordIdFromInput;

    try {
        const scriptInput = input.config();
        recordIdFromInput = scriptInput.recordId; // recordId is passed from the automation trigger
        if (!recordIdFromInput) {
            throw new Error('recordId is missing from input.config(). Ensure Airtable automation trigger passes "Airtable record ID" as "recordId".');
        }
        log(`Successfully retrieved recordId: ${recordIdFromInput}`);

        const apiCreds = await input.secret(API_SECRET_NAME);
        if (!apiCreds) throw new Error(`Airtable Secret "${API_SECRET_NAME}" not found.`);
        const basicAuth = Buffer.from(apiCreds).toString('base64');
        log('Basic Auth token generated.');

        const table = base.getTable(AIRTABLE_TABLE_NAME);
        if (!table) throw new Error(`Failed to get table "${AIRTABLE_TABLE_NAME}".`);

        const airtableFieldNamesToFetch = getAllAirtableFieldNames(FIELD_MAP);
        log(`Fetching Airtable fields: ${airtableFieldNamesToFetch.join(', ')}`);
        const record = await table.selectRecordAsync(recordIdFromInput, { fields: airtableFieldNamesToFetch });
        if (!record) throw new Error(`Record ${recordIdFromInput} not found in table "${AIRTABLE_TABLE_NAME}".`);
        log(`Record ${recordIdFromInput} fetched successfully. Record Name: ${record.name}`);

        log('Building syncFields object...');
        const syncFields = {};

        for (const airtableKeyOrPlaceholder in FIELD_MAP) {
            const mapEntry = FIELD_MAP[airtableKeyOrPlaceholder];
            let cellValue;
            let payloadKey;
            let sourceAirtableFieldNameForTypeCheck = null;

            if (typeof mapEntry === 'string') {
                payloadKey = mapEntry;
                sourceAirtableFieldNameForTypeCheck = airtableKeyOrPlaceholder;
                cellValue = record.getCellValue(sourceAirtableFieldNameForTypeCheck);
            } else if (typeof mapEntry === 'object' && mapEntry.wpKey) {
                payloadKey = mapEntry.wpKey;
                const idValue = record.getCellValue(mapEntry.airtableIdField);
                const linkValue = mapEntry.airtableLinkField ? record.getCellValue(mapEntry.airtableLinkField) : null;
                if (idValue) {
                    cellValue = idValue;
                    sourceAirtableFieldNameForTypeCheck = mapEntry.airtableIdField;
                } else if (linkValue) {
                    cellValue = linkValue;
                    sourceAirtableFieldNameForTypeCheck = mapEntry.airtableLinkField;
                    log(`  WARNING for Record ${record.id}: WP ID missing in "${mapEntry.airtableIdField}". Falling back to URL from "${mapEntry.airtableLinkField}" for "${payloadKey}". PHP will re-sideload this image.`);
                } else {
                    cellValue = null;
                    sourceAirtableFieldNameForTypeCheck = mapEntry.airtableIdField;
                }
            } else {
                log(`Skipping unrecognized FIELD_MAP entry for key: ${airtableKeyOrPlaceholder}`);
                continue;
            }

            const fieldForTypeCheck = sourceAirtableFieldNameForTypeCheck ? table.getField(sourceAirtableFieldNameForTypeCheck) : null;

            if (!fieldForTypeCheck && sourceAirtableFieldNameForTypeCheck) {
                log(`  WARNING: Airtable field "${sourceAirtableFieldNameForTypeCheck}" (for WP key "${payloadKey}") not found in table schema. Assigning raw value or null.`);
                syncFields[payloadKey] = (cellValue !== null && cellValue !== undefined) ? cellValue : null;
                continue;
            }
            
            if (payloadKey === 'post_status') {
                const statusValue = record.getCellValueAsString(sourceAirtableFieldNameForTypeCheck);
                if (statusValue && ALLOWED_POST_STATUSES.includes(statusValue.toLowerCase())) {
                    syncFields[payloadKey] = statusValue.toLowerCase();
                } else {
                    log(`Post status from "${sourceAirtableFieldNameForTypeCheck}" ('${statusValue}') is blank/invalid. WP uses default/existing.`);
                }
                continue;
            }

            if (cellValue !== null && cellValue !== undefined && fieldForTypeCheck) {
                switch (fieldForTypeCheck.type) {
                    case 'multipleRecordLinks': syncFields[payloadKey] = cellValue.map(lr => lr.name); break;
                    case 'multipleSelects': syncFields[payloadKey] = cellValue.map(opt => opt.name); break;
                    case 'checkbox': syncFields[payloadKey] = cellValue; break;
                    case 'richText': case 'multilineText':
                        syncFields[payloadKey] = record.getCellValueAsString(sourceAirtableFieldNameForTypeCheck); break;
                    case 'date':
                    case 'date':
                    case 'dateTime': {
                        const raw = record.getCellValue(sourceAirtableFieldNameForTypeCheck);

                        let iso = null;
                        if (raw instanceof Date) {
                            iso = raw.toISOString();                    // Scripting app
                        } else if (typeof raw === 'string') {
                            // Airtable Automation returns ISO string already, but sanitise anyway
                            const d = new Date(raw);
                            iso = isNaN(d) ? null : d.toISOString();    // ensures Z suffix
                        }

                        syncFields[payloadKey] = iso;   // either ISO-8601 or null
                        break;
                    }
                    case 'number': syncFields[payloadKey] = cellValue; break;
                    case 'singleSelect': syncFields[payloadKey] = cellValue.name; break;
                    case 'formula': case 'lookup':
                        if (Array.isArray(cellValue) && cellValue.every(item => typeof item === 'object' && item !== null && 'name' in item)) {
                            syncFields[payloadKey] = cellValue.map(item => item.name);
                        } else if (Array.isArray(cellValue)) {
                            syncFields[payloadKey] = cellValue.map(item => String(item));
                        } else if ((mapEntry.airtableIdField && sourceAirtableFieldNameForTypeCheck === mapEntry.airtableIdField) || (mapEntry.airtableLinkField && sourceAirtableFieldNameForTypeCheck === mapEntry.airtableLinkField)) {
                            syncFields[payloadKey] = cellValue;
                        } else {
                            syncFields[payloadKey] = record.getCellValueAsString(sourceAirtableFieldNameForTypeCheck);
                        }
                        break;
                    case 'color': syncFields[payloadKey] = cellValue; break;
                    case 'url': syncFields[payloadKey] = cellValue; break;
                    case 'singleLineText': default:
                        if ((mapEntry.airtableIdField && sourceAirtableFieldNameForTypeCheck === mapEntry.airtableIdField) || (mapEntry.airtableLinkField && sourceAirtableFieldNameForTypeCheck === mapEntry.airtableLinkField)) {
                            syncFields[payloadKey] = cellValue;
                        } else {
                            syncFields[payloadKey] = record.getCellValueAsString(sourceAirtableFieldNameForTypeCheck);
                        }
                        break;
                }
            } else if (cellValue !== null && cellValue !== undefined && !fieldForTypeCheck) {
                syncFields[payloadKey] = cellValue;
            } else {
                syncFields[payloadKey] = null;
            }
        }

        // Add the dynamic sync attempt time to the payload for WordPress
        syncFields[WP_LAST_SYNCED_KEY] = syncAttemptTime;

        if (!syncFields.sku) {
            syncFields.sku = record.getCellValueAsString(AIRTABLE_SKU_FIELD);
            if (!syncFields.sku) throw new Error(`SKU from "${AIRTABLE_SKU_FIELD}" is missing. This is required.`);
            log(`SKU for "fields.sku" set from "${AIRTABLE_SKU_FIELD}": ${syncFields.sku}`);
        }
        if (!syncFields.post_title) {
            syncFields.post_title = record.getCellValueAsString(AIRTABLE_TITLE_FIELD) || record.name;
            if (!syncFields.post_title) throw new Error(`Post Title from "${AIRTABLE_TITLE_FIELD}" or record name is missing.`);
            log(`Post Title for "fields.post_title" set to: ${syncFields.post_title}`);
        }
        log('syncFields object built.');

        log('Assembling final payload...');
        if (!syncFields.sku) throw new Error('Critical: syncFields.sku is undefined before final payload assembly.');

        // ====== 5. ASSEMBLE PAYLOAD (with top-level SKU and wp_id) ======
        console.log('Assembling final payload...');
        if (!syncFields.sku) {
            throw new Error('Critical: syncFields.sku is undefined before final payload assembly.');
        }

        // Fetch the wp_id from Airtable. Default to null if it doesn't exist.
        const wpIdFromAirtable = record.getCellValue('wp_id') || null;

        const payload = {
            airtableRecordId: record.id,
            sku: syncFields.sku,         // Top-level SKU is the canonical identifier
            wp_id: wpIdFromAirtable,     // Top-level wp_id is the "fast path" hint
            fields: syncFields,          // Object containing all other fields
        };

        const prettyPayload = JSON.stringify(payload, null, 2);
        log(`📬 Payload to be sent to WordPress (first 5000 chars):\n${prettyPayload.substring(0, 5000)}`);
        output.set('payloadSent', prettyPayload.substring(0, 3000)); // For Airtable output panel

        log(`🚀 Sending request to WordPress: ${WP_ENDPOINT_URL}`);
        
        // --- Step 1: Perform the API Call ---
        let wpResponse;
        try {
            wpResponse = await fetch(WP_ENDPOINT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${basicAuth}` },
                body: JSON.stringify(payload),
            });
        } catch (fetchErr) {
            // This catches network-level errors (e.g., DNS failure, no connection)
            output.set('syncStatus', 'ERROR_WP_FETCH');
            output.set('wpError', fetchErr.message ? fetchErr.message : JSON.stringify(fetchErr));
            log(`❌ Network error during POST to WordPress: ${fetchErr.message}`);
            throw fetchErr; // Exit immediately
        }

        // --- Step 2: Handle the Response ---
        const responseBodyText = await wpResponse.text();
        log(`WordPress Raw Response Status: ${wpResponse.status}`);

        // CRITICAL: Check for non-successful HTTP statuses (like 403, 404, 500)
        if (!wpResponse.ok) {
            output.set('syncStatus', `ERROR_WP_${wpResponse.status}`);
            output.set('wpError', `Status: ${wpResponse.status}. Body: ${responseBodyText.substring(0, 1000)}`);
            throw new Error(`WordPress API returned a non-successful status: ${wpResponse.status}. Response: ${responseBodyText}`);
        }
        
        // --- Step 3: Parse the JSON Response ---
        // Declare responseData here, ensuring it's available for the rest of the block.
        let responseData; 
        try {
            responseData = JSON.parse(responseBodyText);
        } catch (parseErr) {
            output.set('syncStatus', 'ERROR_WP_JSON_PARSE');
            output.set('wpResponseRaw', responseBodyText.substring(0, 1000));
            const errorContext = `Status ${wpResponse.status} (OK), but failed to parse JSON body.`;
            log(`❌ ${errorContext} Body: ${responseBodyText.substring(0, 500)}`);
            throw new Error(`${errorContext} Error: ${parseErr.message}`);
        }

        log(`WordPress response parsed. Full ResponseData: ${JSON.stringify(responseData, null, 2)}`);
        output.set('wpResponseData', responseData);

        // --- Step 4: Validate the Parsed Data for Success ---
        const successfulPostId = responseData.post_id || (responseData.data && responseData.data.post_id);

        if (successfulPostId) {
            const action = responseData.action || (responseData.data && responseData.data.action) || 'unknown';
            const message = responseData.message || (responseData.data && responseData.data.message) || 'Success';
            log(`✅ Sync successful for SKU ${payload.sku}. Action: ${action}. WordPress Post ID: ${successfulPostId}. Message: ${message}`);
            output.set('syncStatus', 'Success');
            output.set('wpPostId', successfulPostId);
        } else {
            // The request was OK and JSON was valid, but it indicates a logical failure.
            output.set('syncStatus', 'ERROR_WP_LOGIC');
            let wpErrorMsg = `Status ${wpResponse.status}. `;
            if (responseData.data && responseData.data.message) wpErrorMsg += `WP Msg: ${responseData.data.message}`;
            else if (responseData.message && typeof responseData.message === 'string') wpErrorMsg += `WP Msg: ${responseData.message}`;
            else if (responseData.code) wpErrorMsg += `Code: ${responseData.code}, Msg: ${JSON.stringify(responseData.message)}`;
            else wpErrorMsg += `Unrecognized WP error. Raw JSON: ${responseBodyText.substring(0, 500)}`;
            
            output.set('wpError', wpErrorMsg);
            log(`❌ Sync failed due to logic error from WP for SKU ${payload.sku}. ${wpErrorMsg}`);
            throw new Error(`WordPress sync failed: ${wpErrorMsg}`);
        }

        log('🏁 Script finished processing WordPress response.');

    } catch (err) { // This is the final catch block...
        log(`🚨 Top-level script error caught: ${err.message}`);
        if(err.stack) console.error("Stack Trace:", err.stack); // Use console.error for stack for better visibility
        output.set('syncStatus', 'ERROR_SCRIPT_EXECUTION');
        output.set('scriptError', err.message || JSON.stringify(err));
        throw err; // Critical: Re-throw to make Airtable automation step fail
    }
})();