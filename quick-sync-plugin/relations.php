<?php
/**
 * Safely connect JetEngine relations.
 *
 * @param int        $rel_id   JetEngine relation ID (63 for Series→Sessions).
 * @param int        $parent   WP ID of the Series parent.
 * @param int|int[]  $children One or more Session IDs.
 * @param string     $mode     update|replace|disconnect  (default: update)
 *
 * @return true|WP_Error
 */
function f12_set_jet_relation( int $rel_id, int $parent, $children, string $mode = 'update' ) {

	// Hard-fail if the parent post vanished.
	if ( ! get_post( $parent ) ) {
		return new WP_Error( 'invalid_parent', "Series {$parent} not found", [ 'status' => 400 ] );
	}

	$rel = jet_engine()->relations->get_active_relations( $rel_id );

	if ( ! $rel ) {
		return new WP_Error( 'invalid_rel', "Relation {$rel_id} missing", [ 'status' => 400 ] );
	}

	$rel->set_update_context( 'child' );               // We’re passing children
	$rel->update( $parent, (array) $children, $mode ); // JetEngine does the heavy lifting

	return true;
}