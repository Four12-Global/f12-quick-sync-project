/**
 * SeriesMediaScript.js
 * -----------------------------------------------------------------------------
 * Purpose: This script, designed for Airtable Automations, manages the synchronization
 * of specific image attachments from Airtable records to the WordPress Media Library.
 * It ensures that images are uploaded efficiently, populates WordPress Media IDs and URLs
 * back into Airtable, and uses timestamps to avoid redundant processing.
 *
 * Core Logic:
 * 1. Auth: Pulls WordPress credentials securely from an Airtable Secret named 'API-SYNC'.
 * 2. Top-Level Check: Compares a 'media_last_modified' field with a
 *    'media_publish_timestamp' field. If media hasn't been modified since the
 *    last successful sync, detailed image processing for the record is skipped.
 * 3. Individual Image Processing (if #2 passes):
 *    - For each defined image type (e.g., featured_image, banner_image):
 *      - If an Airtable attachment exists:
 *        - It checks if the Airtable attachment URL has changed OR if the
 *          WordPress Media ID (`*_wp_id`) is missing in Airtable.
 *        - If either condition is true, the image is downloaded from Airtable
 *          and uploaded to WordPress.
 *        - The corresponding `*_wp_id` (WP Media ID), `*_link` (WP Media URL),
 *          and `*_external` (Airtable attachment URL for caching) fields in
 *          Airtable are updated.
 *      - If no Airtable attachment exists, but WP ID/Link fields were previously
 *        populated, these Airtable fields are cleared.
 * 4. Timestamping: The 'media_publish_timestamp' field in Airtable is updated
 *    with the current time ONLY IF:
 *    - Detailed image processing occurred.
 *    - Actual changes were made to one or more image-related fields.
 *    - No errors occurred during any image upload for that record.
 * -----------------------------------------------------------------------------
 */

/**
 * === CONFIGURATION ===
 * REVIEW AND UPDATE THESE VALUES CAREFULLY
 */
const WP_URL = "https://four12global.com/wp-json/wp/v2/media"; // Your WP media endpoint

const TABLE_NAME = "Series"; // The Airtable table name for your Series
const MEDIA_PUBLISH_TIMESTAMP_FIELD = "media_publish_timestamp"; // Airtable field to store the last successful image sync timestamp for this script
const MEDIA_LAST_MODIFIED_FIELD = 'media_last_modified'; // Airtable "Last Modified Time" field watching relevant attachment fields


/**
 * === MAIN SCRIPT EXECUTION ===
 */
