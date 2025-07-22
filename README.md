

Four12 Quick Sync Framework

Version: 2.1.0
Author: Four12 Global
Description: A modular, configuration-driven framework for syncing data from Airtable to WordPress Custom Post Types (CPTs) and Taxonomies via a secure REST API.

This plugin provides a robust foundation for creating multiple "sync" endpoints, each tailored to a specific post type or taxonomy, without duplicating core logic. It's designed for stability, scalability, and rapid development of new data pipelines.

----

f12-quick-sync/
│
├─ f12-quick-sync.php        ← Main bootstrap & router (≈150 lines)
├─ core-helpers.php         ← Re-usable functions (≈200 lines total)
├─ module-base.php           ← Abstract class every module extends (≈120 lines)
└─ modules/
     ├─ series.php           ← One class, mapping lives here
     └─ author.php           ← Ditto (add more modules as you grow)
vendor/
    └─ parsedown/Parsedown.php   ← Left untouched

----

Table of Contents

Core Philosophy

How It Works: The End-to-End Flow

File Structure

Key Features & Universal Logic

Payload Anatomy

How to Add a New CPT Sync Module

How to Add a New Taxonomy Sync Module

Core Helpers & Shared Logic

Third-Party Integrations

Authentication

Logging & Debugging

Best Practices & Performance

1. Core Philosophy

Configuration over Code: Define what to sync in a module's configuration arrays, not by writing new processing logic.

Don't Repeat Yourself (DRY): All shared logic (post lookup, image sideloading, universal business rules) lives in central files and is inherited or used by all modules.

Modular & Isolated: Each sync endpoint is its own class in the /modules directory. A bug in one module won't break another.

Idempotent & Robust: Running the same sync multiple times will not create duplicate data or cause errors. The system gracefully handles creates, updates, and retries.

2. How It Works: The End-to-End Flow

This plugin is the server-side component of the "Quick Sync" workflow.

Generated mermaid
flowchart TD
    subgraph Airtable Automation
        A[Button Click / Trigger] --> B(Airtable Media Script);
        B -- "sends image, gets back wp_id" --> C(Airtable QuickSync Script);
    end

    C -- "POSTs JSON Payload" --> D[WordPress REST API];

    subgraph WordPress (f12-quick-sync plugin)
        D -- "/four12/v1/series-sync" --> E{Plugin Router};
        E -- "routes to correct module" --> F[Series or Author Module];
        F -- "processes data using..." --> G[Base Class Logic & Core Helpers];
        G -- "creates/updates..." --> H[WP Post or Term];
    end

    H -- "sends back {post_id, action}" --> C;


Airtable Scripts prepare a JSON payload, first syncing images to get Media IDs, then packaging the full record data.

The payload is POSTed to a specific endpoint (e.g., /wp-json/four12/v1/series-sync).

The Plugin Router (f12-quick-sync.php) identifies the correct module based on the endpoint slug.

The Module (e.g., modules/series.php) provides the configuration.

The Base Class or Module Logic executes the sync, using shared helpers for common tasks.

A response is sent back to Airtable confirming the post_id or term_id and action (created or updated).

3. File Structure
Generated code
f12-quick-sync/
│
├─ f12-quick-sync.php        ← Main plugin file, bootstrapper, and router.
├─ core-helpers.php          ← Reusable, global functions (logging, sideloading).
├─ module-base.php           ← The abstract base class with all shared CPT sync logic.
└─ modules/
     ├─ series.php           ← Example CPT module. **(This is what you copy for CPTs)**
     └─ author-speaker.php   ← Example Taxonomy module. **(This is what you copy for Taxonomies)**
└─ vendor/
     └─ parsedown/
          └─ Parsedown.php    ← Third-party library for Markdown parsing.
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END
4. Key Features & Universal Logic

This framework handles complex tasks automatically for you.

Features for All Modules

SKU-based De-duplication: The primary sku field is used to find existing items to prevent duplicates.

wp_id Fast-Path: An optional wp_id in the payload allows the system to bypass the SKU lookup for faster updates.

Secure Authentication: Relies on WordPress Application Passwords for secure API access.

Automatic Logic for CPT Modules (from module-base.php)

Any module extending F12_Quick_Sync_Module_Base gets this for free:

Timezone Normalization: Any payload containing a last_synced key will have its value automatically adjusted to GMT+2 (Johannesburg time).

AIOSEO Integration: If a payload contains the _aioseo_description key, it will be automatically and safely saved using AIOSEO's models.

Dynamic Taxonomy Handling: Automatically creates and assigns terms from arrays, comma-separated strings, or hierarchical strings (Parent > Child).

