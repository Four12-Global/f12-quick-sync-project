import { quickSync } from './lib/sync-helpers';

const FIELD_MAP = {
  /* ── Core WP fields ───────────────────────────── */
  session_title:       'post_title',
  session_slug:        'post_name',
  session_description_admin: 'session_description_admin',
  excerpt:             'post_excerpt',

  /* Custom permalink (Permalink Manager / AIOSEO) */
  session_permalink:   'custom_permalink_uri',
  _aioseo_description: '_aioseo_description',


  /* ── SKU & Status ─────────────────────────────── */
  session_sku:         'sku',
  website_status:      'post_status',

  /* ── Taxonomies ──────────────────────────────── */
  topics_title:        'topics',
  speaker_title:       'author-speaker',
  series_category:     'series-categories',
  global_categories:   'global-categories',

  /* ── ACTIVE media (prefer ID, fallback URL) ──── */
  featured_image: {
    airtableIdField:   'featured_image_wp_id',
    airtableLinkField: 'featured_image_link',
    wpKey: '_thumbnail_id',
  },
  listing_image: {
    airtableIdField:   'listing_image_wp_id',
    airtableLinkField: 'listing_image_link',
    wpKey: 'listing-image',
  },
  no_words_image: {
    airtableIdField:   'no_words_image_wp_id',
    airtableLinkField: 'no_words_image_link',
    wpKey: 'no-words-image',
  },
  banner_image: {
    airtableIdField:   'banner_image_wp_id',
    airtableLinkField: 'banner_image_link',
    wpKey: 'banner-image',
  },
  pdf_image_1: {
    airtableIdField:   'pdf_image_1_wp_id',
    airtableLinkField: 'pdf_image_1_link',
    wpKey: 'pdf-image-1',
  },
  pdf_image_2: {
    airtableIdField:   'pdf_image_2_wp_id',
    airtableLinkField: 'pdf_image_2_link',
    wpKey: 'manual2-image',
  },

  /* ── Meta / Links / Podcast etc. ─────────────── */
  pdf_title_1:          'custom-pdf-title-1',
  pdf_link_1:           'link_ten',
  pdf_title_2:          'custom-pdf-title-2',
  pdf_link_2:           'link_eleven',
  alt_link:             'link_five',
  youtube_link:         'link_one',
  vimeo_link:           'vimeo_link',
  spotify_podcast:      'spotify-podcast-link',
  apple_podcast:        'apple-podcast-link',

  /* ── Timestamps (sync bookkeeping) ───────────── */
  publish_timestamp:    'last_published',

  /* ── JetEngine relationship (Series parent SKU) ── */
  series_sku:    'jet_relation_series_parent',
  series_wp_id:  'jet_relation_series_wp_id',
  series_title:  'jet_relation_series_title',
};

/* -------------------------------------------------
   The single, valid call to input.config() for the entire script run.
-------------------------------------------------- */
const scriptInput = input.config();

quickSync({
  /* ----- Airtable table name ----- */
  airtableTable: 'Sessions',                // Airtable’s table name

  /* ----- Airtable field that holds your permanent SKU & title ----- */
  skuField:   'session_sku',
  titleField: 'session_title',

  /* ----- END per-CPT overrides ----- */
  fieldMap: FIELD_MAP,
  envEndpoints: {
    // NOTE: CPT slug on WP is “resources”, so the REST route reflects that.
    prod:    'https://four12global.com/wp-json/four12/v1/sessions-sync',
    staging: 'https://wordpress-1204105-5660147.cloudwaysapps.com/wp-json/four12/v1/sessions-sync',
  },
}, scriptInput);
