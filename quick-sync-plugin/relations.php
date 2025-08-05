<?php
// relations.php  (v3.1 - Production Final)

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Sets the parent for a child post using the parent's SKU.
 * This is a high-level function that encapsulates the entire process of
 * finding the parent, setting the relation context, and updating the link.
 * It will REPLACE any existing parent for the child in this relation.
 *
 * @param int   $child_id         The ID of the child post.
 * @param string $parent_sku      The SKU of the parent post to link.
 * @param array  $relation_config The configuration array from the module's map.
 * @return true|WP_Error
 */
function f12_set_relation_parent_by_sku( int $child_id, string $parent_sku, array $relation_config ) {
    
    // 1. Find the parent post by its SKU.
    $parent_post = f12_get_post_by_sku( $parent_sku, $relation_config['parent_cpt'], $relation_config['parent_sku_meta'] );

    if ( ! $parent_post ) {
        f12_sync_log("[JetEngine] FAILED: Parent post with SKU '{$parent_sku}' not found.");
        return new WP_Error('parent_not_found', "Parent post with SKU '{$parent_sku}' not found.");
    }
    $parent_id = $parent_post->ID;

    // 2. Get the relation object from JetEngine.
    $rel_id = (int) $relation_config['relation_id'];
    $rel = jet_engine()->relations->get_active_relations( $rel_id );

    if ( ! $rel ) {
        f12_sync_log("[JetEngine] FAILED: Relation object for ID '{$rel_id}' not found or is inactive.");
        return new WP_Error('relation_not_found', "JetEngine Relation '{$rel_id}' not found.");
    }

    // 3. Set the context and update the relationship. This is the critical sequence.
    $rel->set_update_context( 'child' );
    $rel->update( $parent_id, $child_id );

    f12_sync_log("[JetEngine] SUCCESS: Linked child ID {$child_id} to parent ID {$parent_id} for relation {$rel_id}.");

    return true;
}