Image Sideloading: If an image meta key (defined in the module's $image_meta_map) contains a URL, the plugin downloads it, adds it to the Media Library, and saves the attachment ID.

Permalink Manager Integration: Safely handles custom_permalink_uri without conflicting with the native slug.

Features for Taxonomy Modules (from author-speaker.php blueprint)

Robust Term De-duplication: Uses a wp_id -> SKU -> slug lookup chain.

Safe Meta Whitelisting: Prevents database pollution by only saving meta keys defined in an $allowed_meta_keys array. Unknown keys are logged and ignored.

Safe Meta Deletion: Only deletes a meta field if the payload explicitly sends a null value for that key, preventing accidental data loss.

Markdown Support: Easily integrates Parsedown to convert rich text fields to safe HTML.

5. Payload Anatomy

The plugin expects a specific JSON structure from Airtable.

Generated json
{
  "airtableRecordId": "recXXXXXXXXXXXXXX",
  "sku": "S0123",             // Unique identifier (required)
  "wp_id": 1234,              // WordPress Post/Term ID (optional, for fast updates)
  "fields": {
    /* --- Core Fields --- */
    "post_title": "My Series Title",      // For CPTs
    "name": "My Author Name",             // For Taxonomies
    "post_status": "publish",

    /* --- Universal Framework Keys with Special Handling --- */
    "last_synced": 1672531200,            // Becomes GMT+2 automatically for CPTs
    "_aioseo_description": "My SEO desc.", // Saved via AIOSEO automatically for CPTs
    "custom_permalink_uri": "path/to/my-series/", // Handled by Permalink Manager for CPTs

    /* --- Image Fields --- */
    "_thumbnail_id": 567,                 // WP Media ID (preferred)
    "banner-image": "https://.../img.jpg",    // URL (fallback, will be sideloaded)
    
    /* --- Taxonomy Fields --- */
    "topics": ["Topic A", "Topic B"],
    "series-categories": "Parent > Child"
  }
}
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Json
IGNORE_WHEN_COPYING_END
6. How to Add a New CPT Sync Module

Creating a new endpoint for a CPT (e.g., "Events") is incredibly simple.

Step 1: Create the Module File
Duplicate modules/series.php and rename it to modules/events.php.

Step 2: Edit the Class
Open modules/events.php and change the class name and configuration properties.

Generated php
<?php
// modules/events.php

class F12_Events_Sync_Module extends F12_Quick_Sync_Module_Base {

    protected function init() {
        // --- 1. Core Configuration ---
        $this->cpt = 'event';
        $this->endpoint_slug = 'event-sync';
        $this->sku_meta_key = 'event_sku';

        // --- 2. Field Mapping ---
        $this->core_field_map = [
            'event_title'   => 'post_title',
            'event_slug'    => 'post_name',
        ];

        $this->taxonomy_map = [
            'event_category_from_airtable' => 'event-categories',
        ];

        $this->image_meta_map = [
            '_thumbnail_id',
            'event_banner_image',
        ];

        $this->post_content_key = 'event_description'; 
    }
}
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
PHP
IGNORE_WHEN_COPYING_END

Step 3: Done!
The framework's router will automatically detect the new class and register the endpoint /wp-json/four12/v1/event-sync. It will automatically inherit the universal timezone and AIOSEO handling.

7. How to Add a New Taxonomy Sync Module

Creating an endpoint for a new taxonomy (e.g., "Topics") is just as easy.

Step 1: Create the Module File
Duplicate modules/author-speaker.php and rename it to modules/topics.php.

Step 2: Edit the Class
Open modules/topics.php and change the class name and configuration properties.

Generated php
<?php
// modules/topics.php

class F12_Topics_Sync_Module {
    // --- 1. Configuration ---
    private $endpoint_slug = 'topic-sync';
    private $taxonomy = 'topics';
    private $sku_meta_key = 'topic_sku';

    // --- 2. Whitelist your allowed meta keys ---
    private $allowed_meta_keys = [
        'topic_icon_class',
        'is_featured',
    ];

    // The rest of the file (handle_sync_request, find_existing_term, etc.)
    // contains the logic. You may need to tweak the Parsedown logic if the
    // topic description field has a different name.
}
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
PHP
IGNORE_WHEN_COPYING_END

Step 3: Done!
The router will register the new /wp-json/four12/v1/topic-sync endpoint.

8. Core Helpers & Shared Logic

module-base.php: The engine for CPTs. It handles the entire sync lifecycle, including the automatic universal logic.

core-helpers.php: Provides standalone functions available to any module:

f12_sync_log(): Conditional logging.

f12_sideload_image_from_url(): Robust image sideloading.

f12_get_post_by_sku(): Standardized post lookup.

f12_quick_sync_permission_check(): Centralized auth check.

9. Third-Party Integrations

AIOSEO / Permalink Manager / JetEngine: Handled automatically by the CPT base class.

Parsedown: To use Markdown in a taxonomy module, ensure Parsedown.php is in the vendor folder and call it within your module's handler, as seen in author-speaker.php.

10. Authentication

Authentication is handled via WordPress Application Passwords.

In the WordPress admin, go to Users > Your Profile.

Scroll down to "Application Passwords".

Create a new password (e.g., "Airtable Sync").

Copy the generated password (e.g., abcd efgh ijkl mnop qrst uvwx).

In Airtable, create a Secret named API-SYNC and store your credentials in the format username:password (e.g., my_wp_admin_user:abcd efgh ijkl mnop qrst uvwx).

11. Logging & Debugging

Enable WP_DEBUG: To see detailed logs, set WP_DEBUG and WP_DEBUG_LOG to true in your wp-config.php.

Log Location: All server-side sync activity is logged to wp-content/debug.log with the prefix [Four12 Quick Sync].

What is Logged: Failures, successes, and warnings, including ignored meta keys, reasons for skipping a field, and outcomes of third-party integrations.

12. Best Practices & Performance

Throttle on the Airtable Side: To avoid overwhelming the server, process no more than 5-10 records per minute.

Use the wp_id Fast-Path: Ensure your Airtable scripts store the post_id/term_id returned by the API and send it back on subsequent syncs.

Maintain the Whitelist: When adding a new meta field to a taxonomy sync, remember to add its key to the module's $allowed_meta_keys array.
