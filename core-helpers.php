<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly.
}

/**
 * Centralized permission check for all sync endpoints.
 * Relies on WordPress Application Passwords.
 */
function f12_quick_sync_permission_check( WP_REST_Request $request ) {
    if ( ! current_user_can( 'edit_posts' ) ) {
        return new WP_Error(
            'rest_forbidden',
            __( 'You do not have permission to perform this action.', 'f12-quick-sync' ),
            [ 'status' => 403 ]
        );
    }
    return true;
}

/**
 * Logs messages to the PHP error log if WP_DEBUG and WP_DEBUG_LOG are enabled.
 */
function f12_sync_log( $message ) {
    if ( defined( 'WP_DEBUG' ) && WP_DEBUG === true && defined( 'WP_DEBUG_LOG' ) && WP_DEBUG_LOG === true ) {
        $prefix = '[Four12 Quick Sync] ';
        if ( is_array( $message ) || is_object( $message ) ) {
            error_log( $prefix . print_r( $message, true ) );
        } else {
            error_log( $prefix . $message );
        }
    }
}

/**
 * Retrieves a single post object by its SKU meta field.
 *
 * @param string $sku The SKU to search for.
 * @param string $cpt The post type to search within.
 * @param string $sku_meta_key The meta key for the SKU.
 * @return WP_Post|null The found WP_Post object or null if not found.
 */
function f12_get_post_by_sku( $sku, $cpt, $sku_meta_key ) {
    if ( empty( $sku ) || empty($cpt) || empty($sku_meta_key) ) {
        return null;
    }
    $query_args = [
        'post_type'      => $cpt,
        'post_status'    => 'any',
        'posts_per_page' => 1,
        'meta_query'     => [
            [
                'key'   => $sku_meta_key,
                'value' => $sku,
            ],
        ],
        'fields'         => '', // Return full post objects
    ];
    $posts = get_posts( $query_args );

    if ( ! empty( $posts ) ) {
        if ( count( $posts ) > 1 ) {
            f12_sync_log( sprintf( 'Warning: Duplicate SKU "%s" detected in CPT "%s". Found %d posts. Returning the first one (ID: %d).', esc_html( $sku ), $cpt, count( $posts ), $posts[0]->ID ) );
        }
        return $posts[0];
    }
    return null;
}

/**
 * Sideloads an image from a URL into the WordPress Media Library.
 *
 * @param string $image_url The URL of the image to sideload.
 * @param int    $post_id   The ID of the post to attach the image to (0 for unattached).
 * @param string $desc      Description for the image media item (optional).
 * @return int|WP_Error Attachment ID on success, WP_Error on failure.
 */
function f12_sideload_image_from_url( $image_url, $post_id = 0, $desc = null ) {
    if ( empty( $image_url ) || ! filter_var( $image_url, FILTER_VALIDATE_URL ) ) {
        return new WP_Error( 'invalid_image_url', __( 'Invalid image URL provided for sideloading.', 'f12-quick-sync' ), $image_url );
    }

    if ( ! function_exists( 'media_handle_sideload' ) ) {
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';
    }

    $tmp = download_url( $image_url );
    if ( is_wp_error( $tmp ) ) {
        @unlink( $tmp );
        return new WP_Error( 'image_download_failed', sprintf( __( 'Could not download image from URL: %s. Error: %s', 'f12-quick-sync' ), esc_url($image_url), $tmp->get_error_message() ), $tmp->get_error_data() );
    }

    $file_array = [
        'name'     => basename( strtok( $image_url, '?' ) ),
        'tmp_name' => $tmp,
    ];

    if ( is_wp_error( $file_array['tmp_name'] ) ) {
        @unlink( $file_array['tmp_name'] );
        return new WP_Error( 'image_temp_store_failed', __( 'Could not store temporary image file after download.', 'f12-quick-sync' ), $file_array['tmp_name'] );
    }

    $attachment_id = media_handle_sideload( $file_array, $post_id, $desc );
    
    @unlink( $file_array['tmp_name'] );

    if ( is_wp_error( $attachment_id ) ) {
        return new WP_Error( 'image_sideload_failed', sprintf( __( 'Could not sideload image. Error: %s', 'f12-quick-sync' ), $attachment_id->get_error_message() ), $attachment_id->get_error_data() );
    }

    return (int) $attachment_id;
}

/**
 * Returns "now" as DateTime in the site’s timezone.
 */
function f12qs_now(): DateTime {
    return new DateTime( 'now', wp_timezone() ); // site tz
}

/** Local “MySQL” string – what WP expects for post_date */
function f12qs_mysql_local( DateTime $dt ): string {
    return $dt->format( 'Y-m-d H:i:s' );
}

/** UTC “MySQL” string – what WP expects for post_date_gmt */
function f12qs_mysql_gmt( DateTime $dt ): string {
    $utc = clone $dt;
    $utc->setTimezone( new DateTimeZone( 'UTC' ) );
    return $utc->format( 'Y-m-d H:i:s' );
}

/** Pure UTC Unix timestamp – what JetEngine wants when “Save as timestamp” */
function f12qs_unix_utc( DateTime $dt ): int {
    $utc = clone $dt;
    $utc->setTimezone( new DateTimeZone( 'UTC' ) );
    return $utc->getTimestamp();
}