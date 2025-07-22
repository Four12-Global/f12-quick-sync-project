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
    }
}

// Initialize the plugin manager.
F12_Quick_Sync_Manager::get_instance();