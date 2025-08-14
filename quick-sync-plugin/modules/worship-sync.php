<?php
/**
 * Quick Sync Module: Worship CPT
 *
 * Provides the specific configuration for syncing the 'worship' Custom Post Type.
 * It inherits all universal processing logic (post lookup, image handling, etc.)
 * from the F12_Quick_Sync_Module_Base class.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly.
}

class F12_Worship_Sync_Module extends F12_Quick_Sync_Module_Base {

    /**
     * Set up all configuration for the 'worship' CPT.
     * This function maps the incoming payload from Airtable to the correct
     * WordPress fields, taxonomies, and meta keys.
     */
    protected function init() {
        // --- 1. Core Configuration ---
        // Defines the CPT slug, the API endpoint, and the SKU meta key.
        $this->cpt = 'songs';
        $this->endpoint_slug = 'worship-sync';
        $this->sku_meta_key = 'sku'; // Convention: CPT_sku

        // --- 2. Core Field Mapping ---
        // Maps payload keys to core WordPress post fields (wp_posts table).
        $this->core_field_map = [
            'post_title'   => 'post_title',
            'post_name'    => 'post_name',
            'post_excerpt' => 'post_excerpt',
            'post_date'    => 'post_date',
            'post_status'  => 'post_status',
        ];

        // --- 3. Taxonomy Mapping ---
        // Maps a payload key to a WordPress taxonomy slug. The base class
        // will automatically create/assign the terms.
        $this->taxonomy_map = [
            'worship_artist' => 'worship-artist',
            'topics' => 'topics',
            'global-categories' => 'global-categories',
        ];

        // --- 4. Image/Media Meta Mapping ---
        // Lists payload keys that correspond to media. The base class uses this
        // for its URL-sideloading fallback. The primary path (sending a WP ID)
        // is handled by the generic meta processor.
        $this->image_meta_map = [
            '_thumbnail_id',     // The featured image.
            'chord_sheet_pdf',   // The chord sheet PDF.
        ];

        // This CPT does not use markdown or post_content processing.
        
        // Note: The simple meta fields from your Airtable script (`apple_music_link`, 
        // `spotify_link`, `youtube_music_link`, and `chord_sheet_pdf`) do not need
        // to be explicitly defined here. The base class's `_process_meta_fields` 
        // method will automatically handle any remaining keys in the payload and
        // save them as post meta.
    }

    // No other methods are needed. The F12_Quick_Sync_Module_Base handles everything else.
}