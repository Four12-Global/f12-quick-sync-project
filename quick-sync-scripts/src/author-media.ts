// quick-sync-scripts/src/author-media.ts

import { mediaSync, MediaSyncConfig } from './lib/media-helpers';

// This config object replaces all the hardcoded constants in the old script.
const authorMediaConfig: MediaSyncConfig = {
  // 1. Your Airtable table name
  airtableTable: 'author-speaker',

  // 2. WP Media endpoints per environment
  envMediaEndpoints: {
    prod: 'https://four12global.com/wp-json/wp/v2/media',
    staging: 'https://wordpress-1204105-5660147.cloudwaysapps.com//wp-json/wp/v2/media',
  },

  // 3. The fields you use to track media changes
  lastModifiedField: 'media_last_modified',
  publishTimestampField: 'media_publish_timestamp',

  // 4. One entry for the profile image
  //    This directly maps to the IMAGE_FIELDS from your old script.
  imageFields: [
    {
      attachmentField:    'profile_image_attachment',
      wpIdField:          'profile_image_wp_id',
      wpUrlField:         'profile_image_link',
      airtableCacheField: 'profile_image_external',
      isMultiple:         false, // This is a single image field
    },
  ],
};

// The single, valid call to input.config() for the entire script run.
const scriptInput = input.config();

// This one line runs the entire sync process using the config above.
mediaSync(authorMediaConfig, scriptInput);