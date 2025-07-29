// src/series-media.ts

import { mediaSync, MediaSyncConfig } from './lib/media-helpers';

// The single, valid call to input.config()
const scriptInput = input.config();

const seriesMediaConfig: MediaSyncConfig = {
  // 1. Your Airtable table name
  airtableTable: 'Series',

  // 2. WP Media endpoints per environment
  envMediaEndpoints: {
    prod: 'https://four12global.com/wp-json/wp/v2/media',
    staging: 'https://wordpress-1204105-5660147.cloudwaysapps.com//wp-json/wp/v2/media',
  },

  // 3. The fields you use in Airtable to track media changes
  lastModifiedField:     'media_last_modified',
  publishTimestampField: 'media_publish_timestamp',

  // 4. One entry per image slot in your CPT
  imageFields: [
    {
      attachmentField:    'featured_image_attachment',
      wpIdField:          'featured_image_wp_id',
      wpUrlField:         'featured_image_link',
      airtableCacheField: 'featured_image_external',
      isMultiple:         false,
    },
    {
      attachmentField:    'banner_image_attachment',
      wpIdField:          'banner_image_wp_id',
      wpUrlField:         'banner_image_link',
      airtableCacheField: 'banner_image_external',
      isMultiple:         false,
    },
    {
      attachmentField:    'listing_image_attachment',
      wpIdField:          'listing_image_wp_id',
      wpUrlField:         'listing_image_link',
      airtableCacheField: 'listing_image_external',
      isMultiple:         false,
    },
    {
      attachmentField:    'no_words_image_attachment',
      wpIdField:          'no_words_image_wp_id',
      wpUrlField:         'no_words_image_link',
      airtableCacheField: 'no_words_image_external',
      isMultiple:         false,
    },
    {
      attachmentField:    'primary_cta_image_attachment',
      wpIdField:          'primary_cta_image_wp_id',
      wpUrlField:         'primary_cta_image_link',
      airtableCacheField: 'primary_cta_image_external',
      isMultiple:         false,
    },
  ],
};

// Pass the scriptInput object to the helper function.
mediaSync(seriesMediaConfig, scriptInput);
