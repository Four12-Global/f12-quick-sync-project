<?php
/**
 * Quick Sync Module: Leaders CPT (f12-leaders)
 *
 * Provides the specific configuration for syncing the 'f12-leaders' Custom Post Type.
 * This module includes special handling to parse a Markdown description into HTML.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly.
}

class F12_Leader_Sync_Module extends F12_Quick_Sync_Module_Base {

    /**
     * Set up all configuration for the 'f12-leaders' CPT.
     */
    protected function init() {
        // --- 1. Core Configuration ---
        $this->cpt = 'f12-leaders';
        $this->endpoint_slug = 'leader-sync';
        $this->sku_meta_key = 'leader_sku';

        // --- 2. Field Mapping (Payload Key => WP Destination) ---
        $this->core_field_map = [
            'post_title'   => 'post_title',
            'post_excerpt' => 'post_excerpt', // Airtable 'leader_description' is mapped here.
        ];

        $this->taxonomy_map = [
            'leadership-role' => 'leadership-role',
        ];

        $this->image_meta_map = [
            '_thumbnail_id',
        ];

        $this->post_content_key = null;
    }

    /**
     * Override the special meta processing hook to handle Markdown conversion.
     */
    protected function _process_special_meta_fields( $post_id, &$payload, $sku, &$changed_summary ) {
        // Check if the 'leader_description' field exists in the payload.
        if ( array_key_exists( 'leader_description', $payload ) ) {
            
            $raw_markdown = $payload['leader_description'];
            $html_output = '';

            // Ensure Parsedown is available and the value is a non-empty string.
            if ( class_exists('Parsedown') && is_string($raw_markdown) && !empty($raw_markdown) ) {
                // Convert Markdown to safe HTML.
                $html_output = wp_kses_post( Parsedown::instance()->setSafeMode(true)->text($raw_markdown) );
                f12_sync_log(sprintf('[LeaderSync] Parsed Markdown for leader_description on post ID %d.', $post_id));
            } else {
                // If it's not a string or Parsedown is missing, just sanitize it.
                $html_output = is_string($raw_markdown) ? wp_kses_post($raw_markdown) : '';
            }

            // Update the meta field with the processed HTML.
            update_post_meta($post_id, 'leader_description', $html_output);

            // IMPORTANT: Unset the key from the payload so the base class
            // doesn't process it a second time as a generic meta field.
            unset($payload['leader_description']);

            // Log the change for the response summary.
            if ( ! in_array( 'leader_description (Markdown parsed)', $changed_summary['special'] ) ) {
                $changed_summary['special'][] = 'leader_description (Markdown parsed)';
            }
        }
    }
}