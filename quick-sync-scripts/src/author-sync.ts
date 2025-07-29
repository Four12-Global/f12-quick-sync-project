// quick-sync-scripts/src/author-sync.ts

import { quickSync, QuickSyncConfig, FieldMap } from './lib/sync-helpers';

// This is the single, valid call to input.config() for the entire script run.
const scriptInput = input.config();

// This FIELD_MAP is taken directly from your v1 script.
// This is the most important part! We map to 'name' and 'slug', not 'post_title'.
const AUTHOR_FIELD_MAP: FieldMap = {
  // Airtable Field Name  ->  WP Payload Key for a TAXONOMY TERM
  'author_title':       'name',
  'author_slug':        'slug',
  'author_description': 'as_description', // Your PHP plugin handles this
  'profile_image_wp_id':'profile_image',  // This is just a meta field for the term

  // Special case: The SKU is both a meta field and a top-level payload key.
  // The helper automatically promotes the 'sku' value to the top level.
  'sku':                'sku',
};

const authorSyncConfig: QuickSyncConfig = {
  // Airtable table name
  airtableTable: 'author-speaker',

  // The unique identifier fields in Airtable
  skuField: 'sku',
  titleField: 'author_title', // Used for logging and fallback naming

  // Your field map
  fieldMap: AUTHOR_FIELD_MAP,

  // Your endpoints
  envEndpoints: {
    prod: 'https://four12global.com/wp-json/four12/v1/author-sync',
    staging: 'https://wordpress-1204105-5660147.cloudwaysapps.com/wp-json/four12/v1/author-sync' 
  },
};

// Pass the scriptInput object to the helper function.
quickSync(authorSyncConfig, scriptInput);