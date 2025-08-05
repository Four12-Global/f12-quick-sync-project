<?php
use AIOSEO\Plugin\Common\Models\Post as AioseoPost;

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly.
}

abstract class F12_Quick_Sync_Module_Base {

    // --- Configuration to be set by child modules ---
    protected $cpt;
    protected $endpoint_slug;
    protected $sku_meta_key;
    protected $core_field_map = [];
    protected $taxonomy_map = [];
    protected $image_meta_map = [];
    protected $post_content_key;
    protected $allowed_post_statuses = ['publish', 'draft', 'trash', 'private'];
    protected bool $duplicate_post_content_to_meta = false;
    
    /** @var array  Key = payload field, value = relation config */
    protected $jet_engine_relation_map = [];

    /**
     * Constructor to set up module-specific hooks.
     */
    public function __construct() {
        // Make JetEngine honour the site timezone for every datetime meta.
        add_filter( 'jet-engine/datetime/use-wp-date', '__return_true', 10, 2 );
        $this->init();
    }

    /**
     * Abstract init method for child classes to set properties and add hooks.
     */
    abstract protected function init();

    /**
     * Get the endpoint slug for the router.
     * @return string
     */
    public function get_endpoint_slug() {
        return $this->endpoint_slug;
    }

    /**
     * Define the expected REST API arguments.
     * @return array
     */
    public function get_rest_api_args() {
        return [
            'sku' => [
                'type'              => 'string',
                'required'          => true,
                'sanitize_callback' => 'sanitize_text_field',
                'description'       => esc_html__( 'Unique identifier for the item. Used for de-duplication.', 'f12-quick-sync' ),
            ],
            'fields' => [
                'type'              => 'object',
                'required'          => true,
                'description'       => esc_html__( 'Object containing item data fields to be synced.', 'f12-quick-sync' ),
            ],
            'airtableRecordId' => [
                'type'              => 'string',
                'required'          => false,
                'sanitize_callback' => 'sanitize_text_field',
                'description'       => esc_html__( 'Optional Airtable Record ID for logging and reference.', 'f12-quick-sync' ),
            ],
            'wp_id' => [
                'type'              => 'integer',
                'required'          => false,
                'sanitize_callback' => 'absint',
                'description'       => esc_html__( 'Optional WordPress Post/Term ID. If provided, used for a fast-path update.', 'f12-quick-sync' ),
            ],
        ];
    }

