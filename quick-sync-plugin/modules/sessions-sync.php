<?php
/**
 * Quick Sync Module: Sessions CPT
 *
 * Provides the specific configuration for syncing the 'sessions' Custom Post Type.
 * It inherits all universal processing logic (Timezone, AIOSEO, etc.)
 * from the F12_Quick_Sync_Module_Base class.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly.
}

class F12_Sessions_Sync_Module extends F12_Quick_Sync_Module_Base {

    /**
     * Set up all configuration for the 'sessions' CPT.
     */
    protected function init() {
        // --- Core Configuration ---
        $this->cpt = 'resources';
        $this->endpoint_slug = 'sessions-sync';
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
            'author-speaker'    => 'author_speaker',
        ];

        $this->image_meta_map = [
            '_thumbnail_id',
            'listing-image',
            'no-words-image',
            'banner-image',
            'manual1-image',
        ];

        // ── JetEngine: Series (parent) ⇢ Sessions (child) ──
        $this->jet_engine_relation_map = [
            'jet_relation_series_parent' => [
                'relation_id'      => 63,
                'parent_cpt'       => 'series',
                'parent_sku_meta'  => 'sku',
                // no 'mode' key — helper is hard-coded to replace
            ],
        ];

        // Markdown mapping configuration
        $this->markdown_map = [
            'session_description_admin' => ['post_content']
        ];

    }

}