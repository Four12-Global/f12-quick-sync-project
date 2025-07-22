# Airtable Script Templates for Quick-Sync

This directory contains master templates for the JavaScript code that runs inside Airtable Automations. Using these templates ensures a consistent, reliable, and easy-to-extend synchronization process.

**Do not edit the template files directly.** Always copy their contents to create new scripts for each CPT or Taxonomy you want to sync.

## The Two-Step Sync Process

For any given record, the sync is a two-step process within Airtable Automations:

1.  **Media Sync (Step 1):** The `TEMPLATE_MediaScript.js` runs first. Its only job is to upload image attachments to the WordPress Media Library and write the resulting WordPress Media IDs back into the Airtable record.

2.  **Data Sync (Step 2):** The `TEMPLATE_QuickSyncScript.js` runs second. It gathers all the record's data—including the Media IDs from Step 1—and sends the complete package to the custom WordPress endpoint.

This two-step approach is crucial because it ensures that when the main data sync happens, we are sending stable WordPress Media IDs, not temporary URLs.

---

## How to Use `TEMPLATE_MediaScript.js`

Follow these steps to set up the media sync for a new CPT (e.g., "Events").

1.  **Copy Template:** Open `TEMPLATE_MediaScript.js` and copy its entire contents.
2.  **Create Airtable Script:** In your Airtable base, go to **Automations**. Create a new automation or edit an existing one. Add a "Run a script" action.
3.  **Paste Code:** Paste the copied code into the Airtable script editor.
4.  **Add Input Variable:** The script requires one input variable. In the left panel, add a variable named `recordId` and set its value to the `Airtable record ID` from the automation's trigger step.
5.  **Configure:** In the script editor, carefully fill out the `--- CONFIGURATION ---` block at the top of the script.
    ```javascript
    // 1. WordPress Base URL
    const WP_BASE_URL = "https://four12global.com";

    // 2. Airtable Table Name
    const TABLE_NAME = "Events"; // Your CPT's table name

    // 3. Secret Name
    const API_SECRET_NAME = "API-SYNC";

    // 4. Image Field Configurations
    const IMAGE_FIELD_CONFIGS = [
      {
        airtableAttachmentField: "event_featured_image", // Attachment field in your Events table
        wpIdField: "event_featured_image_wp_id",         // Number field to store the WP ID
        wpLinkField: "event_featured_image_link",        // URL/Text field for the WP URL
        externalCacheField: "event_featured_image_ext",  // URL/Text field for the Airtable URL
      }
      // Add more objects if the Event CPT has more images
    ];

    // 5. Control Fields
    const CONTROL_FIELDS = {
      lastModifiedField: "event_media_last_modified", // A "Last Modified Time" field watching your attachment fields
      publishTimestampField: "event_media_publish_ts",  // A "Date" field
    };
    ```
6.  **Set Secret:** Ensure your automation has access to the `API-SYNC` secret containing your WordPress `username:application_password`.

---

## How to Use `TEMPLATE_QuickSyncScript.js`

Follow these steps to set up the main data sync. This action should run **after** the Media Script action in the same automation.

1.  **Copy Template:** Open `TEMPLATE_QuickSyncScript.js` and copy its entire contents.
2.  **Create Airtable Script:** Add a new "Run a script" action to your automation.
3.  **Paste Code:** Paste the copied code into the script editor.
4.  **Add Input Variable:** Just like before, add the `recordId` input variable.
5.  **Configure:** In the script editor, carefully fill out the `--- CONFIGURATION ---` block. The `FIELD_MAP` is the most important part.
    ```javascript
    // 1. WordPress Base URL
    const WP_BASE_URL = "https://four12global.com";

    // 2. The specific route for your sync endpoint
    const WP_ROUTE_SUFFIX = "/wp-json/four12/v1/event-sync"; // The endpoint for your CPT

    // 3. Airtable Table Name
    const TABLE_NAME = "Events";

    // 4. Secret Name
    const API_SECRET_NAME = "API-SYNC";

    // 5. The Airtable field for the unique SKU.
    const SKU_FIELD = "event_sku";

    // 6. The Airtable field for the WordPress Post ID.
    const WP_ID_FIELD = "wp_id";

    // 7. Field Map: 'Airtable Field Name': 'wp_payload_key'
    const FIELD_MAP = {
      'event_title':          'post_title',
      'event_slug':           'post_name',
      'event_categories':     'event-categories',
      'event_featured_image_wp_id': '_thumbnail_id', // Use the ID field from the media script!
      'event_description':    'event-description',
    };
    ```

## Debugging

-   Always check the **Run history** of your Airtable automation.
-   The script logs its progress to the console, which is visible in the run history.
-   The script also uses `output.set()` to provide structured results, like `payloadPreview` and `wpResponse`, which are invaluable for troubleshooting.