Excellent. Here is a comprehensive, accurate, and well-structured `README.md` file for the `quick-sync-plugin` directory.

It is written for a developer who needs to understand, maintain, and extend the plugin. It addresses the outdated information from your original README and accurately documents the powerful features you have built.

---

# Four12 Quick Sync Framework

**Version: 2.1.0**
**Author: Four12 Global**

This WordPress plugin provides a modular, configuration-driven framework for syncing data from Airtable. It creates secure REST API endpoints tailored to specific Custom Post Types (CPTs) and Taxonomies, handling the complex logic of data validation, creation, and updating.

## Core Philosophy

*   **Configuration over Code:** Define *what* to sync in a module's configuration arrays, not by writing new processing logic.
*   **Don't Repeat Yourself (DRY):** All shared logic (post lookup, image handling, business rules) lives in central files and is inherited or used by all modules.
*   **Modular & Isolated:** Each sync endpoint is its own class in the `/modules` directory. A bug in one module won't break another.
*   **Two Patterns for Two Jobs:** The framework uses a powerful base class for CPTs and a flexible standalone class pattern for Taxonomies, providing the right tool for each job.

## Installation & Dependencies

1.  Place this plugin folder (`quick-sync-plugin`) in your `wp-content/plugins` directory.
2.  This plugin uses third-party libraries managed by Composer. If the `vendor` directory is missing, you must run `composer install` from within this directory:
    ```bash
    # Navigate to the plugin directory
    cd wp-content/plugins/quick-sync-plugin

    # Install PHP dependencies
    composer install
    ```
3.  Activate the plugin in the WordPress admin panel.

## File Structure Breakdown

The plugin's architecture is designed for clarity and separation of concerns.

```
quick-sync-plugin/
│
├─ f12-quick-sync.php        # The Router: Main plugin file that boots the framework and registers all module API routes.
├─ core-helpers.php          # The Toolbox: Global helper functions (logging, image sideloading, SKU lookups).
├─ module-base.php           # The Engine: An abstract base class containing all shared logic for CPT syncing.
├─ relations.php             # The Specialist: A dedicated helper for handling JetEngine relationships.
└─ modules/
     ├─ series-sync.php      # Example CPT Module: A simple configuration class that extends module-base.php.
     └─ author-sync.php      # Example Taxonomy Module: A standalone class with its own full request logic.
```

## How It Works: The Request Lifecycle

1.  An API request (e.g., `POST /wp-json/four12/v1/sessions-sync`) arrives from an Airtable script.
2.  The **Router** (`f12-quick-sync.php`) matches the endpoint slug (`sessions-sync`) to its corresponding module class (`F12_Sessions_Sync_Module`).
3.  The request is handed off to the module's `handle_sync_request` method.
4.  For CPTs, this method lives in the **Engine** (`module-base.php`). It orchestrates the entire process:
    *   Finds the existing post via `wp_id` or `sku`.
    *   Prepares and saves core post data (`post_title`, `post_date`, etc.).
    *   Processes taxonomies, media, relationships, and all other metadata based on the module's configuration.
5.  A JSON response is sent back to Airtable confirming the `post_id` and the action taken (`created` or `updated`).

---

## Key Features

### Universal Features (All Modules)

*   **SKU-based De-duplication:** A `sku` field is used to reliably find existing items, preventing duplicates.
*   **`wp_id` Fast-Path:** An optional `wp_id` in the payload bypasses the SKU lookup for faster, more efficient updates.
*   **Secure Authentication:** Relies on WordPress Application Passwords for all endpoints.
*   **Robust Post Type Validation:** Returns a `409 Conflict` error if a `wp_id` is provided that belongs to a post of the wrong type, preventing accidental data corruption.

### CPT Module Features (via `module-base.php`)

Any CPT module that extends `F12_Quick_Sync_Module_Base` gets this powerful logic automatically:

*   **Declarative Markdown Parsing:** Simply map an Airtable field to `post_content` (or a meta field) in the `$markdown_map` property, and it will be automatically converted to safe HTML using Parsedown.
*   **AIOSEO Integration:** Payloads containing the `_aioseo_description` key are automatically and safely saved using AIOSEO's models.
*   **Dynamic Taxonomy Handling:** Automatically creates and assigns terms from arrays, comma-separated strings, or hierarchical strings (`Parent > Child`).
*   **Image Sideloading Fallback:** If an image meta key (defined in `$image_meta_map`) contains a URL instead of an ID, the plugin downloads it to the Media Library and saves the new attachment ID.
*   **JetEngine Relationship Sync:** A declarative `$jet_engine_relation_map` allows for effortless syncing of parent-child relationships using SKUs.

