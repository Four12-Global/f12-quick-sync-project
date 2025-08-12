// quick-sync-scripts/src/worship-sync.ts

import { quickSync, FieldMap } from './lib/sync-helpers';

// This is the single, valid call to input.config() for the entire script run.
const scriptInput = input.config();

// The FIELD_MAP is the heart of the configuration.
// It maps 'Airtable Field Name' to the 'WordPress Payload Key'.
const WORSHIP_FIELD_MAP: FieldMap = {
  /* --- Core WP Fields --- */
  'title': 'post_title',
  'slug': 'post_name',
  'website_status': 'post_status',
  'excerpt': 'post_excerpt',
  'seo_description': '_aioseo_description',
  'release_date': 'post_date',

  /* --- SKU (Essential for de-duplication) --- */
  'sku': 'sku',

  /* Custom permalink (Permalink Manager) */
  permalink:  'custom_permalink_uri',

  /* --- Taxonomy --- */
  // Maps the 'worship_artist' field in Airtable to the 'worship_artist' taxonomy in WordPress.
  'worship_artist': 'worship_artist',
  'topics': 'topics',
  'category': 'global-categories',

  /* --- Media Fields (using the IDs from the media script) --- */
  'featured_image_wp_id': {
    airtableIdField: 'featured_image_wp_id',
    airtableLinkField: 'featured_image_link',
    wpKey: '_thumbnail_id', // This is the special WordPress key for the featured image.
  },

  // 1. Send the ID to a meta field for backend reference
  'chord_sheet_wp_id': { // The Airtable field containing the ID(s)
    airtableIdField: 'chord_sheet_wp_id',
    wpKey: 'chord_sheet_wp_id', // Save it to a WP meta field with the same name
  },

  // 2. Send the URL to a separate meta field for the frontend
  'chord_sheet_link': { // The Airtable field containing the URL(s)
    airtableIdField: 'chord_sheet_link', // Use the link field as the source
    wpKey: 'chord_sheet_link', // Save it to a clear, distinct WP meta field
  },

    /* --- Simple Meta Fields (Links) --- */
    // These will be saved directly as post meta in WordPress.
    'apple_music_link': 'apple_music_link',
    'spotify_link': 'spotify_link',
    'youtube_music_link': 'youtube_music_link',
};

const worshipSyncConfig = {
  /* ----- Airtable table name ----- */
  airtableTable: 'Worship',

  /* ----- Airtable field that holds your permanent SKU & title ----- */
  skuField: 'sku',
  titleField: 'title',
  

  /* ----- Use the field map defined above ----- */
  fieldMap: WORSHIP_FIELD_MAP,

  /* ----- Define the production and staging endpoints for this CPT ----- */
  envEndpoints: {
    prod: 'https://four12global.com/wp-json/four12/v1/worship-sync',
    staging: 'https://wordpress-1204105-5660147.cloudwaysapps.com/wp-json/four12/v1/worship-sync',
  },
};

// Pass the config and input to the helper function to run the sync.
quickSync(worshipSyncConfig, scriptInput);