(async () => {
  console.log("SeriesImageScript.js: Execution started.");

  /** --------- WordPress Auth via Airtable Secret ---------- */
  const API_SECRET_NAME = 'API-SYNC';

  // in Automations, input.secret() exists; in the Scripting app it doesn't
  let apiCreds;
  if (input.secret) {
      apiCreds = await input.secret(API_SECRET_NAME);
  } else {
      // Hard-fail if not running in an automation context where secrets are available.
      throw new Error(`CRITICAL: input.secret() is not available. This script must be run from an Airtable Automation with the '${API_SECRET_NAME}' secret configured.`);
  }

  if (!apiCreds) {
      throw new Error(`Missing '${API_SECRET_NAME}' secret on this automation step. Please add it via the Variables panel.`);
  }

  const BASIC_AUTH_HEADER = 'Basic ' + Buffer.from(apiCreds).toString('base64');
  /* ------------------------------------------------------- */


  /**
   * === HELPER FUNCTIONS (defined within async scope for auth access) ===
   */

  /**
   * Downloads an image attachment from Airtable.
   * @param {Object} attachment - The Airtable attachment object.
   * @returns {Promise<{blob: Blob, contentType: string, filename: string}>}
   */
  async function downloadImage(attachment) {
    if (!attachment || !attachment.url) {
      throw new Error("No valid attachment URL found.");
    }
    const response = await fetch(attachment.url);
    if (!response.ok) {
      throw new Error(`Failed to download image from ${attachment.url}: ${response.status} ${response.statusText}`);
    }
    const contentType = response.headers.get("content-type");
    const blob = await response.blob();
    return { blob, contentType, filename: attachment.filename };
  }

  /**
   * Uploads an image blob to WordPress and returns the WP media data.
   * @param {Blob} imageBlob
   * @param {string} filename
   * @param {string} contentType
   * @returns {Promise<{id: number, url: string}>} WP Media ID and Source URL.
   */
  async function uploadToWordPress(imageBlob, filename, contentType) {
    const response = await fetch(WP_URL, {
      method: "POST",
      headers: {
        'Authorization': BASIC_AUTH_HEADER, // Use the secret-based auth header
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`
      },
      body: imageBlob
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WordPress upload failed for ${filename}: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    if (!data.id || !data.source_url) {
      console.error("WordPress response data:", data);
      throw new Error(`WordPress response missing id or source_url for ${filename}. Response: ${JSON.stringify(data)}`);
    }
    return { id: data.id, url: data.source_url };
  }

  // Note: splitCommaSeparatedString is kept for processImageField's multiple attachments logic,
  // though current active fields are single.
  function splitCommaSeparatedString(str) {
      if (!str || typeof str !== 'string') { return []; }
      return str.split(",").map(s => s.trim()).filter(s => s.length > 0);
  }

  /**
   * Processes an image field (single or multiple attachments).
   * Uploads new/changed images to WordPress if needed.
   *
   * @param {Record} record - The Airtable record.
   * @param {string} attachmentField - Airtable field name for attachments.
   * @param {string} wpIdField - Airtable field name for storing WP Media ID(s).
   * @param {string} wpUrlField - Airtable field name for storing WP Media URL(s).
   * @param {string} airtableUrlField - Airtable field name for storing original Airtable URL(s) (cache).
   * @param {boolean} isMultiple - True if the field can have multiple attachments.
   * @returns {Promise<{wpIds: string|null, wpUrls: string|null, airtableUrls: string|null, error?: boolean}>}
   */
  async function processImageField(record, attachmentField, wpIdField, wpUrlField, airtableUrlField, isMultiple) {
    const currentAttachments = record.getCellValue(attachmentField) || [];
    const storedWpIdsStr = record.getCellValue(wpIdField); // Fetch once
    const storedWpUrlsStr = record.getCellValue(wpUrlField);
    const storedAirtableUrlsStr = record.getCellValue(airtableUrlField);

    if (currentAttachments.length === 0) {
      // No current Airtable attachment. If WP fields were previously set, clear them.
      if (storedWpIdsStr || storedWpUrlsStr || storedAirtableUrlsStr) {
          console.log(`  No attachments in "${attachmentField}". Clearing related WP/cache fields.`);
          return { wpIds: null, wpUrls: null, airtableUrls: null }; // Signal to clear
      }
      // No attachment and no stored WP data, so no change needed.
      return {
          wpIds: null, // Keep existing null
          wpUrls: null, // Keep existing null
          airtableUrls: null // Keep existing null
      };
    }

    // --- Single Attachment Logic (isMultiple === false) ---
    if (!isMultiple) {
      const attachment = currentAttachments[0]; // Assuming single attachment field

      // Skip if: Airtable URL is unchanged AND WP ID already exists.
      if (storedAirtableUrlsStr === attachment.url && storedWpIdsStr) {
        console.log(`  Skipping "${attachment.filename}" in "${attachmentField}": Airtable URL unchanged and WP ID (${storedWpIdsStr}) exists.`);
        return {
          wpIds: storedWpIdsStr,
          wpUrls: storedWpUrlsStr,
          airtableUrls: storedAirtableUrlsStr
        };
      }

      // Proceed if Airtable URL changed OR WP ID is missing
      let reasonToProcess = "";
      if (storedAirtableUrlsStr !== attachment.url) reasonToProcess += "Airtable URL changed. ";
      if (!storedWpIdsStr) reasonToProcess += "WP ID missing.";

      console.log(`  Processing "${attachment.filename}" from "${attachmentField}". Reason: ${reasonToProcess.trim()}`);
      try {
        const { blob, contentType, filename } = await downloadImage(attachment);
        const wpMedia = await uploadToWordPress(blob, filename, contentType);
        console.log(`    Uploaded "${filename}" to WP. ID: ${wpMedia.id}, URL: ${wpMedia.url}`);
        return {
          wpIds: String(wpMedia.id),
          wpUrls: wpMedia.url,
          airtableUrls: attachment.url // Cache the new Airtable URL
        };
      } catch (error) {
        console.error(`  Error processing single image "${attachment.filename}" from "${attachmentField}":`, error.message);
        // On error, return existing stored values to prevent accidental clearing if a transient error occurs
        return {
          wpIds: storedWpIdsStr || null,
          wpUrls: storedWpUrlsStr || null,
          airtableUrls: storedAirtableUrlsStr || null,
          error: true
        };
      }
    } else {
      // --- Multiple Attachments Logic (Kept for completeness, though not used by current active fields) ---
      console.log(`  Processing multiple attachments for "${attachmentField}"...`);
      const storedAirtableUrlsArr = splitCommaSeparatedString(storedAirtableUrlsStr);
      const existingWpIdsArr = splitCommaSeparatedString(storedWpIdsStr);
      const existingWpUrlsArr = splitCommaSeparatedString(storedWpUrlsStr);

      const existingMediaMap = new Map();
      storedAirtableUrlsArr.forEach((url, index) => {
        existingMediaMap.set(url, {
          wpId: existingWpIdsArr[index] || null,
          wpUrl: existingWpUrlsArr[index] || null
        });
      });

      let newWpIds = [];
      let newWpUrls = [];
      let newAirtableUrls = [];
      let hasErrorInMultiple = false;

      for (const attachment of currentAttachments) {
        const existingEntry = existingMediaMap.get(attachment.url);
        // Skip if: Airtable URL is unchanged AND WP ID already exists for this specific attachment.
        if (existingEntry && existingEntry.wpId) {
          console.log(`    Skipping (multiple) "${attachment.filename}": Airtable URL unchanged and WP ID (${existingEntry.wpId}) exists.`);
          if(existingEntry.wpId) newWpIds.push(existingEntry.wpId);
          if(existingEntry.wpUrl) newWpUrls.push(existingEntry.wpUrl);
          newAirtableUrls.push(attachment.url);
        } else {
          let reasonToProcessMulti = "";
          if (!existingEntry) reasonToProcessMulti += "New Airtable URL. ";
          else if (!existingEntry.wpId) reasonToProcessMulti += "WP ID missing for this Airtable URL. ";

          console.log(`    Processing (multiple) "${attachment.filename}". Reason: ${reasonToProcessMulti.trim()}`);
          try {
            const { blob, contentType, filename } = await downloadImage(attachment);
            const wpMedia = await uploadToWordPress(blob, filename, contentType);
            console.log(`      Uploaded (multiple) "${filename}" to WP. ID: ${wpMedia.id}, URL: ${wpMedia.url}`);
            newWpIds.push(String(wpMedia.id));
            newWpUrls.push(wpMedia.url);
            newAirtableUrls.push(attachment.url);
          } catch (error) {
            hasErrorInMultiple = true;
            console.error(`    Error processing multiple image "${attachment.filename}":`, error.message);
            // If an error occurs, try to retain existing data for this image if it was known
            if (existingEntry) {
              if(existingEntry.wpId) newWpIds.push(existingEntry.wpId);
              if(existingEntry.wpUrl) newWpUrls.push(existingEntry.wpUrl);
              newAirtableUrls.push(attachment.url); // Keep its Airtable URL
            }
          }
        }
      }
      return {
        wpIds: newWpIds.length > 0 ? newWpIds.join(", ") : null,
        wpUrls: newWpUrls.length > 0 ? newWpUrls.join(", ") : null,
        airtableUrls: newAirtableUrls.length > 0 ? newAirtableUrls.join(", ") : null,
        error: hasErrorInMultiple
      };
    }
  }


  /**
   * === MAIN LOGIC EXECUTION ===
   */
  try {
    const inputConfig = input.config();
    const recordId = inputConfig.recordId;
    if (!recordId) {
      throw new Error("No triggered record ID provided in input.config(). Script expects to be run from an automation trigger.");
    }
    console.log(`Processing Record ID: ${recordId} in Table: "${TABLE_NAME}"`);

    const table = base.getTable(TABLE_NAME);

    // Define all fields to fetch, including active image sets and control fields
    const fieldsToFetch = [
      // Control Fields
      MEDIA_LAST_MODIFIED_FIELD,
      MEDIA_PUBLISH_TIMESTAMP_FIELD,
      // Active Image Sets (Attachment, WP ID, WP URL, Airtable URL Cache)
      "featured_image_attachment", "featured_image_wp_id", "featured_image_link", "featured_image_external",
      "banner_image_attachment",   "banner_image_wp_id",   "banner_image_link",   "banner_image_external",
      "listing_image_attachment",  "listing_image_wp_id",  "listing_image_link",  "listing_image_external",
      "no_words_image_attachment", "no_words_image_wp_id", "no_words_image_link", "no_words_image_external",
      "primary_cta_image_attachment", "primary_cta_image_wp_id", "primary_cta_image_link", "primary_cta_image_external",
      // Add other *active* image sets here if any
    ];
    const uniqueFieldsToFetch = [...new Set(fieldsToFetch)]; // Deduplicate

    const record = await table.selectRecordAsync(recordId, { fields: uniqueFieldsToFetch });
    if (!record) {
      throw new Error(`Record with ID ${recordId} not found in table "${TABLE_NAME}".`);
    }

    // --- Top-Level Conditional Logic ---
    const mediaLastModifiedValue = record.getCellValue(MEDIA_LAST_MODIFIED_FIELD);
    const mediaPublishTimestampValue = record.getCellValue(MEDIA_PUBLISH_TIMESTAMP_FIELD);
    let proceedWithFullImageProcessing = false;

    if (!mediaLastModifiedValue) {
      console.log(`Field "${MEDIA_LAST_MODIFIED_FIELD}" is empty. Proceeding with detailed image checks as a precaution.`);
      proceedWithFullImageProcessing = true;
    } else if (!mediaPublishTimestampValue) {
      console.log(`Field "${MEDIA_PUBLISH_TIMESTAMP_FIELD}" is empty. Proceeding with detailed image checks.`);
      proceedWithFullImageProcessing = true;
    } else if (new Date(mediaLastModifiedValue) > new Date(mediaPublishTimestampValue)) {
      console.log(`"${MEDIA_LAST_MODIFIED_FIELD}" (${mediaLastModifiedValue}) is newer than "${MEDIA_PUBLISH_TIMESTAMP_FIELD}" (${mediaPublishTimestampValue}). Proceeding with detailed image checks.`);
      proceedWithFullImageProcessing = true;
    } else {
      console.log(`"${MEDIA_LAST_MODIFIED_FIELD}" is not newer than "${MEDIA_PUBLISH_TIMESTAMP_FIELD}". Skipping detailed image processing for this record.`);
      proceedWithFullImageProcessing = false;
    }

    const updatePayload = {};
    let anyErrorOccurredProcessingImages = false;
    let actualChangesMadeToMediaFields = false;

    if (proceedWithFullImageProcessing) {
      console.log("Proceeding with detailed image field processing...");
      // Define active image field sets to process
      // Format: [attachmentField, wpIdField, wpUrlField, airtableUrlField, isMultipleAttachments]
      const imageFieldSets = [
        ["featured_image_attachment", "featured_image_wp_id", "featured_image_link", "featured_image_external", false],
        ["banner_image_attachment",   "banner_image_wp_id",   "banner_image_link",   "banner_image_external",   false],
        ["listing_image_attachment",  "listing_image_wp_id",  "listing_image_link",  "listing_image_external",  false],
        ["no_words_image_attachment", "no_words_image_wp_id", "no_words_image_link", "no_words_image_external", false],
        ["primary_cta_image_attachment", "primary_cta_image_wp_id", "primary_cta_image_link", "primary_cta_image_external", false]

      ];

      for (const [attachF, idF, urlF, airtableF, isMulti] of imageFieldSets) {
        console.log(`Processing image set for attachment field: "${attachF}"`);
        const result = await processImageField(record, attachF, idF, urlF, airtableF, isMulti);

        // Check if any of the returned values are different from existing ones
        if (result.wpIds !== record.getCellValue(idF)) {
          updatePayload[idF] = result.wpIds;
          actualChangesMadeToMediaFields = true;
        }
        if (result.wpUrls !== record.getCellValue(urlF)) {
          updatePayload[urlF] = result.wpUrls;
          actualChangesMadeToMediaFields = true;
        }
        if (result.airtableUrls !== record.getCellValue(airtableF)) {
          updatePayload[airtableF] = result.airtableUrls;
          actualChangesMadeToMediaFields = true;
        }

        if (result.error) {
          anyErrorOccurredProcessingImages = true;
        }
      }

      // --- Update MEDIA_PUBLISH_TIMESTAMP_FIELD Logic ---
      if (actualChangesMadeToMediaFields && !anyErrorOccurredProcessingImages) {
        updatePayload[MEDIA_PUBLISH_TIMESTAMP_FIELD] = new Date().toISOString();
        console.log(`Image sync successful with changes. Field "${MEDIA_PUBLISH_TIMESTAMP_FIELD}" will be updated.`);
      } else if (actualChangesMadeToMediaFields && anyErrorOccurredProcessingImages) {
        console.log(`Image sync had changes but also errors. Field "${MEDIA_PUBLISH_TIMESTAMP_FIELD}" will NOT be updated.`);
      } else if (!actualChangesMadeToMediaFields && !anyErrorOccurredProcessingImages) {
        console.log(`No actual changes to media fields detected during processing (and no errors). Field "${MEDIA_PUBLISH_TIMESTAMP_FIELD}" will not be updated.`);
      } else if (!actualChangesMadeToMediaFields && anyErrorOccurredProcessingImages) { // Should be rare
        console.log(`No actual changes to media fields, but errors occurred. Field "${MEDIA_PUBLISH_TIMESTAMP_FIELD}" will not be updated.`);
      }
    } else {
        console.log("Skipped detailed image field processing based on timestamps.");
    }


    // --- Perform Airtable Record Update ---
    if (Object.keys(updatePayload).length > 0) {
      console.log(`Preparing to update Airtable record ${recordId} with fields: ${Object.keys(updatePayload).join(", ")}`);
      await table.updateRecordAsync(recordId, updatePayload);
      console.log(`Record ${recordId} updated successfully in Airtable.`);
    } else {
      console.log(`No field value changes required for Airtable record ${recordId} by this script run.`);
    }

    // --- Final Logging ---
    if (proceedWithFullImageProcessing) {
        if (anyErrorOccurredProcessingImages) {
            console.warn(`Record ${recordId} image processing completed, but one or more image operations encountered an error. Review logs. "${MEDIA_PUBLISH_TIMESTAMP_FIELD}" was not updated if errors occurred alongside changes.`);
        } else if (actualChangesMadeToMediaFields) {
            console.log(`All image operations for record ${recordId} completed successfully, and changes were applied to Airtable.`);
        } else {
            console.log(`All image operations for record ${recordId} completed, but no changes to media fields were needed.`);
        }
    }
    console.log("SeriesImageScript.js: Execution finished.");

  } catch (error) {
    console.error("=== SERIES IMAGE SCRIPT - CRITICAL ERROR ===:", error.message);
    if (error.stack) {
        console.error("Stack Trace:", error.stack);
    }
    throw error; // Re-throw to ensure the Airtable automation step reflects the failure.
  }
})();