---

## How to Add a New Sync Module

### **Pattern 1: Adding a New CPT Sync (e.g., "Events")**

This is the most common pattern. It relies purely on configuration and inherits all logic.

1.  **Create Module File:** Duplicate `modules/series-sync.php` and rename it `modules/events-sync.php`.
2.  **Configure the Class:** Edit the class name and fill in the configuration properties.

    ```php
    <?php
    // modules/events-sync.php

    class F12_Events_Sync_Module extends F12_Quick_Sync_Module_Base {

        protected function init() {
            // --- 1. Core Configuration ---
            $this->cpt = 'event';
            $this->endpoint_slug = 'event-sync';
            $this->sku_meta_key = 'event_sku';

            // --- 2. Field Mapping ---
            $this->core_field_map = [
                // Airtable Payload Key => WordPress Post Field
                'event_title'   => 'post_title',
                'event_date'    => 'post_date',
                'event_status'  => 'post_status',
            ];
            $this->taxonomy_map = [
                'event_type' => 'event-category',
            ];
            $this->image_meta_map = [
                '_thumbnail_id',
                'banner_image',
            ];

            // --- 3. (Optional) Markdown Mapping ---
            $this->markdown_map = [
                // Airtable Field      => Destination(s) in WordPress
                'event_description_md' => ['post_content'],
            ];
        }
    }
    ```
3.  **Done!** The framework automatically discovers the new module and registers the `/wp-json/four12/v1/event-sync` endpoint on the next page load.

### **Pattern 2: Adding a New Taxonomy Sync (e.g., "Topics")**

This pattern provides more granular control for the unique needs of taxonomies (like meta whitelisting).

1.  **Create Module File:** Duplicate `modules/author-sync.php` and rename it `modules/topics-sync.php`.
2.  **Configure the Class:** Edit the class name and update the private configuration properties. The core logic for finding, creating, and updating terms is already present.

    ```php
    <?php
    // modules/topics-sync.php

    class F12_Topics_Sync_Module { // Note: Does NOT extend the base class
        // --- 1. Configuration ---
        private $endpoint_slug = 'topic-sync';
        private $taxonomy = 'topics';
        private $sku_meta_key = 'topic_sku';

        // --- 2. Whitelist your allowed meta keys ---
        private $allowed_meta_keys = [
            'topic_icon_class',
            'is_featured_topic',
        ];

        // The rest of the file (handle_sync_request, find_existing_term, etc.)
        // contains the robust logic for handling taxonomy terms.
    }
    ```
3.  **Done!** The router will register the new `/wp-json/four12/v1/topic-sync` endpoint.

---

## Payload Anatomy

The plugin expects a specific JSON structure from Airtable scripts.

```json
{
  "airtableRecordId": "recXXXXXXXXXXXXXX",
  "sku": "S0123",             // Unique identifier (required)
  "wp_id": 1234,              // WordPress Post/Term ID (optional, for fast updates)
  "fields": {
    /* --- Core Fields (for CPTs) --- */
    "post_title": "My Series Title",
    "post_status": "publish",
    "post_date": "2024-01-01T12:00:00Z",

    /* --- Universal Framework Keys with Special Handling --- */
    "_aioseo_description": "My SEO description.",
    "jet_relation_series_parent": ["PARENT-SKU-001"],

    /* --- Image Fields --- */
    "_thumbnail_id": 567,                 // WP Media ID (preferred)
    "banner-image": "https://.../img.jpg",    // URL (fallback, will be sideloaded)

    /* --- Taxonomy Fields --- */
    "topics": ["Topic A", "Topic B"],
    "series-categories": "Parent > Child"
  }
}
```

## Authentication

Authentication is handled via **WordPress Application Passwords**.

1.  In the WordPress admin, go to **Users > Your Profile**.
2.  Scroll down to "Application Passwords".
3.  Create a new password (e.g., "Airtable Sync").
4.  Copy the generated password (e.g., `abcd efgh ijkl mnop qrst uvwx`).
5.  In your Airtable Automation, create a Secret (e.g., `API-SYNC`) and store your credentials in the format `username:password` (e.g., `my_wp_admin_user:abcd efgh ijkl mnop qrst uvwx`).

## Logging & Debugging

*   **Enable WP_DEBUG:** To see detailed logs, set `WP_DEBUG` and `WP_DEBUG_LOG` to `true` in your `wp-config.php`.
*   **Log Location:** All server-side sync activity is logged to `wp-content/debug.log` with the prefix `[Four12 Quick Sync]`.
*   **What is Logged:** Successes, failures, warnings, ignored meta keys, reasons for skipping a field, and outcomes of third-party integrations.

