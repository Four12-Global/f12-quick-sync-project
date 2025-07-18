<?php
/**
 * Quick Sync Module: Author/Speaker Taxonomy (Production Ready)
 *
 * This module syncs data from Airtable to the 'author_speaker' WordPress taxonomy.
 *
 * Features:
 * - Implements a "whitelist" for meta fields to ensure data integrity and prevent database pollution.
 * - Unknown meta keys from the payload are logged and ignored, not stored.
 * - Restores the robust `wp_id` -> `SKU` -> `slug` lookup chain for de-duplication.
 * - Only deletes meta on explicit `null` values to prevent accidental data loss.
 * - Integrates Parsedown to convert Markdown bios to safe HTML.
 * - Provides detailed logging and includes warnings in the API response for ignored fields.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly.
}

class F12_Author_Speaker_Sync_Module {

    // --- Configuration ---
    private $endpoint_slug = 'author-sync';
    private $taxonomy = 'author_speaker';
    private $sku_meta_key = 'sku';

    /**
     * @var array A whitelist of meta keys allowed to be synced from the payload.
     * All other meta keys will be logged as a warning and ignored.
     */
    private $allowed_meta_keys = [
        'profile_image',
        'status',
        // Add other known, valid meta keys here as your schema evolves.
        // e.g., 'author_twitter_handle', 'author_linkedin_url'
    ];
    
    /**
     * Public getter for the main plugin router.
     * @return string The slug for the REST API endpoint (e.g., 'author-sync').
     */
    public function get_endpoint_slug() {
        return $this->endpoint_slug;
    }

    /**
     * Public getter for the main plugin router to define API arguments.
     * @return array Standard argument definitions for the REST endpoint.
     */
    public function get_rest_api_args() {
        return [
            'sku' => [
                'type'              => 'string',
                'required'          => true,
                'sanitize_callback' => 'sanitize_text_field',
                'description'       => 'Unique identifier (SKU) for the Author/Speaker term.',
            ],
            'fields' => [
                'type'              => 'object',
                'required'          => true,
                'description'       => 'Object containing all term data fields.',
            ],
            'wp_id' => [
                'type'              => 'integer',
                'required'          => false,
                'sanitize_callback' => 'absint',
                'description'       => 'WordPress Term ID for fast-path updates.',
            ],
            'airtableRecordId' => [
                'type'              => 'string',
                'required'          => false,
                'sanitize_callback' => 'sanitize_text_field',
                'description'       => 'Optional Airtable Record ID for logging.',
            ],
        ];
    }
    
    /**
     * The main handler for the sync request.
     */
    public function handle_sync_request( WP_REST_Request $request ) {
        $json_params = $request->get_json_params();

        // --- 1. Validate Payload ---
        $sku = isset( $json_params['sku'] ) ? sanitize_text_field( $json_params['sku'] ) : null;
        $payload = isset( $json_params['fields'] ) ? (array) $json_params['fields'] : null;
        $wp_id = isset( $json_params['wp_id'] ) ? absint( $json_params['wp_id'] ) : 0;
        
        if ( empty($sku) || empty($payload) || empty($payload['name']) ) {
             return new WP_Error('f12_invalid_author_payload', 'Request requires a top-level SKU and a fields object containing at least a "name".', ['status' => 400]);
        }
        
        // --- 2. Find Existing Term ---
        $existing_term = $this->find_existing_term($sku, $payload, $wp_id);
        $mode = $existing_term ? 'update' : 'create';
        
        // --- 3. Prepare Core Term Data ---
        $name = sanitize_text_field($payload['name']);
        $slug = isset($payload['slug']) ? sanitize_title($payload['slug']) : sanitize_title($name);
        $description = '';
        
        // Use Parsedown for the primary description field if it exists
        if (isset($payload['as_description']) && is_string($payload['as_description']) && class_exists('Parsedown')) {
            $description = wp_kses_post(Parsedown::instance()->setSafeMode(true)->text($payload['as_description']));
        }
        
        $term_data = [
            'name'        => $name,
            'slug'        => $slug,
            'description' => $description,
        ];

        // --- 4. Create or Update Term ---
        if ('update' === $mode) {
            $result = wp_update_term($existing_term->term_id, $this->taxonomy, $term_data);
            $term_id = is_wp_error($result) ? 0 : $existing_term->term_id;
        } else {
            $result = wp_insert_term($name, $this->taxonomy, $term_data);
            $term_id = is_wp_error($result) ? 0 : (int) $result['term_id'];
        }

        if (is_wp_error($result) || $term_id === 0) {
            $error_message = is_wp_error($result) ? $result->get_error_message() : 'Term could not be created or updated.';
            return new WP_Error('f12_term_save_failed', $error_message, ['status' => 500]);
        }

        // --- 5. Process Meta Fields (using the Whitelist approach) ---
        $this->process_meta_fields($term_id, $sku, $payload, $ignored_keys_for_response);
        
        // --- 6. Return Success Response ---
        $response_data = [
            'term_id' => $term_id,
            'action'  => $mode,
            'sku'     => $sku,
            'message' => sprintf('Author/Speaker term (ID: %d) %s successfully.', $term_id, $mode),
        ];

        if (!empty($ignored_keys_for_response)) {
            $response_data['warnings'] = [
                'ignored_meta_keys' => array_unique($ignored_keys_for_response)
            ];
        }

        return rest_ensure_response($response_data);
    }
    
    /**
     * Finds an existing term using the robust `wp_id` -> `SKU` -> `slug` lookup chain.
     *
     * @param string $sku The unique SKU for the term.
     * @param array $payload The incoming fields payload, used to get the slug.
     * @param int $wp_id The WordPress Term ID, if provided.
     * @return WP_Term|null The found term object or null.
     */
    private function find_existing_term($sku, $payload, $wp_id) {
        // 1. Fast-path: Check provided Term ID first.
        if ($wp_id > 0) {
            $term = get_term($wp_id, $this->taxonomy);
            if ($term && !is_wp_error($term) && get_term_meta($term->term_id, $this->sku_meta_key, true) === $sku) {
                f12_sync_log(sprintf('[AuthorSync] Term found via fast-path wp_id: %d', $wp_id));
                return $term;
            }
        }
        
        // 2. Primary lookup: Find by SKU meta key.
        $terms = get_terms([
            'taxonomy'   => $this->taxonomy,
            'hide_empty' => false,
            'number'     => 1,
            'meta_query' => [['key' => $this->sku_meta_key, 'value' => $sku]],
        ]);
        if (!empty($terms) && !is_wp_error($terms)) {
            f12_sync_log(sprintf('[AuthorSync] Term found via SKU meta: %s', $sku));
            return $terms[0];
        }
        
        // 3. Fallback: Find by slug (for claiming manually created terms).
        $slug_to_check = isset($payload['slug']) ? $payload['slug'] : (isset($payload['name']) ? $payload['name'] : '');
        if (!empty($slug_to_check)) {
            $slug = sanitize_title($slug_to_check);
            $term = get_term_by('slug', $slug, $this->taxonomy);
            if ($term && !is_wp_error($term)) {
                $existing_sku = get_term_meta($term->term_id, $this->sku_meta_key, true);
                if (empty($existing_sku)) {
                    f12_sync_log(sprintf('[AuthorSync] Term found via SLUG FALLBACK: %s. Claiming it for SKU %s.', $slug, $sku));
                    return $term;
                }
            }
        }
        
        return null; // Term not found
    }

    /**
     * Safely processes meta fields based on the whitelist.
     *
     * @param int $term_id The ID of the term to update.
     * @param string $sku The SKU of the term, for special handling.
     * @param array $payload The incoming fields payload.
     * @param array &$ignored_keys_for_response A reference to an array to store warnings.
     */
    private function process_meta_fields($term_id, $sku, $payload, &$ignored_keys_for_response = []) {
        // Always ensure the SKU meta is set correctly.
        update_term_meta($term_id, $this->sku_meta_key, $sku);
        
        // These keys were handled as core properties and should not be processed as meta.
        $handled_core_keys = ['name', 'slug', 'as_description'];
        
        foreach ($payload as $meta_key => $meta_value) {
            // Skip keys that are core properties or the SKU itself.
            if (in_array($meta_key, $handled_core_keys, true) || $meta_key === $this->sku_meta_key) {
                continue;
            }

            $meta_key_sanitized = sanitize_key($meta_key);

            // --- THE WHITELIST GATE ---
            if (!in_array($meta_key_sanitized, $this->allowed_meta_keys, true)) {
                f12_sync_log(sprintf('[AuthorSync] Ignored unknown meta key "%s" for term ID %d. Not in allowed list.', $meta_key_sanitized, $term_id));
                $ignored_keys_for_response[] = $meta_key_sanitized;
                continue; // Skip rogue key
            }

            // --- SAFE META HANDLING (for whitelisted keys only) ---
            if ($meta_value === null) {
                // Explicitly delete meta if the payload sends null.
                delete_term_meta($term_id, $meta_key_sanitized);
                f12_sync_log(sprintf('[AuthorSync] Deleted meta key "%s" for term ID %d due to null value.', $meta_key_sanitized, $term_id));
            } else {
                // Update meta for any other value.
                update_term_meta($term_id, $meta_key_sanitized, $meta_value);
            }
        }
    }
}