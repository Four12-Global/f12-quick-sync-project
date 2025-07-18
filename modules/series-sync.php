<?php
/**
 * Quick Sync Module: Series CPT
 *
 * Provides the specific configuration for syncing the 'series' Custom Post Type.
 * It inherits all universal processing logic (Timezone, AIOSEO, etc.)
 * from the F12_Quick_Sync_Module_Base class.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly.
}

class F12_Series_Sync_Module extends F12_Quick_Sync_Module_Base {

    /**
     * Set up all configuration for the 'series' CPT.
     */
    protected function init() {
        // --- Core Configuration ---
        $this->cpt = 'series';
        $this->endpoint_slug = 'series-sync';
        $this->sku_meta_key = 'sku';

        // --- Field Mapping ---
        $this->core_field_map = [
            'post_title'   => 'post_title',
            'post_name'    => 'post_name',
            'post_excerpt' => 'post_excerpt',
            'post_date'    => 'post_date',
            'post_status'  => 'post_status',
        ];

        $this->taxonomy_map = [
            'global-categories' => 'global-categories',
            'series-categories' => 'series-categories',
            'topics'            => 'topics',
            'series-templates'  => 'series-templates',
        ];

        $this->image_meta_map = [
            '_thumbnail_id',
            'listing-image',
            'no-words-image',
            'banner-image',
            'manual1-image',
        ];

        $this->post_content_key = 'series-description';
        $this->duplicate_post_content_to_meta = true;
    }

    // No other methods are needed here. The timezone and AIOSEO logic
    // are now handled automatically by the base class.
}