##Relationships

# 1. The Core Principle: Orchestrator vs. Specialist

The success of this system hinges on a clear separation of concerns between two key files:

- **The Orchestrator (`module-base.php`):** This file is the "manager." It knows *what* needs to be done but not the low-level details of *how*. Its responsibilities are:
    - To parse the incoming API payload.
    - To identify that a relationship needs to be updated (by seeing the `jet_relation_series_parent` key).
    - To extract the necessary information (the child's ID and the parent's SKU).
    - To delegate the actual relationship work to a specialist.
- **The Specialist (`relations.php`):** This file is the "expert." It knows the specific, multi-step process of interacting with the JetEngine API. Its responsibilities are:
    - To accept high-level instructions (e.g., "link this child to this parent SKU").
    - To perform all the necessary lookups (finding the parent post by SKU).
    - To execute the precise, sequential commands required by the JetEngine API (`get_active_relations`, `set_update_context`, `update`).
    - To handle all API-specific logic, keeping the orchestrator clean.

This architecture ensures that if the JetEngine API ever changes, we only need to update the "specialist" (`relations.php`), leaving the "orchestrator" (`module-base.php`) untouched.

---

## 2. End-to-End Data Flow

Here is the step-by-step journey of a relationship sync from Airtable to the WordPress database:

1. **Airtable (`QuickSync Script`):** A JSON payload is constructed. The child post's SKU is the top-level `sku`, and the parent post's SKU is placed in an array within the `fields` object (e.g., `"jet_relation_series_parent": ["S0099"]`).
2. **WordPress (`f12-quick-sync.php`):** The main plugin file receives the POST request. It acts as a router, directing the request to the correct module handler based on the endpoint slug (e.g., `/sessions-sync` routes to `F12_Sessions_Sync_Module`).
3. **The Module (`modules/sessions-sync.php`):** This file provides the **configuration**. It tells the framework that the payload key `jet_relation_series_parent` corresponds to JetEngine `relation_id: 63` and that the parent lives in the `series` CPT.
4. **The Orchestrator (`module-base.php`):** The `handle_sync_request` method begins processing. After creating/updating the core post, it calls the `_process_jet_engine_relations` method. This method:
    - Finds the `jet_relation_series_parent` key in the payload.
    - Extracts the parent SKU (`S0099`).
    - Calls the high-level specialist function `f12_set_relation_parent_by_sku()`, passing it the child's ID, the parent's SKU, and the relation configuration.
5. **The Specialist (`relations.php`):** The `f12_set_relation_parent_by_sku()` function executes the core logic:
    - It uses the helper `f12_get_post_by_sku()` to find the parent post's ID (e.g., `326588`) from its SKU (`S0099`).
    - It gets the JetEngine relation object using `jet_engine()->relations->get_active_relations(63)`.
    - **CRITICAL STEP:** It calls `$rel->set_update_context('child')`. This tells JetEngine, "The action I'm about to perform is from the child's perspective. You should **replace** any existing parents for this child with the one I'm about to provide."
    - It calls `$rel->update(326588, 334333)`, passing the parent ID and child ID as single integers.
6. **The Database (`wp_postmeta`):** Because the "Register separate DB table" setting is OFF for this relation, JetEngine saves the link by creating/updating a row in the `wp_postmeta` table where `post_id` is the child's ID, `meta_key` is `jet_engine_relation_series_resources`, and `meta_value` is the parent's ID.

## 3. Component Breakdown

All of these pieces must work together:

- **`modules/sessions-sync.php` (The Configuration):** Defines the `jet_engine_relation_map`. Without this, the framework wouldn't know what to do with the `jet_relation_series_parent` payload key.
- **`module-base.php` (The Orchestrator):** The `_process_jet_engine_relations` method reads the configuration and delegates the task.
- **`relations.php` (The Specialist):** Contains the `f12_set_relation_parent_by_sku` function that knows how to talk to the JetEngine API.
- **`f12-quick-sync.php` (The Loader):** The `plugins_loaded` action hook at the bottom correctly checks for `function_exists('f12_set_relation_parent_by_sku')` before including `relations.php`. This ensures the specialist is available when the orchestrator needs it.
- **`core-helpers.php` (The Foundation):** Provides the essential `f12_get_post_by_sku()` function, which is critical for converting the parent's SKU into a usable WordPress Post ID.