    /**
     * The main handler for the REST request.
     * This is the refactored logic from the original plugin.
     */
    public function handle_sync_request( WP_REST_Request $request ) {
        $json_params = $request->get_json_params();
    
        if ( null === $json_params ) {
            return new WP_Error( 'f12_bad_json', __( 'Invalid JSON body or Content-Type not application/json.', 'f12-quick-sync' ), [ 'status' => 400 ] );
        }
    
        $sku                 = isset( $json_params['sku'] ) ? sanitize_text_field( $json_params['sku'] ) : null;
        $fields_from_payload = isset( $json_params['fields'] ) ? $json_params['fields'] : null;
        $wp_id               = isset( $json_params['wp_id'] ) ? absint( $json_params['wp_id'] ) : 0;
        
        if ( empty( $sku ) ) {
            return new WP_Error( 'f12_missing_sku', __( 'Required top-level "sku" parameter is missing from JSON body.', 'f12-quick-sync' ), [ 'status' => 400 ] );
        }
        if ( empty( $fields_from_payload ) || ! is_array( $fields_from_payload ) ) {
            return new WP_Error( 'f12_invalid_fields', __( 'Required "fields" parameter is missing or not an object in JSON body.', 'f12-quick-sync' ), [ 'status' => 400 ] );
        }
        
        $payload = $fields_from_payload; // No more apply_filters here
        $changed_summary = [ 'core' => [], 'meta' => [], 'taxonomy' => [], 'permalink' => [], 'special' => [] ];
    
        
        // Leave last_synced untouched; JetEngine will translate this UTC timestamp to local time when displaying.

        // ---- Find existing post ----
        $post = null;
        $mode = null;
    
        if ( $wp_id > 0 ) {
            $potential_post = get_post( $wp_id );
            if ( $potential_post && $potential_post->post_type === $this->cpt ) {
                $existing_sku = get_post_meta( $potential_post->ID, $this->sku_meta_key, true );
                // This is the key change: Allow a match if the existing SKU is empty (so we can claim it) or if the SKUs match.
                if ( empty($existing_sku) || $existing_sku === $sku ) {
                    $post = $potential_post;
                    $mode = 'update';
                    if (empty($existing_sku)) {
                        f12_sync_log( sprintf( 'Post found via wp_id %d and CLAIMED for SKU %s (was previously empty).', $post->ID, esc_html( $sku ) ) );
                    } else {
                        f12_sync_log( sprintf( 'Post found via fast-path wp_id: %d for CPT %s (SKU: %s)', $post->ID, $this->cpt, esc_html( $sku ) ) );
                    }
                } else {
                     f12_sync_log( sprintf( 'wp_id %d provided, but its SKU ("%s") does not match payload SKU ("%s"). Falling back to SKU lookup.', $wp_id, esc_html($existing_sku), esc_html( $sku ) ) );
                }
            } else {
                f12_sync_log( sprintf( 'wp_id %d provided, but post not found or is wrong CPT. Falling back to SKU lookup.', $wp_id ) );
            }
        }
    
        if ( ! $mode ) {
            $post = f12_get_post_by_sku( $sku, $this->cpt, $this->sku_meta_key );
            $mode = $post ? 'update' : 'create';
        }
    
        $post_id = ( 'update' === $mode && $post ) ? $post->ID : 0;
        
        // ---- Process and Save ----
        $post_data = $this->_prepare_core_data( $payload, $sku, $changed_summary );
        
        $post_id_after_save = $this->_save_core_post( $post_id, $mode, $post_data, $sku );
    
        if ( is_wp_error( $post_id_after_save ) ) {
            f12_sync_log( 'Error saving post (core fields) for SKU: ' . esc_html( $sku ) . '. Mode: ' . $mode . '. Error: ' . $post_id_after_save->get_error_message() );
            return $post_id_after_save;
        }
        $post_id = (int) $post_id_after_save;
    
        // Process remaining fields
                $this->_process_permalink( $post_id, $payload, $sku, $changed_summary );
        $this->_process_taxonomies( $post_id, $payload, $sku, $changed_summary );
        $this->_process_special_fields( $post_id, $payload, $sku, $changed_summary ); // This now handles AIOSEO universally
        $this->_process_jet_engine_relations( $post_id, $payload, $sku, $changed_summary );
        $this->_process_meta_fields( $post_id, $payload, $sku, $changed_summary );

        // ---- Prepare and return response ----
        $action = ( 'create' === $mode ) ? 'created' : 'updated';
        // Retrieve the post title for the response
        $post_obj = get_post( $post_id );
        $post_title = $post_obj ? $post_obj->post_title : '';
        $response_data = [
            'post_id'    => $post_id,
            'action'     => $action,
            'sku'        => $sku,
            'post_title' => $post_title,
            'message'    => sprintf(
                "%s '%s' successfully %s.",
                ucfirst( $this->cpt ),        // “Series”
                esc_html( $post_title ),      // “Regional Equip Gauteng”
                $action                       // “updated” (or “created” etc)
            ),
        ];
    
        return rest_ensure_response( $response_data );
    }


