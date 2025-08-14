// src/books-media.ts

import { mediaSync, MediaSyncConfig } from './lib/media-helpers';

// The single, valid call to input.config() for the entire script run.
const scriptInput = input.config();

const booksMediaConfig: MediaSyncConfig = {
  // 1. The name of your Airtable table
  airtableTable: 'Books',

  // 2. The standard WordPress media endpoints for production and staging
  envMediaEndpoints: {
    prod:    'https://four12global.com/wp-json/wp/v2/media',
    staging: 'https://wordpress-1204105-5660147.cloudwaysapps.com/wp-json/wp/v2/media',
  },

  // 3. Airtable fields used to track when a media sync is needed
  lastModifiedField:     'media_last_modified',
  publishTimestampField: 'media_publish_timestamp',

  // 4. A list of all image/attachment fields for the "Books" CPT
  imageFields: [
    // Configuration for the main featured image
    {
      attachmentField:    'featured_image_attachment',
      wpIdField:          'featured_image_wp_id',
      wpUrlField:         'featured_image_link',
      airtableCacheField: 'featured_image_external',
      isMultiple:         false,
    },
    // Configuration for the custom PDF's preview image
    {
      attachmentField:    'pdf_image_1_attachment',
      wpIdField:          'pdf_image_1_wp_id',
      wpUrlField:         'pdf_image_1_link',
      airtableCacheField: 'pdf_image_1_external',
      isMultiple:         false,
    },
  ],
};

// This one line runs the entire media sync process using the configuration above.
mediaSync(booksMediaConfig, scriptInput);