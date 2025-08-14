// src/books-sync.ts

import { quickSync, QuickSyncConfig, FieldMap } from './lib/sync-helpers';

// The single, valid call to input.config() for the entire script run.
const scriptInput = input.config();

// The FIELD_MAP is the heart of the configuration.
// It maps the 'Airtable Field Name' to the 'WordPress Payload Key'.
const FIELD_MAP: FieldMap = {
  /* --- Core WordPress Fields --- */
  'title': 'post_title',
  'slug': 'post_name',
  'content': 'post_content',
  'excerpt': 'post_excerpt',
  'status': 'post_status',
  'post_date': 'post_date',

  /* --- SKU (Essential for de-duplication) --- */
  'sku': 'sku',

  /* --- SEO & Permalinks --- */
  '_aioseo_description': '_aioseo_description',
  'Custom URI': 'custom_permalink_uri', // For Permalink Manager plugin

  /* --- Taxonomies --- */
  'global_categories': 'global-categories',
  'author': 'author', // Maps to 'author' taxonomy
  'topics': 'topics',

  /* --- Media Fields (using the IDs from the media script) --- */
  'featured_image': {
    airtableIdField:   'featured_image_wp_id',
    airtableLinkField: 'featured_image_link',
    wpKey: '_thumbnail_id', // Special WP key for the featured image
  },
  'pdf_image_1': {
    airtableIdField:   'pdf_image_1_wp_id',
    airtableLinkField: 'pdf_image_1_link',
    wpKey: 'pdf-image-1', // A custom meta field for the PDF's image
  },

  /* --- Custom Meta Fields (Links & Content) --- */
  'tag-line': 'tag-line',
  'link_five - Print PDF Link': 'link_five',
  'link_twelve - Hardcopy Link': 'link_twelve',
  'link_six - Web PDF Link': 'link_six',
  'link_eight - Kindle PDF Link': 'link_eight',
  'link_thirteen - Order Here': 'link_thirteen',
  'custom-pdf-title-1': 'custom-pdf-title-1',
  'link_ten - Custom PDF Link 1': 'link_ten',

  /* --- Version 1 Content (as custom meta) --- */
  'version-1-title': 'version-1-title',
  'version-1-tag-line': 'version-1-tag-line',
  'version-1-content': 'version-1-content',
  'version-1-footer': 'version-1-footer',

  /* --- Timestamps (for bookkeeping) --- */
  'last_synced': 'last_synced',
  'publish_timestamp': 'last_published',
};

const booksSyncConfig: QuickSyncConfig = {
  // The name of your Airtable table
  airtableTable: 'Books',

  // The Airtable fields holding the unique ID and title
  skuField: 'sku',
  titleField: 'title',

  // The field map defined above
  fieldMap: FIELD_MAP,

  // The WordPress endpoints for this CPT
  // NOTE: You will need to create a 'books-sync.php' module in your WP plugin
  // to create this endpoint.
  envEndpoints: {
    prod:    'https://four12global.com/wp-json/four12/v1/books-sync',
    staging: 'https://wordpress-1204105-5660147.cloudwaysapps.com/wp-json/four12/v1/books-sync',
  },
};

// This one line runs the entire data sync process.
quickSync(booksSyncConfig, scriptInput);