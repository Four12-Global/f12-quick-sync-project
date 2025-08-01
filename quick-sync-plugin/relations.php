<?php
/**
 * JetEngine relationship utilities.
 */
if ( ! function_exists( 'jet_engine' ) ) {
	return; // JetEngine disabled – skip.
}

if ( ! function_exists( 'f12_set_jet_relation' ) ) {

	/**
	 * Replace the **parent list** of one child post.
	 *
	 * @param int   $rel_id     JetEngine relation ID (e.g. 63).
	 * @param int   $child_id   WP ID of the Session (child).
	 * @param int[] $parent_ids One or more Series parent IDs.
	 * @return true|WP_Error
	 */
	function f12_set_jet_relation( int $rel_id, int $child_id, array $parent_ids ) {

		if ( empty( $parent_ids ) ) {
			return new WP_Error( 'no_parent', "[JetEngine] No parent IDs supplied for child {$child_id}.", [ 'status' => 400 ] );
		}

		$rel = jet_engine()->relations->get_active_relations( $rel_id );
		if ( ! $rel ) {
			return new WP_Error( 'invalid_rel', "[JetEngine] Relation {$rel_id} missing.", [ 'status' => 400 ] );
		}

		// We are providing PARENT IDs for a CHILD item.
		$rel->set_update_context( 'child' );
		$rel->update( $child_id, $parent_ids, 'replace' ); // nukes & overwrites the child's parents

		f12_sync_log(
			"[JetEngine] Child {$child_id} now linked to parent(s): " . implode( ',', $parent_ids )
		);

		return true;
	}
}