    /**
     * Prepares the $post_data array for wp_insert/update_post.
     */
    protected function _prepare_core_data( &$payload, $sku, &$changed_summary ) {
        $post_data = [ 'post_type' => $this->cpt ];
        $post_data['post_status'] = 'publish'; // Default

        // Standard core fields
        foreach ( $this->core_field_map as $payload_key => $wp_post_field_key ) {
            if ( array_key_exists( $payload_key, $payload ) ) {

                // Short-circuit the native slug update if a custom permalink is being used.
                if ( $wp_post_field_key === 'post_name' && isset($payload['custom_permalink_uri']) && !empty(trim($payload['custom_permalink_uri'])) && class_exists('Permalink_Manager_URI_Functions') ) {
                    f12_sync_log(sprintf('Core Field Processing: Skipping direct update of native "post_name" because "custom_permalink_uri" is provided for Permalink Manager. (SKU: %s)', esc_html($sku)));
                    if (!in_array('custom_permalink_uri', $changed_summary['permalink'])) {
                        $changed_summary['permalink'][] = 'custom_permalink_uri'; // Log permalink change intent
                    }
                    unset( $payload[ $payload_key ] ); // Remove post_name from further processing
                    continue; // Skip to the next field in the loop
                }

                $value = $payload[ $payload_key ];

                if ( 'post_date' === $wp_post_field_key && ! empty( $value ) ) {
                    // --- parse incoming string ---------------------------------------------
                    $dt_local = new DateTime( $value );          // honours the “Z” (UTC)
                    // 🚨 ALWAYS convert to site timezone – no conditions
                    $dt_local->setTimezone( wp_timezone() );     // now site time

                    $post_data['post_date']      = f12qs_mysql_local( $dt_local );
                    $post_data['post_date_gmt']  = f12qs_mysql_gmt(   $dt_local );
                } elseif ( 'post_status' === $wp_post_field_key ) {
                    if ( !empty($value) && is_string($value) && in_array( strtolower( $value ), $this->allowed_post_statuses, true ) ) {
                        $post_data[ $wp_post_field_key ] = strtolower( $value );
                    }
                } else {
                    $post_data[ $wp_post_field_key ] = $value;
                }
                
                if ( ! in_array( $payload_key, $changed_summary['core'] ) ) $changed_summary['core'][] = $payload_key;
                unset( $payload[ $payload_key ] );
            }
        }
        
        // Post content
        if ( $this->post_content_key && array_key_exists( $this->post_content_key, $payload ) ) {
            $value = $payload[ $this->post_content_key ];
            $post_data['post_content'] = $value;

            if ( ! in_array( 'post_content (from ' . $this->post_content_key . ')', $changed_summary['special'] ) ) {
                $changed_summary['special'][] = 'post_content (from ' . $this->post_content_key . ')';
            }

            // Keep or discard the key depending on module preference
            if ( ! $this->duplicate_post_content_to_meta ) {
                unset( $payload[ $this->post_content_key ] );
            }
        }

        // If neither post_date nor post_date_gmt set above, default to now.
        if ( empty( $post_data['post_date'] ) ) {
            $now_local = f12qs_now();
            $post_data['post_date']     = f12qs_mysql_local( $now_local );
            $post_data['post_date_gmt'] = f12qs_mysql_gmt(   $now_local );
        }

        return $post_data;
    }

    /**
     * Saves the core post data.
     */
    protected function _save_core_post( $post_id, $mode, $post_data, $sku ) {
        if ( 'create' === $mode ) {
            return wp_insert_post( $post_data, true );
        } else {
            $post_data['ID'] = $post_id;
            return wp_update_post( $post_data, true );
        }
    }

    /**
     * Handles custom permalink integration.
     */
    protected function _process_permalink( $post_id, &$payload, $sku, &$changed_summary ) {
        if ( ! class_exists('Permalink_Manager_URI_Functions') || ! isset($payload['custom_permalink_uri']) ) {
            return;
        }

        $custom_uri = trim($payload['custom_permalink_uri']);
        if ( !empty($custom_uri) ) {
            $new_uri = ltrim($custom_uri, '/');
            if (substr($new_uri, -1) !== '/') $new_uri .= '/';

            if ($new_uri !== '/') {
                $save_result = Permalink_Manager_URI_Functions::save_single_uri($post_id, $new_uri, false, true);
                if ($save_result === true || $save_result === 1) {
                    f12_sync_log(sprintf('Permalink Manager: Success for post ID %d, URI "%s" (SKU: %s)', $post_id, esc_html($new_uri), esc_html($sku)));
                    if (!in_array('custom_permalink_uri', $changed_summary['permalink'])) $changed_summary['permalink'][] = 'custom_permalink_uri';
                }
            }
        }
        unset($payload['custom_permalink_uri']);

        // Prevent native post_name from being processed if a custom permalink was handled.
        if (isset($this->core_field_map['post_name'])) {
            unset($payload['post_name']);
        }
    }

