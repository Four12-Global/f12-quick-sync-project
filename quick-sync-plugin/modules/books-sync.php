<?php
/**
 * Quick Sync Module: Books CPT
 *
 * Provides the specific configuration for syncing the 'books' Custom Post Type.
 * It inherits all universal processing logic (post lookup, media sideloading,
 * AIOSEO integration, etc.) from the F12_Quick_Sync_Module_Base class.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly.
}

class F12_Books_Sync_Module extends F12_Quick_Sync_Module_Base {

    /**
     * Set up all configuration for the 'books' CPT.
     * This function maps the incoming payload from the Airtable script to the correct
     * WordPress fields, taxonomies, and meta keys.
     */
    protected function init() {
        // --- 1. Core Configuration ---
        // Defines the CPT slug, the API endpoint, and the SKU meta key.
        $this->cpt = 'books'; // The slug for your "Books" Custom Post Type in WordPress.
        $this->endpoint_slug = 'books-sync'; // Must match the endpoint in books-sync.ts.
        $this->sku_meta_key = 'sku'; // The meta key used to store the unique SKU.

        // --- 2. Core Field Mapping ---
        // Maps payload keys to core WordPress post fields (in the wp_posts table).
        $this->core_field_map = [
            'post_title'   => 'post_title',
            'post_name'    => 'post_name',
            'post_excerpt' => 'post_excerpt',
            'post_status'  => 'post_status',
            'post_date'    => 'post_date',
        ];

        // --- 3. Taxonomy Mapping ---
        // Maps a payload key to a WordPress taxonomy slug. The base class
        // will automatically find or create the terms and assign them to the post.
        $this->taxonomy_map = [
            // Payload Key      => WordPress Taxonomy Slug
            'global-categories' => 'global-categories',
            'topics'            => 'topics',
            'author'            => 'author_speaker', // Assumes you have a custom 'author' taxonomy.
        ];

        // --- 4. Image/Media Meta Mapping ---
        // Lists meta keys that correspond to media. If the payload for one of these
        // keys contains a URL instead of a WP Media ID, the base class will
        // automatically download the file and save the new attachment ID.
        $this->image_meta_map = [
            '_thumbnail_id', // The featured image.
            'pdf-image-1',   // The custom image for the PDF link.
        ];

        // --- 5. Markdown Mapping (Optional but Recommended) ---
        // Tells the base class to treat the incoming 'post_content' field as
        // Markdown, convert it to safe HTML, and save it to the post's content.
        $this->markdown_map = [
            // Payload Key    => Destination(s) in WordPress
            'post_content' => ['post_content'],
        ];
        
        // --- NO NEED TO LIST OTHER META FIELDS ---
        // All other fields from your payload (like 'tag-line', 'link_five',
        // 'version-1-title', etc.) will be automatically saved as post meta
        // by the base class. You do not need to declare them here.
    }

    // No other methods are needed. The F12_Quick_Sync_Module_Base handles everything else.
}