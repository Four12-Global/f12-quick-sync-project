<?php
/**
 * Plugin Name:       Four12 - Quick Sync Framework
 * Plugin URI:        https://four12global.com
 * Description:       A modular framework for syncing data from Airtable to WordPress CPTs and Taxonomies.
 * Version:           2.0.0
 * Author:            Four12 Global
 * Author URI:        https://four12global.com

 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly.
}

define( 'F12_QUICK_SYNC_PATH', plugin_dir_path( __FILE__ ) );
define( 'F12_QUICK_SYNC_URL', plugin_dir_url( __FILE__ ) );


/**
 * Main plugin class to coordinate all modules.
 */
final class F12_Quick_Sync_Manager {

    private static $instance;
    private $modules = [];

    /**
     * Singleton instance.
     */
    public static function get_instance() {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Constructor.
     */
    private function __construct() {
        $this->load_dependencies();
        $this->instantiate_modules();
        add_action( 'rest_api_init', [ $this, 'register_rest_routes' ] );
    }

    /**
     * Load all required files.
     */
    private function load_dependencies() {
        require_once F12_QUICK_SYNC_PATH . 'core-helpers.php';
        require_once F12_QUICK_SYNC_PATH . 'module-base.php';
        
        // Load Parsedown library if it exists
        if ( file_exists( F12_QUICK_SYNC_PATH . 'vendor/parsedown/Parsedown.php' ) ) {
            require_once F12_QUICK_SYNC_PATH . 'vendor/parsedown/Parsedown.php';
        }

        // Autoload all modules from the /modules/ directory
        foreach ( glob( F12_QUICK_SYNC_PATH . 'modules/*.php' ) as $module_file ) {
            require_once $module_file;
        }
    }

    /**
     * Find and instantiate all declared module classes.
     */
    private function instantiate_modules() {
        $declared_classes = get_declared_classes();
        foreach ( $declared_classes as $class_name ) {
            if ( substr($class_name, -12) === '_Sync_Module' && class_exists($class_name) ) {
                $this->modules[ $class_name ] = new $class_name();
            }
        }
    }



	/**
	 * Handles the REST API request to clear the Breeze cache.
	 * This definitive version uses WP-CLI for maximum reliability,
	 * inspired by the proven method in the legacy sync dashboard plugin.
	 */
	public function handle_clear_cache_request( WP_REST_Request $request ) {
		// First, check if the server environment allows command execution.
		if ( ! function_exists( 'exec' ) ) {
			$error_msg = 'Server configuration error: exec() function is disabled, which is required for WP-CLI cache clearing.';
			f12_sync_log( $error_msg );
			return new WP_Error( 'f12_exec_disabled', $error_msg, [ 'status' => 501 ] ); // 501 Not Implemented
		}

		// Assume 'wp' is in the system's PATH. This is standard.
		// We add the --path flag to ensure WP-CLI operates on the correct WordPress installation.
		$command = 'wp breeze purge --cache=all --path=' . escapeshellarg( ABSPATH );
		
		$output = [];
		$return_code = -1;

		// Execute the command, capturing all output (stdout & stderr)
		@exec( $command . ' 2>&1', $output, $return_code );
		
		$output_string = implode( "\n", $output );

		// Log the result for debugging purposes.
		f12_sync_log( "Cache Clear Command Executed: `{$command}` | Return Code: {$return_code} | Output: {$output_string}" );

		// A return code of 0 and the word "success" in the output is a reliable indicator of success.
		if ( $return_code === 0 && strpos( strtolower( $output_string ), 'success' ) !== false ) {
			return rest_ensure_response( [
				'success' => true,
				'message' => 'Breeze cache cleared successfully via WP-CLI.',
				'data'    => [ 'output' => $output_string ]
			] );
		} else {
			// If it failed, return a server error with the CLI output for debugging.
			$error_message = 'Failed to clear Breeze cache using WP-CLI.';
			if ( $return_code !== 0 ) {
				$error_message .= " (Exit Code: {$return_code})";
			}
			return new WP_Error(
				'f12_cli_cache_clear_failed',
				$error_message,
				[
					'status' => 500,
					'data'   => [ 'output' => $output_string ]
				]
			);
		}
	}


    /**
     * Register REST API routes for each loaded module.
     */
    public function register_rest_routes() {
        foreach ( $this->modules as $module ) {
            if ( ! method_exists($module, 'get_endpoint_slug') || ! method_exists($module, 'handle_sync_request') ) {
                continue;
            }

            register_rest_route(
                'four12/v1',
                '/' . $module->get_endpoint_slug(),
                [
                    'methods'             => WP_REST_Server::CREATABLE, // 'POST'
                    'callback'            => [ $module, 'handle_sync_request' ],
                    'permission_callback' => 'f12_quick_sync_permission_check',
                    'args'                => $module->get_rest_api_args(),
                ]
            );
             f12_sync_log( 'Registered endpoint: /four12/v1/' . $module->get_endpoint_slug() );
        }


		// Register the cache clearing endpoint
		register_rest_route(
			'four12/v1',
			'/clear-cache',
			[
				'methods'             => WP_REST_Server::CREATABLE, // 'POST'
				'callback'            => [ $this, 'handle_clear_cache_request' ],
				'permission_callback' => 'f12_quick_sync_permission_check',
				'args'                => [],
			]
		);
		f12_sync_log( 'Registered endpoint: /four12/v1/clear-cache' );


    }

}


//----------

// Initialize the plugin manager.
F12_Quick_Sync_Manager::get_instance();

/**
 * Load the JetEngine relationship helper once JetEngine is available.
 */
add_action( 'plugins_loaded', function () {
	// Bail if JetEngine isn't active (avoids fatals in staging without the plugin).
	if ( ! function_exists( 'jet_engine' ) ) {
		return;
	}

	// Already loaded?  Skip (prevents redeclare in tests/CLI).
	// This now checks for the correct, final function name.
	if ( function_exists( 'f12_set_relation_parent_by_sku' ) ) {
		return;
	}

	require_once __DIR__ . '/relations.php'; // <-- adjust path if you move the file
}, 20 ); // priority 20 : JetEngine boots at 10, so we're safely after it