    /**
     * Handles all taxonomy assignments.
     */
    protected function _process_taxonomies( $post_id, &$payload, $sku, &$changed_summary ) {
        foreach ( $this->taxonomy_map as $payload_key => $taxonomy_slug ) {
            if ( ! array_key_exists( $payload_key, $payload ) ) continue;

            $raw_term_values = $payload[ $payload_key ];
            
            if ( $raw_term_values === null || $raw_term_values === '' ) {
                wp_set_post_terms( $post_id, [], $taxonomy_slug, false );
                if ( ! in_array( $payload_key, $changed_summary['taxonomy'] ) ) $changed_summary['taxonomy'][] = $payload_key;
                unset( $payload[ $payload_key ] );
                continue;
            }

            // ... [Identical hierarchy logic from original file] ...
            $term_input_sets = [];
            $temp_term_list = is_array($raw_term_values) ? array_map('strval', $raw_term_values) : array_map('trim', explode(',', $raw_term_values));

            foreach( $temp_term_list as $term_entry_str ) {
                $term_entry_str = trim($term_entry_str);
                if (empty($term_entry_str)) continue;
                if (strpos($term_entry_str, '>') !== false) {
                    $term_input_sets[] = array_map('trim', explode('>', $term_entry_str));
                } else {
                    $term_input_sets[] = [$term_entry_str];
                }
            }

            $term_ids_to_set = [];
            if ( ! empty( $term_input_sets ) ) {
                foreach ($term_input_sets as $hierarchical_term_parts) {
                    $parent_id = 0;
                    foreach ($hierarchical_term_parts as $term_part_name) {
                        $term = term_exists( $term_part_name, $taxonomy_slug, $parent_id );
                        if ( ! $term ) $term = term_exists( sanitize_title( $term_part_name ), $taxonomy_slug, $parent_id );
                        
                        $term_id = 0;
                        if ( ! $term ) {
                            $insert_args = ($parent_id > 0 && is_taxonomy_hierarchical($taxonomy_slug)) ? ['parent' => $parent_id] : [];
                            $new_term = wp_insert_term( $term_part_name, $taxonomy_slug, $insert_args );
                            if ( is_wp_error( $new_term ) ) {
                                f12_sync_log( 'Could not create term "' . $term_part_name . '": ' . $new_term->get_error_message() );
                                break; 
                            }
                            $term_id = (int) $new_term['term_id'];
                        } else {
                            $term_id = (int) $term['term_id'];
                        }
                        
                        if ($term_id > 0) {
                            $term_ids_to_set[] = $term_id;
                            $parent_id = $term_id;
                        } else {
                            break;
                        }
                    }
                }
            }

            $term_ids_to_set = array_unique(array_filter($term_ids_to_set));
            $term_result = wp_set_post_terms( $post_id, $term_ids_to_set, $taxonomy_slug, false );

            if (!is_wp_error($term_result)) {
                 if ( ! in_array( $payload_key, $changed_summary['taxonomy'] ) ) $changed_summary['taxonomy'][] = $payload_key;
            }
            unset( $payload[ $payload_key ] );
        }
    }
    
    /**
     * Processes special, universally handled fields like AIOSEO.
     */
    protected function _process_special_fields( $post_id, &$payload, $sku, &$changed_summary ) {
        // --- AIOSEO Description Handling (Universal) ---
        // Automatically process if the conventional payload key exists.
        if ( isset( $payload['_aioseo_description'] ) ) {
            
            $raw_desc = sanitize_textarea_field( $payload['_aioseo_description'] );
            
            if ( function_exists( 'aioseo' ) && class_exists( AioseoPost::class ) ) {
                try {
                    $seoPost = AioseoPost::getPost( (int) $post_id ) ?: AioseoPost::create( [ 'post_id' => (int) $post_id ] );
                    $seoPost->description = $raw_desc;
                    method_exists( $seoPost, 'save' ) ? $seoPost->save() : $seoPost->savePost();
                    f12_sync_log( "AIOSEO: description saved via model for post {$post_id}" );
                } catch ( Throwable $e ) {
                    f12_sync_log( 'AIOSEO ERROR: ' . $e->getMessage() . ' - falling back to update_post_meta' );
                    update_post_meta( $post_id, '_aioseo_description', $raw_desc );
                }
            } else {
                // Fallback if AIOSEO is not active
                update_post_meta( $post_id, '_aioseo_description', $raw_desc );
            }

            if ( ! in_array( '_aioseo_description (AIOSEO)', $changed_summary['special'] ) ) {
                $changed_summary['special'][] = '_aioseo_description (AIOSEO)';
            }
            // Unset the key so it's not processed again in the generic meta loop.
            unset( $payload['_aioseo_description'] );
        }
    }

    /**
     * Hook for child modules to perform special meta field processing.
     * This method is called before the generic meta loop.
     * Child classes should unset any keys they handle to prevent double processing.
     */
    protected function _process_special_meta_fields( $post_id, &$payload, $sku, &$changed_summary ) {
        // Child modules can override this.
    }

