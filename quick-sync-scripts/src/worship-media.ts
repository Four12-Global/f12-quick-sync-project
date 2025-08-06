// quick-sync-scripts/src/worship-media.ts

import { mediaSync, MediaSyncConfig } from './lib/media-helpers';

// The single, valid call to input.config() for the entire script run.
const scriptInput = input.config();

const worshipMediaConfig: MediaSyncConfig = {
  // 1. Your Airtable table name
  airtableTable: 'Worship',

  // 2. WP Media endpoints (these are standard and rarely change)
  envMediaEndpoints: {
    prod: 'https://four12global.com/wp-json/wp/v2/media',
    staging: 'https://wordpress-1204105-5660147.cloudwaysapps.com/wp-json/wp/v2/media',
  },

  // 3. The fields you use in Airtable to track media changes
  lastModifiedField: 'media_last_modified',
  publishTimestampField: 'media_publish_timestamp',

  // 4. One entry for each media attachment field in your CPT
  imageFields: [
    // Entry for the Featured Image
    {
      attachmentField:    'featured_image_attachment',
      wpIdField:          'featured_image_wp_id',
      wpUrlField:         'featured_image_link',
      airtableCacheField: 'featured_image_external',
      isMultiple:         false,
    },
    // Entry for the Chord Sheet PDF
    {
      attachmentField:    'chord_sheet_attachment',
      wpIdField:          'chord_sheet_wp_id',
      wpUrlField:         'chord_sheet_link',
      airtableCacheField: 'chord_sheet_external',
      isMultiple:         false, // It's a single PDF attachment
    },
  ],
};

// Pass the scriptInput object to the helper function to run the sync.
mediaSync(worshipMediaConfig, scriptInput);