    /**
     * Handles all remaining fields as post meta, including image sideloading.
     */
    protected function _process_meta_fields( $post_id, &$payload, $sku, &$changed_summary ) {
        // Always ensure SKU meta is correct
        if ( get_post_meta( $post_id, $this->sku_meta_key, true ) !== $sku ) {
            update_post_meta( $post_id, $this->sku_meta_key, $sku );
        }
        unset($payload[$this->sku_meta_key]);

        // --- Call the hook for special handling ---
        $this->_process_special_meta_fields( $post_id, $payload, $sku, $changed_summary );
        // ---------------------------------------------

        foreach ( $payload as $meta_key => $meta_value ) {
            $meta_key_sanitized = sanitize_key( $meta_key );
            $processed_meta_value = $meta_value;

            // JetEngine last_synced field: always use UTC timestamp
            if ($meta_key_sanitized === 'last_synced') {
                if ($meta_value instanceof DateTime) {
                    $processed_meta_value = f12qs_unix_utc($meta_value);
                } elseif (is_numeric($meta_value)) {
                    // Assume already a timestamp, but cast to int
                    $processed_meta_value = (int)$meta_value;
                } elseif (is_string($meta_value)) {
                    // Try to parse as date string
                    $dt = new DateTime($meta_value, wp_timezone());
                    $processed_meta_value = f12qs_unix_utc($dt);
                }
            }

            // Image handling
            if ( in_array( $meta_key, $this->image_meta_map, true ) ) {
                if ( is_string( $meta_value ) && filter_var( $meta_value, FILTER_VALIDATE_URL ) ) {
                    $image_desc = get_the_title( $post_id ) ?: $sku;
                    $attachment_id = f12_sideload_image_from_url( $meta_value, $post_id, $image_desc );
                    if ( ! is_wp_error( $attachment_id ) && $attachment_id > 0 ) {
                        $processed_meta_value = $attachment_id;
                        f12_sync_log(sprintf('Image Sideload Success for "%s". New ID: %d (SKU: %s)', $meta_key, $attachment_id, esc_html($sku)));
                    } else {
                        f12_sync_log(sprintf('Image Sideload Failed for "%s". Error: %s (SKU: %s)', $meta_key, is_wp_error($attachment_id) ? $attachment_id->get_error_message() : 'Unknown', esc_html($sku)));
                        continue; // Skip updating meta on failure
                    }
                }
            }

            // Featured Image special handling
            if ($meta_key_sanitized === '_thumbnail_id') {
                if ( !empty($processed_meta_value) && (int) $processed_meta_value > 0 ) {
                    set_post_thumbnail( $post_id, (int) $processed_meta_value );
                } else {
                    delete_post_thumbnail($post_id);
                }
            } else { // All other meta
                if ( $meta_value === null ) {
                    delete_post_meta($post_id, $meta_key_sanitized);
                } else {
                    update_post_meta( $post_id, $meta_key_sanitized, $processed_meta_value );
                }
            }
             if ( ! in_array( $meta_key, $changed_summary['meta'] ) ) $changed_summary['meta'][] = $meta_key;
        }
    }

    /**
     * Sync JetEngine relationships declared in $this->jet_engine_relation_map.
     */
    protected function _process_jet_engine_relations( int $child_id, array &$payload, $sku, array &$changed_summary ) {
        if ( empty( $this->jet_engine_relation_map ) || ! function_exists( 'f12_set_relation_parent_by_sku' ) ) {
            return;
        }

        foreach ( $this->jet_engine_relation_map as $payload_key => $cfg ) {
            if ( ! isset( $payload[ $payload_key ] ) ) {
                continue;
            }

            $raw_skus = $payload[ $payload_key ];
            $parent_sku_list = is_array( $raw_skus ) ? $raw_skus : array_map( 'trim', explode( ',', (string) $raw_skus ) );
            $parent_sku_list = array_filter( $parent_sku_list );

            // Get the relation object to handle disconnection.
            $rel = jet_engine()->relations->get_active_relations( $cfg['relation_id'] );
            if (!$rel) continue;

            if ( empty($parent_sku_list) ) {
                // Handle disconnection if payload sends an empty list.
                $rel->delete_rows( null, $child_id );
                f12_sync_log( "[JetEngine] Disconnected all parents from child={$child_id} due to empty payload." );
                $changed_summary['special'][] = "jet_rel_{$cfg['relation_id']}_disconnected";
            } else {
                // Call the high-level helper function to do all the work.
                $parent_sku = $parent_sku_list[0];
                $result = f12_set_relation_parent_by_sku( $child_id, $parent_sku, $cfg );

                if ( ! is_wp_error($result) ) {
                    $changed_summary['special'][] = "jet_rel_{$cfg['relation_id']}";
                }
            }

            unset( $payload[ $payload_key ] );
        }
    }
}